import { createPhoto } from '../models/photoModel.js';
import { findScrapeJobById, updateScrapeJob } from '../models/scrapeJobModel.js';

const IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i;
const IMAGE_ATTR_RE = /\b(?:src|data-src|data-original|data-full|href)\s*=\s*["']([^"']+)["']/gi;
const TITLE_RE = /<title[^>]*>([^<]+)<\/title>/i;
const ALT_RE = /\balt\s*=\s*["']([^"']+)["']/i;
const RUNNING_VISIBLE_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function isLikelyImageUrl(value) {
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) {
    return false;
  }

  return IMAGE_EXTENSIONS.test(value);
}

function toAbsoluteUrl(value, pageUrl) {
  try {
    return new URL(decodeHtml(value), pageUrl).toString();
  } catch {
    return null;
  }
}

function extractPageTitle(html) {
  const match = html.match(TITLE_RE);
  return match ? decodeHtml(match[1]).slice(0, 200) : null;
}

function extractImages(html, pageUrl, maxPhotos) {
  const images = [];
  const seen = new Set();
  let match;

  while ((match = IMAGE_ATTR_RE.exec(html)) !== null && images.length < maxPhotos) {
    const rawUrl = match[1];
    if (!isLikelyImageUrl(rawUrl)) continue;

    const imageUrl = toAbsoluteUrl(rawUrl, pageUrl);
    if (!imageUrl || seen.has(imageUrl)) continue;

    const nearbyHtml = html.slice(Math.max(0, match.index - 300), Math.min(html.length, match.index + 600));
    const alt = nearbyHtml.match(ALT_RE)?.[1];

    seen.add(imageUrl);
    images.push({
      imageUrl,
      name: alt ? decodeHtml(alt).slice(0, 200) : null,
    });
  }

  return images;
}

export async function processScrapeJob(jobId) {
  const job = await findScrapeJobById(jobId);
  if (!job || job.status !== 'queued') {
    return;
  }

  await updateScrapeJob(job.id, {
    status: 'running',
    errorMessage: null,
    startedAt: new Date().toISOString(),
  });

  try {
    await sleep(RUNNING_VISIBLE_MS);

    const response = await fetch(job.url, {
      headers: {
        'User-Agent': 'TwinsThroughTimeScraper/0.1 (+local capstone project)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const latest = await findScrapeJobById(job.id);
    if (!latest || latest.status === 'cancelled') {
      return;
    }

    if (!response.ok) {
      throw new Error(`Source returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.includes('text/html')) {
      throw new Error('Source did not return an HTML page.');
    }

    const html = await response.text();
    const collection = extractPageTitle(html);
    const images = extractImages(html, job.url, job.maxPhotos);

    for (const image of images) {
      await createPhoto({
        scrapeJobId: job.id,
        submittedBy: job.submittedBy,
        imageUrl: image.imageUrl,
        name: image.name,
        collection,
        isAutoExtracted: true,
      });
    }

    const completedJob = await findScrapeJobById(job.id);
    if (!completedJob || completedJob.status === 'cancelled') {
      return;
    }

    await updateScrapeJob(job.id, {
      status: 'completed',
      photoCount: images.length,
      errorMessage: null,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[scrape-jobs] scrape job ${job.id} failed:`, error);

    const latest = await findScrapeJobById(job.id);
    if (!latest || latest.status === 'cancelled') {
      return;
    }

    await updateScrapeJob(job.id, {
      status: 'failed',
      errorMessage: error?.message || 'Scrape failed.',
      completedAt: new Date().toISOString(),
    });
  }
}
