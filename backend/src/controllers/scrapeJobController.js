/**
 * scrapeJobController.js
 * ----------------------
 * Handles §4 Scrape Jobs API (docs/apis.md):
 *
 *   POST   /scrape-jobs      submitScrapeJob   🔒
 *   GET    /scrape-jobs      listScrapeJobs    🔒
 *   GET    /scrape-jobs/:id  getScrapeJob      🔒
 *   DELETE /scrape-jobs/:id  cancelScrapeJob   🔒
 */

import { validateScrapeUrl } from '../utils/validators.js';
import {
  createScrapeJob,
  findScrapeJobById,
  findScrapeJobs,
  updateScrapeJob,
} from '../models/scrapeJobModel.js';
import { processScrapeJob } from '../utils/scrapeProcessor.js';

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

  setTimeout(() => {
    processScrapeJob(job.id).catch((err) => {
      console.error(`[scrape-jobs] failed to process job ${job.id}:`, err);
      updateScrapeJob(job.id, {
        status: 'failed',
        errorMessage: err?.message || 'Scrape failed.',
        completedAt: new Date().toISOString(),
      }).catch((updateErr) => {
        console.error(`[scrape-jobs] failed to mark job ${job.id} failed:`, updateErr);
      });
    });
  }, 0);

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
