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
  deleteScrapeJobById,
  findScrapeJobById,
  findScrapeJobs,
  updateScrapeJob,
} from '../models/scrapeJobModel.js';
import {
  countPhotosForScrapeJob,
  createPhoto,
  deletePhotosByIdsForScrapeJob,
  findAllPhotosForScrapeJob,
} from '../models/photoModel.js';
import {
  getPhotoConfidenceStatus,
  normalizeConfidenceThreshold,
} from '../utils/confidence.js';
import { createZip } from '../utils/zip.js';

const errBody = (code, message, details = null) => ({ error: { code, message, details } });

const VALID_STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled'];
const ACTIVE_JOB_STATUSES = ['queued', 'running'];
const EMPTY_JOB_DELETABLE_STATUSES = ['completed', 'failed', 'cancelled'];
const DEFAULT_MAX_PHOTOS = Math.max(1, Number(process.env.DEFAULT_MAX_PHOTOS) || 3);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const activeWorkers = new Map();

const sanitizeFilePart = (value, fallback) => {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || fallback;
};

const extensionFrom = (url, contentType) => {
  const byType = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/tiff': '.tif',
    'image/bmp': '.bmp',
  };

  const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (byType[normalizedType]) return byType[normalizedType];

  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext && ext.length <= 6) return ext;
  } catch {
    // Fall through to default.
  }

  return '.jpg';
};

const pickPhotos = ({ photos, filter, photoIds = [], threshold }) => {
  if (filter === 'all') return photos;

  if (filter === 'selected') {
    const selected = new Set(Array.isArray(photoIds) ? photoIds.map(String) : []);
    return photos.filter((photo) => selected.has(String(photo.id)));
  }

  if (filter === 'passed' || filter === 'flagged') {
    return photos.filter((photo) => getPhotoConfidenceStatus(photo, threshold) === filter);
  }

  return null;
};

const getJobForUser = async (req, res) => {
  const job = await findScrapeJobById(req.params.id);
  if (!job) {
    res.status(404).json(errBody('NOT_FOUND', 'Scrape job not found.'));
    return null;
  }

  const isAdmin = req.user.accountType === 'admin';
  if (!isAdmin && job.submittedBy !== req.user.id) {
    res.status(403).json(errBody('FORBIDDEN', 'Access denied.'));
    return null;
  }

  return job;
};

const isActiveJob = (job) => ACTIVE_JOB_STATUSES.includes(job?.status);
const canDeleteEmptyJob = (job) => EMPTY_JOB_DELETABLE_STATUSES.includes(job?.status);

export const deleteScrapeJobIfEmpty = async (job) => {
  if (!job?.id) {
    return { deleted: false, deletedJobId: null, remainingPhotoCount: 0 };
  }

  const remainingPhotoCount = await countPhotosForScrapeJob({
    scrapeJobId: job.id,
  });

  if (remainingPhotoCount > 0) {
    if (job.photoCount !== remainingPhotoCount) {
      await updateScrapeJob(job.id, { photoCount: remainingPhotoCount });
    }

    return { deleted: false, deletedJobId: null, remainingPhotoCount };
  }

  if (!canDeleteEmptyJob(job)) {
    if ((job.photoCount ?? 0) !== 0) {
      await updateScrapeJob(job.id, { photoCount: 0 });
    }

    return { deleted: false, deletedJobId: null, remainingPhotoCount: 0 };
  }

  const deleted = await deleteScrapeJobById(job.id);
  return {
    deleted,
    deletedJobId: deleted ? job.id : null,
    remainingPhotoCount: 0,
  };
};

const shouldRequirePhotos = (value) =>
  ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());

const cleanListedScrapeJobs = async (jobs, { requirePhotos = false } = {}) => {
  const cleaned = await Promise.all(
    jobs.map(async (job) => {
      if (!requirePhotos && isActiveJob(job)) {
        return job;
      }

      const cleanup = await deleteScrapeJobIfEmpty(job);
      if (cleanup.deleted) return null;
      if (requirePhotos && cleanup.remainingPhotoCount === 0) return null;

      return {
        ...job,
        photoCount: cleanup.remainingPhotoCount,
      };
    })
  );

  return cleaned.filter(Boolean);
};

