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

// ---------------------------------------------------------------------------
// POST /scrape-jobs  🔒
// ---------------------------------------------------------------------------
export const submitScrapeJob = async (req, res) => {
  const { url, maxPhotos = 50 } = req.body ?? {};

  // Validate URL via existing SSRF-aware validator
  const urlValidation = validateScrapeUrl(url);
  if (!urlValidation.isValid) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', urlValidation.errors.join(' '), urlValidation.errors)
    );
  }

  // Validate maxPhotos
  const max = Number(maxPhotos);
  if (!Number.isInteger(max) || max < 1 || max > 500) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', 'maxPhotos must be an integer between 1 and 500.')
    );
  }

  const job = await createScrapeJob({
    url:         urlValidation.value,
    maxPhotos:   max,
    submittedBy: req.user.id,
  });

  // Spawn the Python scraper worker in the background.
  // It will PATCH job status and POST photos back via the internal API.
  const projectRoot  = new URL('../../..', import.meta.url).pathname;
  const pythonBin    = process.env.PYTHON_BIN      || 'python3';
  const scraperPath  = process.env.SCRAPER_PATH    || 'scraping/scraper.py';
  const apiUrl       = process.env.INTERNAL_API_URL || 'http://localhost:3000';
  const workerSecret = process.env.WORKER_SECRET   || '';

  try {
    // Log worker stdout/stderr to scraping/logs/<job-id>.log for debugging
    const logsDir = `${projectRoot}/scraping/logs`;
    mkdirSync(logsDir, { recursive: true });
    const logFd = openSync(`${logsDir}/${job.id}.log`, 'a');

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
    child.on('error', (err) => {
      console.error(`[worker] spawn error for job ${job.id}:`, err.message);
    });
    child.unref();
    console.log(`[worker] spawned pid=${child.pid} for job ${job.id}`);
  } catch (err) {
    console.error(`[worker] failed to spawn worker for job ${job.id}:`, err.message);
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

  await updateScrapeJob(job.id, { status: 'cancelled', completedAt: new Date().toISOString() });
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

  const { status, errorMessage } = req.body ?? {};

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `status must be one of: ${VALID_STATUSES.join(', ')}.`)
    );
  }

  const updates = { status };
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
