/**
 * scrapeJobController.js
 * ----------------------
 * Handles §4 Scrape Jobs API (docs/apis.md):
 *
 *   POST   /scrape-jobs              submitScrapeJob   🔒
 *   GET    /scrape-jobs              listScrapeJobs    🔒
 *   GET    /scrape-jobs/:id          getScrapeJob      🔒
 *   DELETE /scrape-jobs/:id          cancelScrapeJob   🔒
 *   PATCH  /scrape-jobs/:id          updateJobStatus   🔑 (worker only)
 *   POST   /scrape-jobs/:id/photos   ingestPhoto       🔑 (worker only)
 */

import { spawn } from 'child_process';
import { openSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { validateScrapeUrl } from '../utils/validators.js';
import {
  createScrapeJob,
  findScrapeJobById,
  findScrapeJobs,
  updateScrapeJob,
} from '../models/scrapeJobModel.js';
import { createPhoto } from '../models/photoModel.js';

const errBody = (code, message, details = null) => ({ error: { code, message, details } });

const VALID_STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled'];
const DEFAULT_MAX_PHOTOS = Math.max(1, Number(process.env.DEFAULT_MAX_PHOTOS) || 3);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const activeWorkers = new Map();

const stopWorker = (jobId) => {
  const child = activeWorkers.get(jobId);
  if (!child || child.killed) return false;
  child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
  return true;
};

// ---------------------------------------------------------------------------
// POST /scrape-jobs  🔒
// ---------------------------------------------------------------------------
export const submitScrapeJob = async (req, res) => {
  const { url, maxPhotos = DEFAULT_MAX_PHOTOS } = req.body ?? {};

  // Validate URL via existing SSRF-aware validator
  const urlValidation = validateScrapeUrl(url);
  if (!urlValidation.isValid) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', urlValidation.errors.join(' '), urlValidation.errors)
    );
  }

  // Validate maxPhotos
  const max = Number(maxPhotos);
  if (!Number.isInteger(max) || max < 1) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', 'maxPhotos must be a positive integer.')
    );
  }

  const activeJobs = await Promise.all(
    ['queued', 'running'].map((status) =>
      findScrapeJobs({
        submittedBy: req.user.id,
        status,
        page: 1,
        limit: 1,
      })
    )
  );
  const activeJobCount = activeJobs.reduce((sum, result) => sum + (result.total ?? 0), 0);
  if (activeJobCount > 0) {
    return res.status(409).json(
      errBody(
        'ACTIVE_SCRAPE_EXISTS',
        'You already have a scrape job queued or running. Cancel it or wait for it to finish before starting another.'
      )
    );
  }

  // Spawn the Python scraper worker in the background.
  // It will PATCH job status and POST photos back via the internal API.
  const pythonBin    = process.env.PYTHON_BIN      || (process.platform === 'win32' ? 'python' : 'python3');
  const scraperPath  = process.env.SCRAPER_PATH    || 'scraping/scraper.py';
  const apiUrl       = process.env.INTERNAL_API_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
  const workerSecret = process.env.WORKER_SECRET   || '';

  if (!workerSecret) {
    return res.status(500).json(
      errBody('SERVER_MISCONFIGURED', 'WORKER_SECRET is not set on the server.')
    );
  }

  const job = await createScrapeJob({
    url:         urlValidation.value,
    maxPhotos:   max,
    submittedBy: req.user.id,
  });

  try {
    // Log worker stdout/stderr to scraping/logs/<job-id>.log for debugging
    const logsDir = path.join(projectRoot, 'scraping', 'logs');
    mkdirSync(logsDir, { recursive: true });
    const logPath = path.join(logsDir, `${job.id}.log`);
    const logFd = openSync(logPath, 'a');

    const child = spawn(
      pythonBin,
      [
        scraperPath,
        '--job-id', job.id,
        '--url',    job.url,
        '--limit',  String(job.maxPhotos),
        '--api-url', apiUrl,
        '--api-key', workerSecret,
      ],
      {
        cwd:      projectRoot,
        detached: true,
        stdio:    ['ignore', logFd, logFd],
        env:      { ...process.env },
      },
    );
    activeWorkers.set(job.id, child);
    child.on('error', (err) => {
      console.error(`[worker] spawn error for job ${job.id}:`, err.message);
      updateScrapeJob(job.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errorMessage: `Failed to start scraper worker: ${err.message}`,
      }).catch((updateErr) => {
        console.error(`[worker] failed to mark job ${job.id} as failed:`, updateErr.message);
      });
    });
    child.on('exit', (code, signal) => {
      activeWorkers.delete(job.id);
      if (code === 0) return;

      findScrapeJobById(job.id)
        .then((latestJob) => {
          if (!latestJob || !['queued', 'running'].includes(latestJob.status)) return null;

          const reason = signal
            ? `Scraper worker exited from signal ${signal}.`
            : `Scraper worker exited with code ${code}.`;

          return updateScrapeJob(job.id, {
            status: 'failed',
            completedAt: new Date().toISOString(),
            errorMessage: `${reason} See ${logPath} for details.`,
          });
        })
        .catch((err) => {
          console.error(`[worker] failed to process worker exit for job ${job.id}:`, err.message);
        });
    });
    child.unref();
    console.log(`[worker] spawned pid=${child.pid} for job ${job.id}`);
  } catch (err) {
    console.error(`[worker] failed to spawn worker for job ${job.id}:`, err.message);
    await updateScrapeJob(job.id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage: `Failed to start scraper worker: ${err.message}`,
    });
  }

  // processScrapeJob (JS fallback) is intentionally NOT called here.
  // The Python worker above handles the full LLM + metadata extraction pipeline.

  return res.status(201).json(job);
};