const fetchImageBuffer = async (photo) => {
  const imageUrl = photo.originalImageUrl || photo.imageUrl;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TwinsThroughTime/1.0 photo-download',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type'),
      imageUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
};

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
  const { status, page, limit, withPhotos } = req.query;
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

  const data = await cleanListedScrapeJobs(result.data, {
    requirePhotos: shouldRequirePhotos(withPhotos),
  });

  return res.status(200).json({
    ...result,
    data,
    total: data.length,
  });
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
// POST /scrape-jobs/:id/photos/download  🔒
// ---------------------------------------------------------------------------
export const downloadScrapeJobPhotos = async (req, res) => {
  const job = await getJobForUser(req, res);
  if (!job) return;

  const { filter = 'all', photoIds = [], threshold: rawThreshold } = req.body ?? {};
  const threshold = normalizeConfidenceThreshold(rawThreshold);
  const validFilters = ['all', 'passed', 'flagged', 'selected'];

  if (!validFilters.includes(filter)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `filter must be one of: ${validFilters.join(', ')}.`)
    );
  }

  if (filter === 'selected' && (!Array.isArray(photoIds) || photoIds.length === 0)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', '`photoIds` is required when filter is selected.')
    );
  }

  const photos = await findAllPhotosForScrapeJob({
    scrapeJobId: job.id,
    submittedBy: req.user.accountType === 'admin' ? undefined : req.user.id,
  });
  const selectedPhotos = pickPhotos({ photos, filter, photoIds, threshold });

  if (!selectedPhotos) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `filter must be one of: ${validFilters.join(', ')}.`)
    );
  }

  if (selectedPhotos.length === 0) {
    return res.status(422).json(
      errBody('UNPROCESSABLE', 'No photos matched this download request.')
    );
  }

  const entries = [];
  const skipped = [];

  for (let index = 0; index < selectedPhotos.length; index += 1) {
    const photo = selectedPhotos[index];

    try {
      const { buffer, contentType, imageUrl } = await fetchImageBuffer(photo);
      const ext = extensionFrom(imageUrl, contentType);
      const namePart = sanitizeFilePart(photo.name, `photo-${index + 1}`);
      const idPart = String(photo.id).slice(0, 8);

      entries.push({
        name: `${String(index + 1).padStart(3, '0')}-${namePart}-${idPart}${ext}`,
        data: buffer,
      });
    } catch (error) {
      skipped.push({
        id: photo.id,
        imageUrl: photo.originalImageUrl || photo.imageUrl,
        reason: error?.message || 'Unknown fetch error',
      });
    }
  }

  if (skipped.length > 0) {
    const lines = skipped.map(
      (item) => `${item.id}\t${item.imageUrl}\t${item.reason}`
    );
    entries.push({
      name: 'skipped-images.txt',
      data: Buffer.from(['photoId\timageUrl\treason', ...lines].join('\n'), 'utf8'),
    });
  }

  if (entries.length === 0) {
    entries.push({
      name: 'skipped-images.txt',
      data: Buffer.from('All requested images failed to download from their source URLs.', 'utf8'),
    });
  }

  const zipBuffer = createZip(entries);
  const filename = `scrape-job-${job.id}-${filter}-photos.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', zipBuffer.length);
  return res.status(200).send(zipBuffer);
};

// ---------------------------------------------------------------------------
// DELETE /scrape-jobs/:id/photos  🔒
// ---------------------------------------------------------------------------
export const deleteScrapeJobPhotos = async (req, res) => {
  const job = await getJobForUser(req, res);
  if (!job) return;

  const { filter, photoIds = [], threshold: rawThreshold } = req.body ?? {};
  const threshold = normalizeConfidenceThreshold(rawThreshold);
  const validFilters = ['passed', 'flagged', 'selected'];

  if (!validFilters.includes(filter)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `filter must be one of: ${validFilters.join(', ')}.`)
    );
  }

  if (filter === 'selected' && (!Array.isArray(photoIds) || photoIds.length === 0)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', '`photoIds` is required when filter is selected.')
    );
  }

  const photos = await findAllPhotosForScrapeJob({
    scrapeJobId: job.id,
    submittedBy: req.user.accountType === 'admin' ? undefined : req.user.id,
  });
  const selectedPhotos = pickPhotos({ photos, filter, photoIds, threshold });

  if (!selectedPhotos) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `filter must be one of: ${validFilters.join(', ')}.`)
    );
  }

  const selectedIds = selectedPhotos.map((photo) => photo.id);
  const deletedIds = await deletePhotosByIdsForScrapeJob({
    scrapeJobId: job.id,
    photoIds: selectedIds,
  });

  const cleanup = await deleteScrapeJobIfEmpty(job);

  return res.status(200).json({
    deletedCount: deletedIds.length,
    deletedIds,
    remainingPhotoCount: cleanup.remainingPhotoCount,
    scrapeJobDeleted: cleanup.deleted,
    deletedScrapeJobId: cleanup.deletedJobId,
  });
};

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

