/**
 * scrapeJobService.js
 * -------------------
 * Wraps the §4 Scrape Jobs API endpoints.
 */

import { apiFetch } from "./api.js";

/**
 * Submit a new scrape job.
 * @param {{ url: string, maxPhotos?: number }} data
 * @returns {Promise<object>} created scrape job
 */
export async function createScrapeJob({ url, maxPhotos = 3 }) {
  return apiFetch("/api/scrape-jobs", {
    method: "POST",
    body:   JSON.stringify({ url, maxPhotos }),
  });
}

/**
 * List scrape jobs for the current user (or all if admin).
 * @param {{ status?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
 */
export async function getScrapeJobs({ status, page = 1, limit = 20 } = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  qs.set("page",  String(page));
  qs.set("limit", String(limit));
  return apiFetch(`/api/scrape-jobs?${qs}`);
}

/**
 * Fetch a single scrape job by id.
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getScrapeJob(id) {
  return apiFetch(`/api/scrape-jobs/${id}`);
}

/**
 * Cancel a queued or running scrape job.
 * @param {string} id
 */
export async function cancelScrapeJob(id) {
  return apiFetch(`/api/scrape-jobs/${id}`, { method: "DELETE" });
}
