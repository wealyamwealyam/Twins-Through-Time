/**
 * scrapeJobRoutes.js
 * ------------------
 * §4 Scrape Jobs API — mounted at /api/scrape-jobs in server.js
 * All routes require authentication.
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import {
  submitScrapeJob,
  listScrapeJobs,
  getScrapeJob,
  cancelScrapeJob,
} from '../controllers/scrapeJobController.js';

const router = Router();

router.use(authenticate);

router.post(  '/',    submitScrapeJob);
router.get(   '/',    listScrapeJobs);
router.get(   '/:id', getScrapeJob);
router.delete('/:id', cancelScrapeJob);

export default router;
