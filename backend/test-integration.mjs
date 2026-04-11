/**
 * test-integration.mjs
 * --------------------
 * End-to-end HTTP integration tests for the Twins-Through-Time backend.
 * Requires the server to be running on PORT (default 3000).
 *
 * Tests:
 *   §0 Health check
 *   §1 Auth — register, login, refresh, logout, duplicate-register guard
 *   §2 Scrape Jobs (user) — submit, list, get, cancel
 *   §3 Scrape Jobs (worker) — PATCH status, POST photo, wrong-secret rejection
 *   §4 Photos — list via user route
 *   §5 Cleanup — delete the photo + job created during tests
 *
 * Usage:
 *   node backend/test-integration.mjs
 *   node backend/test-integration.mjs --base http://localhost:4000
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const args      = process.argv.slice(2);
const baseFlag  = args.find(a => a.startsWith('--base='))?.split('=')[1]
               ?? args[args.indexOf('--base') + 1];
const BASE_URL  = baseFlag ?? `http://localhost:${process.env.PORT ?? 3000}`;
const SECRET    = process.env.WORKER_SECRET ?? '';

// Unique suffix so repeated runs don't clash
const RUN_ID    = Date.now().toString(36);
const TEST_USER = {
  username:  `integtest_${RUN_ID}`,
  email:     `integtest_${RUN_ID}@test-ttt.local`,
  password:  'TestPass1!',
  firstName: 'Integration',
  lastName:  'Test',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

function ok(label) {
  console.log(`  ✅  ${label}`);
  passed++;
}

function fail(label, reason) {
  console.error(`  ❌  ${label}`);
  console.error(`       ${reason}`);
  failed++;
  failures.push({ label, reason });
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}`);
}

async function req(method, path, { body, token, workerSecret } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token)        headers['Authorization']  = `Bearer ${token}`;
  if (workerSecret) headers['X-Worker-Secret'] = workerSecret;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  const ct = res.headers.get('content-type') ?? '';
  try {
    data = ct.includes('json') ? await res.json() : await res.text();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function assertStatus(label, res, expected) {
  if (res.status === expected) {
    ok(`${label} → ${res.status}`);
    return true;
  }
  fail(`${label} → expected ${expected}, got ${res.status}`, JSON.stringify(res.data));
  return false;
}

function assertField(label, value, check, desc) {
  if (check(value)) {
    ok(`${label} has ${desc}`);
    return true;
  }
  fail(`${label} missing ${desc}`, `got: ${JSON.stringify(value)}`);
  return false;
}

// ---------------------------------------------------------------------------
// State shared across tests
// ---------------------------------------------------------------------------
let accessToken  = null;
let refreshToken = null;
let jobId        = null;
let photoId      = null;

// ---------------------------------------------------------------------------
// §0 Health
// ---------------------------------------------------------------------------
async function testHealth() {
  section('§0 Health');
  const res = await req('GET', '/api/health');
  assertStatus('GET /api/health', res, 200);
  assertField('health.status', res.data?.status, v => v === 'ok', '"ok"');
}

// ---------------------------------------------------------------------------
// §1 Auth
// ---------------------------------------------------------------------------
async function testAuth() {
  section('§1 Auth');

  // Register
  let res = await req('POST', '/api/auth/register', { body: TEST_USER });
  if (!assertStatus('POST /api/auth/register', res, 201)) return;
  assertField('register body', res.data, d => d?.token, 'token');
  accessToken  = res.data.token;
  refreshToken = res.data.refreshToken;

  // Duplicate register must be rejected
  res = await req('POST', '/api/auth/register', { body: TEST_USER });
  assertStatus('POST /api/auth/register (duplicate)', res, 409);

  // Login (uses email + password)
  res = await req('POST', '/api/auth/login', {
    body: { email: TEST_USER.email, password: TEST_USER.password },
  });
  if (!assertStatus('POST /api/auth/login', res, 200)) return;
  assertField('login body', res.data, d => d?.token, 'token');
  accessToken  = res.data.token;
  refreshToken = res.data.refreshToken ?? refreshToken;

  // Refresh token
  if (refreshToken) {
    res = await req('POST', '/api/auth/refresh', { body: { refreshToken } });
    if (assertStatus('POST /api/auth/refresh', res, 200)) {
      accessToken  = res.data.token ?? accessToken;
      refreshToken = res.data.refreshToken ?? refreshToken;
    }
  } else {
    fail('POST /api/auth/refresh', 'No refreshToken returned by login — skipped');
  }

  // Authenticated profile fetch
  res = await req('GET', '/api/account/profile', { token: accessToken });
  assertStatus('GET /api/account/profile', res, 200);
  assertField('/api/account/profile body', res.data, d => d?.username === TEST_USER.username, `username=${TEST_USER.username}`);

  // Bad token rejected
  res = await req('GET', '/api/account/profile', { token: 'bad.token.value' });
  assertStatus('GET /api/account/profile (bad token)', res, 401);
}

// ---------------------------------------------------------------------------
// §2 Scrape Jobs — user-facing routes
// ---------------------------------------------------------------------------
async function testScrapeJobsUser() {
  section('§2 Scrape Jobs (user routes)');

  if (!accessToken) {
    fail('Scrape job tests', 'No accessToken — auth tests must have failed');
    return;
  }

  // Submit without auth → 401
  let res = await req('POST', '/api/scrape-jobs', {
    body: { url: 'https://example.com', maxPhotos: 2 },
  });
  assertStatus('POST /api/scrape-jobs (no auth)', res, 401);

  // Submit with invalid URL → 400
  res = await req('POST', '/api/scrape-jobs', {
    token: accessToken,
    body: { url: 'not-a-url', maxPhotos: 2 },
  });
  assertStatus('POST /api/scrape-jobs (bad url)', res, 400);

  // Submit valid job (worker will be spawned but fail immediately — that's fine for testing)
  res = await req('POST', '/api/scrape-jobs', {
    token: accessToken,
    body: { url: 'https://example.com', maxPhotos: 2 },
  });
  if (!assertStatus('POST /api/scrape-jobs', res, 201)) return;
  assertField('job body', res.data, d => d?.id, 'id');
  assertField('job body', res.data, d => d?.status === 'queued', 'status=queued');
  jobId = res.data.id;
  console.log(`       job id: ${jobId}`);

  // List jobs
  res = await req('GET', '/api/scrape-jobs', { token: accessToken });
  assertStatus('GET /api/scrape-jobs', res, 200);
  assertField('list body', res.data, d => Array.isArray(d?.data), 'data array');

  // Get job by id
  res = await req('GET', `/api/scrape-jobs/${jobId}`, { token: accessToken });
  assertStatus(`GET /api/scrape-jobs/${jobId}`, res, 200);
  assertField('get job', res.data, d => d?.id === jobId, `id=${jobId}`);

  // Get non-existent job → 404
  res = await req('GET', '/api/scrape-jobs/00000000-0000-0000-0000-000000000000', { token: accessToken });
  assertStatus('GET /api/scrape-jobs/<missing>', res, 404);
}

// ---------------------------------------------------------------------------
// §3 Scrape Jobs — worker routes
// ---------------------------------------------------------------------------
async function testScrapeJobsWorker() {
  section('§3 Scrape Jobs (worker routes)');

  if (!jobId) {
    fail('Worker route tests', 'No jobId — user job tests must have failed');
    return;
  }

  // Wrong secret → 401
  let res = await req('PATCH', `/api/scrape-jobs/${jobId}`, {
    workerSecret: 'wrong-secret',
    body: { status: 'running' },
  });
  assertStatus('PATCH /:id (wrong secret)', res, 401);

  // No secret → 401
  res = await req('PATCH', `/api/scrape-jobs/${jobId}`, {
    body: { status: 'running' },
  });
  assertStatus('PATCH /:id (no secret)', res, 401);

  // Valid PATCH → running
  res = await req('PATCH', `/api/scrape-jobs/${jobId}`, {
    workerSecret: SECRET,
    body: { status: 'running' },
  });
  if (assertStatus('PATCH /:id status=running (correct secret)', res, 200)) {
    assertField('patch result', res.data, d => d?.status === 'running', 'status=running');
  }

  // Invalid status value → 400
  res = await req('PATCH', `/api/scrape-jobs/${jobId}`, {
    workerSecret: SECRET,
    body: { status: 'invalid-status' },
  });
  assertStatus('PATCH /:id (invalid status)', res, 400);

  // POST photo — missing imageUrl → 400
  res = await req('POST', `/api/scrape-jobs/${jobId}/photos`, {
    workerSecret: SECRET,
    body: { name: 'No image url here' },
  });
  assertStatus('POST /:id/photos (missing imageUrl)', res, 400);

  // POST photo — valid payload
  res = await req('POST', `/api/scrape-jobs/${jobId}/photos`, {
    workerSecret: SECRET,
    body: {
      imageUrl:   'https://example.com/soldier.jpg',
      name:       'Sgt. John Test',
      regiment:   '42nd Infantry',
      tags:       ['union', 'portrait'],
      collection: 'Test Collection',
    },
  });
  if (assertStatus('POST /:id/photos (valid)', res, 201)) {
    assertField('photo body', res.data, d => d?.id, 'id');
    assertField('photo body', res.data, d => d?.scrapeJobId === jobId, `scrapeJobId=${jobId}`);
    assertField('photo body', res.data, d => d?.imageUrl === 'https://example.com/soldier.jpg', 'imageUrl');
    photoId = res.data.id;
    console.log(`       photo id: ${photoId}`);
  }

  // Wrong secret on photos route → 401
  res = await req('POST', `/api/scrape-jobs/${jobId}/photos`, {
    workerSecret: 'wrong-secret',
    body: { imageUrl: 'https://example.com/x.jpg' },
  });
  assertStatus('POST /:id/photos (wrong secret)', res, 401);

  // PATCH → completed
  res = await req('PATCH', `/api/scrape-jobs/${jobId}`, {
    workerSecret: SECRET,
    body: { status: 'completed' },
  });
  if (assertStatus('PATCH /:id status=completed', res, 200)) {
    assertField('patch result', res.data, d => d?.status === 'completed', 'status=completed');
    assertField('patch result', res.data, d => !!d?.completedAt, 'completedAt set');
  }
}

// ---------------------------------------------------------------------------
// §4 Photos — user list route
// ---------------------------------------------------------------------------
async function testPhotos() {
  section('§4 Photos (user routes)');

  if (!accessToken) {
    fail('Photo list test', 'No accessToken');
    return;
  }

  // List photos (should include our newly ingested one)
  const res = await req('GET', '/api/photos', { token: accessToken });
  assertStatus('GET /api/photos', res, 200);
  assertField('photos list', res.data, d => Array.isArray(d?.data), 'data array');

  if (photoId) {
    const found = res.data?.data?.some(p => p.id === photoId);
    if (found) {
      ok(`GET /api/photos contains ingested photo ${photoId}`);
    } else {
      fail(`GET /api/photos`, `photo ${photoId} not found in list`);
    }
  }
}

// ---------------------------------------------------------------------------
// §5 Cleanup
// ---------------------------------------------------------------------------
async function testCleanup() {
  section('§5 Cleanup');

  if (!jobId) {
    console.log('  ⚠️   No job to clean up.');
    return;
  }

  // Cancel the completed job — should fail with 422 (already completed)
  let res = await req('DELETE', `/api/scrape-jobs/${jobId}`, { token: accessToken });
  assertStatus(`DELETE /api/scrape-jobs/${jobId} (completed job)`, res, 422);

  console.log(`  ℹ️   Job ${jobId} and photo ${photoId ?? 'n/a'} remain in DB.`);
  console.log('  ℹ️   To remove them, delete via Supabase dashboard or add a cleanup script.');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function run() {
  console.log('═'.repeat(60));
  console.log(`  Twins-Through-Time — Integration Tests`);
  console.log(`  Target: ${BASE_URL}`);
  console.log('═'.repeat(60));

  // Check server is up before running anything
  try {
    const ping = await fetch(`${BASE_URL}/api/health`);
    if (!ping.ok) throw new Error(`status ${ping.status}`);
  } catch (err) {
    console.error(`\n❌  Cannot reach ${BASE_URL}/api/health — is the server running?\n`);
    console.error(`    Start it with:  cd backend && node src/index.js\n`);
    process.exit(1);
  }

  await testHealth();
  await testAuth();
  await testScrapeJobsUser();
  await testScrapeJobsWorker();
  await testPhotos();
  await testCleanup();

  // Summary
  const total = passed + failed;
  console.log('\n' + '═'.repeat(60));
  console.log(`  Results: ${passed}/${total} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\n  Failed tests:');
    failures.forEach(f => console.log(`    ❌  ${f.label}`));
  }
  console.log('═'.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

run();
