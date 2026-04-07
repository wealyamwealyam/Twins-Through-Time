/**
 * scrapeJobModel.js
 * -----------------
 * In-memory store for ScrapedResult (scrape job) objects.
 *
 * Shape:
 * {
 *   id          : uuid
 *   url         : string
 *   maxPhotos   : integer          (1–500, default 50)
 *   status      : 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
 *   submittedBy : uuid
 *   photoCount  : integer
 *   startedAt   : ISO string | null
 *   completedAt : ISO string | null
 *   createdAt   : ISO string
 *   updatedAt   : ISO string
 * }
 */

import { randomUUID } from 'crypto';

const scrapeJobs = new Map(); // id → ScrapedResult

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

export const createScrapeJob = ({ url, maxPhotos = 50, submittedBy }) => {
  const job = {
    id:          randomUUID(),
    url,
    maxPhotos:   Math.min(Number(maxPhotos) || 50, 500),
    status:      'queued',
    submittedBy,
    photoCount:  0,
    startedAt:   null,
    completedAt: null,
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
  scrapeJobs.set(job.id, job);
  return job;
};

export const findScrapeJobById = (id) => scrapeJobs.get(id) ?? null;

export const findScrapeJobs = ({
  submittedBy = null,
  status      = null,
  page        = 1,
  limit       = 20,
} = {}) => {
  let list = [...scrapeJobs.values()];

  if (submittedBy) list = list.filter((j) => j.submittedBy === submittedBy);
  if (status)      list = list.filter((j) => j.status === status);

  // Newest first
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total     = list.length;
  const safePage  = Math.max(1, Number(page)  || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const data      = list.slice((safePage - 1) * safeLimit, safePage * safeLimit);

  return { data, total, page: safePage, limit: safeLimit };
};

export const updateScrapeJob = (id, updates) => {
  const job = scrapeJobs.get(id);
  if (!job) return null;
  const updated = { ...job, ...updates, id, updatedAt: new Date().toISOString() };
  scrapeJobs.set(id, updated);
  return updated;
};

/** Returns total count — used by Admin dashboard stats. */
export const countScrapeJobs = () => scrapeJobs.size;
