/**
 * test-admin.mjs
 * Full end-to-end test suite for the Admin API (§8 in docs/apis.md).
 */

const BASE = 'http://localhost:3000';

const req = async (method, path, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed };
};

const pass = (label) => console.log('  ✅ ' + label);
const fail = (label, got) =>
  console.log('  ❌ ' + label + '\n       status=' + got.status + '  body=' + JSON.stringify(got.body));
const section = (s) => console.log('\n── ' + s);

// ── Seed ──────────────────────────────────────────────────────────────────────
section('Seeding test data');
const seed = await req('POST', '/api/test/seed');
const { userToken, adminToken, user, admin } = seed.body;
pass(`user: ${user.username} (${user.id})`);
pass(`admin: ${admin.username} (${admin.id})`);

// ── 1. POST /admin/invite-link ────────────────────────────────────────────────
section('1. POST /admin/invite-link');

let r = await req('POST', '/api/admin/invite-link', { expiresInHours: 24 }, adminToken);
const { inviteToken, inviteUrl, expiresAt } = r.body;
if (r.status === 201 && inviteToken && inviteUrl.includes(inviteToken) && expiresAt) {
  pass(`Invite link generated (201) — token=${inviteToken.slice(0, 8)}...`);
} else {
  fail('Generate invite link', r);
}

// Default expiresInHours (omitted)
r = await req('POST', '/api/admin/invite-link', {}, adminToken);
if (r.status === 201 && r.body.inviteToken) pass('Generates invite with default expiresInHours (201)');
else fail('Default expiresInHours', r);

// Invalid expiresInHours
r = await req('POST', '/api/admin/invite-link', { expiresInHours: 0 }, adminToken);
if (r.status === 400) pass('Rejects expiresInHours=0 (400)');
else fail('Should 400 for expiresInHours=0', r);

r = await req('POST', '/api/admin/invite-link', { expiresInHours: 999 }, adminToken);
if (r.status === 400) pass('Rejects expiresInHours > 720 (400)');
else fail('Should 400 for expiresInHours > 720', r);

r = await req('POST', '/api/admin/invite-link', { expiresInHours: 'tomorrow' }, adminToken);
if (r.status === 400) pass('Rejects non-integer expiresInHours (400)');
else fail('Should 400 for non-integer', r);

// Non-admin is forbidden
r = await req('POST', '/api/admin/invite-link', { expiresInHours: 24 }, userToken);
if (r.status === 403) pass('Non-admin is forbidden (403)');
else fail('Should 403 for non-admin', r);

// Unauthenticated
r = await req('POST', '/api/admin/invite-link', { expiresInHours: 24 });
if (r.status === 401) pass('Rejects unauthenticated request (401)');
else fail('Should 401 without token', r);

// ── 2. GET /admin/users ───────────────────────────────────────────────────────
section('2. GET /admin/users');

r = await req('GET', '/api/admin/users', null, adminToken);
if (r.status === 200 && Array.isArray(r.body.data) && r.body.total >= 2) {
  pass(`Admin lists all users (total=${r.body.total}), passwordHash absent=${!('passwordHash' in r.body.data[0])}`);
} else {
  fail('Admin list users', r);
}

// Pagination
r = await req('GET', '/api/admin/users?page=1&limit=1', null, adminToken);
if (r.status === 200 && r.body.data.length === 1 && r.body.limit === 1) {
  pass('Pagination works — limit=1 returns 1 record');
} else {
  fail('Pagination', r);
}

// Filter by accountType
r = await req('GET', '/api/admin/users?accountType=admin', null, adminToken);
if (r.status === 200 && r.body.data.every((u) => u.accountType === 'admin')) {
  pass(`Filters by accountType=admin (${r.body.data.length} result(s))`);
} else {
  fail('Filter by accountType', r);
}

r = await req('GET', '/api/admin/users?accountType=community_member', null, adminToken);
if (r.status === 200 && r.body.data.every((u) => u.accountType === 'community_member')) {
  pass(`Filters by accountType=community_member (${r.body.data.length} result(s))`);
} else {
  fail('Filter by community_member', r);
}

// Invalid accountType filter
r = await req('GET', '/api/admin/users?accountType=superuser', null, adminToken);
if (r.status === 400) pass('Rejects invalid accountType filter (400)');
else fail('Should 400 for invalid accountType', r);

// Filter by isActive
r = await req('GET', '/api/admin/users?isActive=true', null, adminToken);
if (r.status === 200 && r.body.data.every((u) => u.isActive === true)) {
  pass(`Filters by isActive=true (${r.body.total} result(s))`);
} else {
  fail('Filter by isActive=true', r);
}

