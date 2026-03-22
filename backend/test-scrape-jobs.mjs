/**
 * test-scrape-jobs.mjs
 * --------------------
 * Integration tests for §4 Scrape Jobs API
 *
 * Run: node test-scrape-jobs.mjs
 */

const BASE = 'http://localhost:3000/api';

let pass = 0;
let fail = 0;

const check = (label, ok, extra = '') => {
  if (ok) { console.log(`  ✅ ${label}`); pass++; }
  else     { console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); fail++; }
};

const req = (method, path, body, token) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const post   = (path, body, token) => req('POST',   path, body, token);
const get    = (path, token)       => req('GET',    path, undefined, token);
const del    = (path, token)       => req('DELETE', path, undefined, token);

// ── Seed ─────────────────────────────────────────────────────────────────────
console.log('\n── Seeding test data');
const seed    = await post('/test/seed', {});
const sData   = await seed.json();
const userToken  = sData.userToken;
const adminToken = sData.adminToken;
const userId     = sData.user.id;
console.log(`  ✅ user: ${sData.user.username}`);
console.log(`  ✅ admin: ${sData.admin.username}`);

const VALID_URL = 'https://www.civilwarsleuth.com/photos';

// ── 1. POST /scrape-jobs ─────────────────────────────────────────────────────
console.log('\n── 1. POST /scrape-jobs');

let job1Id, job2Id;

{
  const r = await post('/scrape-jobs', { url: VALID_URL, maxPhotos: 10 }, userToken);
  const body = await r.json();
  check('201 on valid submission', r.status === 201);
  check('Returns id', typeof body.id === 'string');
  check('Status is queued', body.status === 'queued');
  check('url matches', body.url === VALID_URL);
  check('maxPhotos matches', body.maxPhotos === 10);
  check('submittedBy matches user id', body.submittedBy === userId);
  job1Id = body.id;
}

{
  // Default maxPhotos
  const r = await post('/scrape-jobs', { url: VALID_URL }, userToken);
  const body = await r.json();
  check('201 with default maxPhotos=50', r.status === 201 && body.maxPhotos === 50);
  job2Id = body.id;
}

{
  // Invalid URL — private/loopback
  const r = await post('/scrape-jobs', { url: 'http://localhost/data' }, userToken);
  check('400 on localhost URL (SSRF)', r.status === 400);
}

{
  const r = await post('/scrape-jobs', { url: 'http://192.168.1.1/data' }, userToken);
  check('400 on private IP URL', r.status === 400);
}

{
  const r = await post('/scrape-jobs', { url: 'ftp://example.com/file' }, userToken);
  check('400 on non-http/https URL', r.status === 400);
}

{
  const r = await post('/scrape-jobs', { url: 'not-a-url' }, userToken);
  check('400 on invalid URL string', r.status === 400);
}

{
  const r = await post('/scrape-jobs', { url: VALID_URL, maxPhotos: 0 }, userToken);
  check('400 on maxPhotos=0', r.status === 400);
}

{
  const r = await post('/scrape-jobs', { url: VALID_URL, maxPhotos: 501 }, userToken);
  check('400 on maxPhotos > 500', r.status === 400);
}

{
  // Unauthenticated
  const r = await post('/scrape-jobs', { url: VALID_URL });
  check('401 when unauthenticated', r.status === 401);
}

// ── 2. GET /scrape-jobs ───────────────────────────────────────────────────────
console.log('\n── 2. GET /scrape-jobs');

{
  const r = await get('/scrape-jobs', userToken);
  const body = await r.json();
  check('200 for authenticated user', r.status === 200);
  check('Returns data array', Array.isArray(body.data));
  check('User only sees own jobs', body.data.every((j) => j.submittedBy === userId));
  check('Pagination fields present', typeof body.total === 'number' && typeof body.page === 'number');
}

{
  // Admin sees all jobs
  const r = await get('/scrape-jobs', adminToken);
  const body = await r.json();
  check('Admin sees all jobs (total ≥ user jobs)', r.status === 200);
}

{
  // Filter by status
  const r = await get('/scrape-jobs?status=queued', userToken);
  const body = await r.json();
  check('Filter by status=queued works', r.status === 200 && body.data.every((j) => j.status === 'queued'));
}

{
  const r = await get('/scrape-jobs?status=invalid', userToken);
  check('400 on invalid status filter', r.status === 400);
}

{
  // Pagination
  const r = await get('/scrape-jobs?limit=1&page=1', userToken);
  const body = await r.json();
  check('Pagination limit respected', r.status === 200 && body.data.length <= 1);
}

{
  const r = await get('/scrape-jobs');
  check('401 when unauthenticated', r.status === 401);
}

// ── 3. GET /scrape-jobs/:id ───────────────────────────────────────────────────
console.log('\n── 3. GET /scrape-jobs/:id');

{
  const r = await get(`/scrape-jobs/${job1Id}`, userToken);
  const body = await r.json();
  check('200 — owner can get own job', r.status === 200);
  check('Correct job returned', body.id === job1Id);
}

{
  // Admin can get any job
  const r = await get(`/scrape-jobs/${job1Id}`, adminToken);
  check('200 — admin can get any job', r.status === 200);
}

{
  // Submit a job as admin, then try to access it as user
  const adminJob = await post('/scrape-jobs', { url: VALID_URL }, adminToken);
  const adminJobBody = await adminJob.json();
  const r = await get(`/scrape-jobs/${adminJobBody.id}`, userToken);
  check('403 — user cannot access another user\'s job', r.status === 403);
}

{
  const r = await get('/scrape-jobs/00000000-0000-0000-0000-000000000000', userToken);
  check('404 on unknown job id', r.status === 404);
}

{
  const r = await get(`/scrape-jobs/${job1Id}`);
  check('401 when unauthenticated', r.status === 401);
}

// ── 4. DELETE /scrape-jobs/:id ────────────────────────────────────────────────
console.log('\n── 4. DELETE /scrape-jobs/:id');

{
  const r = await del(`/scrape-jobs/${job1Id}`, userToken);
  check('204 on valid cancellation', r.status === 204);
}

{
  // Cancelling an already-cancelled job should fail
  const r = await del(`/scrape-jobs/${job1Id}`, userToken);
  check('422 on cancelling already-cancelled job', r.status === 422);
}

{
  const r = await del('/scrape-jobs/00000000-0000-0000-0000-000000000000', userToken);
  check('404 on unknown job id', r.status === 404);
}

{
  // Create a job as admin, try to cancel it as user
  const adminJob = await post('/scrape-jobs', { url: VALID_URL }, adminToken);
  const adminJobBody = await adminJob.json();
  const r = await del(`/scrape-jobs/${adminJobBody.id}`, userToken);
  check('403 — user cannot cancel another user\'s job', r.status === 403);
}

{
  // Admin can cancel any job
  const newJob = await post('/scrape-jobs', { url: VALID_URL }, userToken);
  const newJobBody = await newJob.json();
  const r = await del(`/scrape-jobs/${newJobBody.id}`, adminToken);
  check('204 — admin can cancel any job', r.status === 204);
}

{
  const r = await del(`/scrape-jobs/${job2Id}`);
  check('401 when unauthenticated', r.status === 401);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n── Done ─────────────────────────────────────────────────────────────`);
console.log(`   ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