// ---------------------------------------------------------------------------
// GET /scrape-jobs  🔒
// Users see only their own jobs; admins see all.
// ---------------------------------------------------------------------------
export const listScrapeJobs = async (req, res) => {
  const { status, page, limit } = req.query;
  const isAdmin = req.user.accountType === 'admin';

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `status must be one of: ${VALID_STATUSES.join(', ')}.`)
    );
  }

  const result = await findScrapeJobs({
    submittedBy: isAdmin ? null : req.user.id,
    status:      status || null,
    page,
    limit,
  });

  return res.status(200).json(result);
};

// ---------------------------------------------------------------------------
// GET /scrape-jobs/:id  🔒
// ---------------------------------------------------------------------------
export const getScrapeJob = async (req, res) => {
  const job = await findScrapeJobById(req.params.id);
  if (!job) {
    return res.status(404).json(errBody('NOT_FOUND', 'Scrape job not found.'));
  }

  const isAdmin = req.user.accountType === 'admin';
  if (!isAdmin && job.submittedBy !== req.user.id) {
    return res.status(403).json(errBody('FORBIDDEN', 'Access denied.'));
  }

  return res.status(200).json(job);
};

// ---------------------------------------------------------------------------
// DELETE /scrape-jobs/:id  🔒
// Only queued or running jobs can be cancelled.
// ---------------------------------------------------------------------------
export const cancelScrapeJob = async (req, res) => {
  const job = await findScrapeJobById(req.params.id);
  if (!job) {
    return res.status(404).json(errBody('NOT_FOUND', 'Scrape job not found.'));
  }

  const isAdmin = req.user.accountType === 'admin';
  if (!isAdmin && job.submittedBy !== req.user.id) {
    return res.status(403).json(errBody('FORBIDDEN', 'Access denied.'));
  }

  if (!['queued', 'running'].includes(job.status)) {
    return res.status(422).json(
      errBody(
        'UNPROCESSABLE',
        `Cannot cancel a job with status '${job.status}'. Only queued or running jobs can be cancelled.`
      )
    );
  }

  const stoppedWorker = stopWorker(job.id);
  await updateScrapeJob(job.id, {
    status: 'cancelled',
    completedAt: new Date().toISOString(),
    errorMessage: stoppedWorker ? 'Scrape cancelled by user. Worker process was stopped.' : 'Scrape cancelled by user.',
  });
  return res.status(204).send();
};

// ---------------------------------------------------------------------------
// PATCH /scrape-jobs/:id  🔑 (worker only)
// Python worker calls this to update job status (running / completed / failed).
// ---------------------------------------------------------------------------
export const updateJobStatus = async (req, res) => {
  const job = await findScrapeJobById(req.params.id);
  if (!job) {
    return res.status(404).json(errBody('NOT_FOUND', 'Scrape job not found.'));
  }
  if (job.status === 'cancelled') {
    return res.status(409).json(errBody('JOB_CANCELLED', 'Scrape job has been cancelled.'));
  }

  const { status, errorMessage } = req.body ?? {};

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `status must be one of: ${VALID_STATUSES.join(', ')}.`)
    );
  }

  const updates = { status };
  if (status === 'running') {
    updates.startedAt = new Date().toISOString();
  }
  if (status === 'completed' || status === 'failed') {
    updates.completedAt = new Date().toISOString();
  }
  if (errorMessage) {
    updates.errorMessage = errorMessage;
  }

  const updated = await updateScrapeJob(job.id, updates);
  return res.status(200).json(updated);
};

// ---------------------------------------------------------------------------
// POST /scrape-jobs/:id/photos  🔑 (worker only)
// Python worker posts each extracted photo here as it is processed.
// ---------------------------------------------------------------------------
export const ingestPhoto = async (req, res) => {
  const job = await findScrapeJobById(req.params.id);
  if (!job) {
    return res.status(404).json(errBody('NOT_FOUND', 'Scrape job not found.'));
  }
  if (job.status === 'cancelled') {
    return res.status(409).json(errBody('JOB_CANCELLED', 'Scrape job has been cancelled.'));
  }

  const {
    imageUrl,
    name          = null,
    regiment      = null,
    age           = null,
    dateTaken     = null,
    location      = null,
    photographer  = null,
    collection    = null,
    photoNotes    = null,
    tags          = [],
    license       = null,
    metadata,
  } = req.body ?? {};

  if (!imageUrl) {
    return res.status(400).json(errBody('VALIDATION_ERROR', 'imageUrl is required.'));
  }

  const photo = await createPhoto({
    scrapeJobId:    job.id,
    submittedBy:    job.submittedBy,
    imageUrl,
    name,
    regiment,
    age,
    dateTaken,
    location,
    photographer,
    collection,
    photoNotes,
    tags:           Array.isArray(tags) ? tags : [],
    license,
    isAutoExtracted: true,
    metadata,
  });

  // Increment the job's photo count so the frontend can show live progress.
  await updateScrapeJob(job.id, { photoCount: (job.photoCount ?? 0) + 1 });

  return res.status(201).json(photo);
};
