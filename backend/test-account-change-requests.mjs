/**
 * test-account-change-requests.mjs
 * Full end-to-end test suite for the Account Change Request API (§3).
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
  return { status: r.status, body: await r.json() };
};

const pass = (label) => console.log('  ✅ ' + label);
const fail = (label, got) =>
  console.log('  ❌ ' + label + '\n       status=' + got.status + '  body=' + JSON.stringify(got.body));
const section = (s) => console.log('\n── ' + s);

// ── Seed ──────────────────────────────────────────────────────────────────────
section('Seeding test users');
const seed = await req('POST', '/api/test/seed');
const { userToken, adminToken, user, admin } = seed.body;
pass(`Seeded community_member: ${user.username} (${user.id})`);
pass(`Seeded admin: ${admin.username} (${admin.id})`);

// ── 1. POST /account-change-requests ─────────────────────────────────────────
section('1. POST /account-change-requests');

// Valid submission
let r = await req('POST', '/api/account-change-requests', {
  requestingAccount: 'contributor',
  reasonMessage: 'I have been researching Civil War photographs for 5 years.',
}, userToken);
const changeReqId = r.body.id;
if (r.status === 201 && r.body.status === 'pending' && r.body.requestingAccount === 'contributor') {
  pass('Created pending contributor request (201)');
} else {
  fail('Should create pending request', r);
}

// Reject duplicate pending request
r = await req('POST', '/api/account-change-requests', {
  requestingAccount: 'contributor',
  reasonMessage: 'Another request for the same role.',
}, userToken);
if (r.status === 409) pass('Rejects duplicate pending request (409)');
else fail('Should 409 for duplicate pending', r);

// Reject missing requestingAccount
r = await req('POST', '/api/account-change-requests', {
  reasonMessage: 'Missing the requestingAccount field.',
}, userToken);
if (r.status === 400) pass('Rejects missing requestingAccount (400)');
else fail('Should 400 for missing requestingAccount', r);

// Reject invalid requestingAccount value
r = await req('POST', '/api/account-change-requests', {
  requestingAccount: 'superuser',
  reasonMessage: 'Invalid role name.',
}, userToken);
if (r.status === 400) pass('Rejects invalid requestingAccount value (400)');
else fail('Should 400 for invalid requestingAccount', r);

// Reject missing reasonMessage
r = await req('POST', '/api/account-change-requests', {
  requestingAccount: 'contributor',
}, userToken);
if (r.status === 400) pass('Rejects missing reasonMessage (400)');
else fail('Should 400 for missing reasonMessage', r);

// Reject reasonMessage over 1000 chars
r = await req('POST', '/api/account-change-requests', {
  requestingAccount: 'contributor',
  reasonMessage: 'x'.repeat(1001),
}, userToken);
if (r.status === 400) pass('Rejects reasonMessage > 1000 chars (400)');
else fail('Should 400 for long reasonMessage', r);

// Admin requests a lower role — should be 422
r = await req('POST', '/api/account-change-requests', {
  requestingAccount: 'contributor',
  reasonMessage: 'Admin requesting lower role.',
}, adminToken);
if (r.status === 422) pass('Rejects request for lower-or-same role (422)');
else fail('Should 422 for same/lower role', r);

// Unauthenticated request
r = await req('POST', '/api/account-change-requests', {
  requestingAccount: 'contributor',
  reasonMessage: 'No token.',
});
if (r.status === 401) pass('Rejects unauthenticated request (401)');
else fail('Should 401 without token', r);

// ── 2. GET /account-change-requests/me ───────────────────────────────────────
section('2. GET /account-change-requests/me');
r = await req('GET', '/api/account-change-requests/me', null, userToken);
if (r.status === 200 && Array.isArray(r.body) && r.body.length >= 1) {
  pass(`Own requests returned (${r.body.length} item(s))`);
} else {
  fail('Should return own requests array', r);
}

r = await req('GET', '/api/account-change-requests/me', null, adminToken);
if (r.status === 200 && Array.isArray(r.body) && r.body.length === 0) {
  pass('Admin has no own requests (empty array)');
} else {
  fail('Admin /me should return empty array', r);
}

r = await req('GET', '/api/account-change-requests/me');
if (r.status === 401) pass('Rejects unauthenticated /me (401)');
else fail('Should 401 for unauthenticated /me', r);

// ── 3. GET /account-change-requests  (admin only) ────────────────────────────
section('3. GET /account-change-requests');
r = await req('GET', '/api/account-change-requests', null, adminToken);
if (r.status === 200 && Array.isArray(r.body.data) && typeof r.body.total === 'number') {
  pass(`Admin lists all requests — total=${r.body.total}, page=${r.body.page}`);
} else {
  fail('Admin should see paginated list', r);
}

// Filtered by status
r = await req('GET', '/api/account-change-requests?status=pending', null, adminToken);
if (r.status === 200 && r.body.data.every((x) => x.status === 'pending')) {
  pass('Filters by status=pending');
} else {
  fail('Should filter by pending', r);
}

// Invalid status filter
r = await req('GET', '/api/account-change-requests?status=unknown', null, adminToken);
if (r.status === 400) pass('Rejects unknown status filter (400)');
else fail('Should 400 for unknown status filter', r);

// Non-admin is forbidden
r = await req('GET', '/api/account-change-requests', null, userToken);
if (r.status === 403) pass('Community member is forbidden from listing all (403)');
else fail('Should 403 for non-admin list', r);

// ── 4. GET /account-change-requests/:id  (admin only) ────────────────────────
section('4. GET /account-change-requests/:id');
r = await req('GET', '/api/account-change-requests/' + changeReqId, null, adminToken);
if (r.status === 200 && r.body.id === changeReqId) pass('Admin fetches request by id (200)');
else fail('Admin get by id', r);

r = await req('GET', '/api/account-change-requests/non-existent-id', null, adminToken);
if (r.status === 404) pass('Returns 404 for unknown id');
else fail('Should 404 for unknown id', r);

r = await req('GET', '/api/account-change-requests/' + changeReqId, null, userToken);
if (r.status === 403) pass('Non-admin is forbidden from fetching by id (403)');
else fail('Should 403 for non-admin get by id', r);

// ── 5. PATCH /account-change-requests/:id  (admin only) ──────────────────────
section('5. PATCH /account-change-requests/:id (approve / reject)');

// Reject first: missing status
r = await req('PATCH', '/api/account-change-requests/' + changeReqId, {}, adminToken);
if (r.status === 400) pass('Rejects missing status field (400)');
else fail('Should 400 for missing status', r);

// Reject invalid status value
r = await req('PATCH', '/api/account-change-requests/' + changeReqId, { status: 'maybe' }, adminToken);
if (r.status === 400) pass('Rejects invalid status value (400)');
else fail('Should 400 for invalid status value', r);

// Non-admin cannot review
r = await req('PATCH', '/api/account-change-requests/' + changeReqId, { status: 'approved' }, userToken);
if (r.status === 403) pass('Non-admin is forbidden from reviewing (403)');
else fail('Should 403 for non-admin review', r);

// Approve the request
r = await req('PATCH', '/api/account-change-requests/' + changeReqId, { status: 'approved' }, adminToken);
if (r.status === 200 && r.body.status === 'approved' && r.body.reviewedBy === admin.id) {
  pass('Admin approves request — status=approved, reviewedBy set');
} else {
  fail('Admin approval', r);
}

// Verify user's accountType was promoted
r = await req('GET', '/api/account/profile', null, userToken);
if (r.status === 200 && r.body.accountType === 'contributor') {
  pass('User accountType promoted to contributor after approval');
} else {
  fail('User should now be contributor', r);
}

// Cannot re-review an already-resolved request
r = await req('PATCH', '/api/account-change-requests/' + changeReqId, { status: 'rejected' }, adminToken);
if (r.status === 422) pass('Cannot re-review an already-approved request (422)');
else fail('Should 422 for re-review', r);

// ── 6. Create and reject a second request ─────────────────────────────────────
section('6. Reject flow');
// Now user is contributor — they can request admin
r = await req('POST', '/api/account-change-requests', {
  requestingAccount: 'admin',
  reasonMessage: 'I would like admin access to manage the platform.',
}, userToken);
const req2Id = r.body.id;
if (r.status === 201 && r.body.requestingAccount === 'admin') {
  pass('Contributor submits request for admin (201)');
} else {
  fail('Contributor admin request', r);
}

r = await req('PATCH', '/api/account-change-requests/' + req2Id, { status: 'rejected' }, adminToken);
if (r.status === 200 && r.body.status === 'rejected') {
  pass('Admin rejects the request — status=rejected');
} else {
  fail('Admin rejection', r);
}

// Rejected request does NOT change accountType
r = await req('GET', '/api/account/profile', null, userToken);
if (r.status === 200 && r.body.accountType === 'contributor') {
  pass('User accountType unchanged after rejection (still contributor)');
} else {
  fail('accountType should remain contributor after rejection', r);
}

console.log('\n── Done ──────────────────────────────────────────────────────\n');
