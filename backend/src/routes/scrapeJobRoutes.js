/**
 * scrapeJobRoutes.js
 * ------------------
 * §4 Scrape Jobs API — mounted at /api/scrape-jobs in server.js
 *
 * User routes (JWT auth):
 *   POST   /             submitScrapeJob
 *   GET    /             listScrapeJobs
 *   GET    /:id          getScrapeJob
 *   DELETE /:id          cancelScrapeJob
 *
 * Worker routes (X-Worker-Secret header):
 *   PATCH  /:id          updateJobStatus   — worker reports running/completed/failed
 *   POST   /:id/photos   ingestPhoto       — worker streams each extracted photo
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import authenticateWorker from '../middleware/authenticateWorker.js';
import {
  submitScrapeJob,
  listScrapeJobs,
  getScrapeJob,
  cancelScrapeJob,
  updateJobStatus,
  ingestPhoto,
} from '../controllers/scrapeJobController.js';

const router = Router();

// User-facing routes (JWT required)
router.post(  '/',    authenticate, submitScrapeJob);
router.get(   '/',    authenticate, listScrapeJobs);
router.get(   '/:id', authenticate, getScrapeJob);
router.delete('/:id', authenticate, cancelScrapeJob);

// Worker-facing routes (internal secret required)
router.patch('/:id',         authenticateWorker, updateJobStatus);
router.post( '/:id/photos',  authenticateWorker, ingestPhoto);

export default router;