// Invalid isActive
r = await req('GET', '/api/admin/users?isActive=maybe', null, adminToken);
if (r.status === 400) pass('Rejects invalid isActive value (400)');
else fail('Should 400 for invalid isActive', r);

// Search by username
r = await req('GET', '/api/admin/users?search=jsmith', null, adminToken);
if (r.status === 200 && r.body.data.some((u) => u.username === 'jsmith')) {
  pass('Search by username "jsmith"');
} else {
  fail('Search by username', r);
}

// Search by email fragment
r = await req('GET', '/api/admin/users?search=example.com', null, adminToken);
if (r.status === 200 && r.body.total >= 1) pass('Search by email fragment "example.com"');
else fail('Search by email', r);

// Non-admin is forbidden
r = await req('GET', '/api/admin/users', null, userToken);
if (r.status === 403) pass('Non-admin is forbidden from listing users (403)');
else fail('Should 403 for non-admin', r);

// Unauthenticated
r = await req('GET', '/api/admin/users');
if (r.status === 401) pass('Rejects unauthenticated list (401)');
else fail('Should 401 without token', r);

// ── 3. PATCH /admin/users/:id/deactivate ──────────────────────────────────────
section('3. PATCH /admin/users/:id/deactivate');

// Seed a second non-admin user to deactivate
const seed2 = await req('POST', '/api/test/seed');
const targetUserId = seed2.body.user.id;

r = await req('PATCH', `/api/admin/users/${targetUserId}/deactivate`, null, adminToken);
if (r.status === 200 && r.body.isActive === false && r.body.id === targetUserId) {
  pass('Admin deactivates a user (200) — isActive=false');
} else {
  fail('Deactivate user', r);
}

// Cannot deactivate already-inactive user
r = await req('PATCH', `/api/admin/users/${targetUserId}/deactivate`, null, adminToken);
if (r.status === 422) pass('Cannot deactivate already-inactive user (422)');
else fail('Should 422 for already-inactive', r);

// Cannot deactivate own account
r = await req('PATCH', `/api/admin/users/${admin.id}/deactivate`, null, adminToken);
if (r.status === 422) pass('Cannot deactivate own account (422)');
else fail('Should 422 for self-deactivation', r);

// User not found
r = await req('PATCH', '/api/admin/users/non-existent-id/deactivate', null, adminToken);
if (r.status === 404) pass('Returns 404 for unknown user');
else fail('Should 404 for unknown user', r);

// Non-admin is forbidden
r = await req('PATCH', `/api/admin/users/${targetUserId}/deactivate`, null, userToken);
if (r.status === 403) pass('Non-admin is forbidden from deactivating (403)');
else fail('Should 403 for non-admin deactivate', r);

// Deactivated user does not appear in isActive=true filter
r = await req('GET', `/api/admin/users?isActive=false`, null, adminToken);
if (r.status === 200 && r.body.data.some((u) => u.id === targetUserId)) {
  pass('Deactivated user appears in isActive=false filter');
} else {
  fail('Deactivated user should appear in isActive=false', r);
}

// ── 4. GET /admin/dashboard/stats ─────────────────────────────────────────────
section('4. GET /admin/dashboard/stats');

r = await req('GET', '/api/admin/dashboard/stats', null, adminToken);
if (
  r.status === 200 &&
  typeof r.body.totalUsers       === 'number' &&
  typeof r.body.totalScrapeJobs  === 'number' &&
  typeof r.body.totalPhotos      === 'number' &&
  typeof r.body.pendingRequests  === 'number' &&
  typeof r.body.approvedRequests === 'number' &&
  typeof r.body.onboardedPhotos  === 'number'
) {
  pass(`Dashboard stats returned (200) — totalUsers=${r.body.totalUsers}, totalPhotos=${r.body.totalPhotos}`);
} else {
  fail('Dashboard stats', r);
}

// Non-admin is forbidden
r = await req('GET', '/api/admin/dashboard/stats', null, userToken);
if (r.status === 403) pass('Non-admin is forbidden from dashboard stats (403)');
else fail('Should 403 for non-admin stats', r);

// Unauthenticated
r = await req('GET', '/api/admin/dashboard/stats');
if (r.status === 401) pass('Rejects unauthenticated stats (401)');
else fail('Should 401 without token', r);

console.log('\n── Done ──────────────────────────────────────────────────────\n');
