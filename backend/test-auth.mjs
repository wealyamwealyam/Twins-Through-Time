/**
 * test-auth.mjs
 * -------------
 * Integration tests for §1 Auth API
 *
 * Run: node test-auth.mjs
 */

const BASE = 'http://localhost:3000/api';

let pass = 0;
let fail = 0;

const check = (label, ok, extra = '') => {
  if (ok) { console.log(`  ✅ ${label}`); pass++; }
  else     { console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); fail++; }
};

const post = (path, body, token) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const get = (path, token) =>
  fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

// ── Helpers ──────────────────────────────────────────────────────────────────

let userToken, refreshToken, adminToken, resetTokenFromLog;
const UNIQUE = Date.now();
const USER_EMAIL = `testuser_${UNIQUE}@example.com`;
const USER_PASS  = 'SecurePass123!';

// ── 1. POST /auth/register ────────────────────────────────────────────────────
console.log('\n── 1. POST /auth/register');

{
  const r = await post('/auth/register', {
    username: `testuser${UNIQUE}`,
    email: USER_EMAIL,
    password: USER_PASS,
    firstName: 'Test',
    lastName: 'User',
  });
  const body = await r.json();
  check('201 on valid registration', r.status === 201);
  check('Returns token', typeof body.token === 'string');
  check('Returns refreshToken', typeof body.refreshToken === 'string');
  check('Returns user object', body.user?.id && body.user?.username);
  check('accountType defaults to community_member', body.user?.accountType === 'community_member');
  check('No passwordHash in response', !body.user?.passwordHash);
  userToken    = body.token;
  refreshToken = body.refreshToken;
}

{
  // Duplicate email
  const r = await post('/auth/register', {
    username: `other${UNIQUE}`,
    email: USER_EMAIL,
    password: USER_PASS,
    firstName: 'X', lastName: 'Y',
  });
  check('409 on duplicate email', r.status === 409);
}

{
  // Duplicate username
  const r = await post('/auth/register', {
    username: `testuser${UNIQUE}`,
    email: `other_${UNIQUE}@example.com`,
    password: USER_PASS,
    firstName: 'X', lastName: 'Y',
  });
  check('409 on duplicate username', r.status === 409);
}

{
  // Missing fields
  const r = await post('/auth/register', { email: USER_EMAIL, password: USER_PASS });
  check('400 on missing required fields', r.status === 400);
}

{
  // Short password
  const r = await post('/auth/register', {
    username: `shortpw${UNIQUE}`, email: `shortpw_${UNIQUE}@example.com`,
    password: 'short', firstName: 'A', lastName: 'B',
  });
  check('400 on password < 8 chars', r.status === 400);
}

{
  // requestContributor creates AccountChangeRequest — just verify no error
  const r = await post('/auth/register', {
    username: `contrib${UNIQUE}`, email: `contrib_${UNIQUE}@example.com`,
    password: USER_PASS, firstName: 'C', lastName: 'D',
    requestContributor: true,
  });
  check('201 with requestContributor:true', r.status === 201);
}

// ── 2. POST /auth/login ───────────────────────────────────────────────────────
console.log('\n── 2. POST /auth/login');

{
  const r = await post('/auth/login', { email: USER_EMAIL, password: USER_PASS });
  const body = await r.json();
  check('200 on valid login', r.status === 200);
  check('Returns token', typeof body.token === 'string');
  check('Returns refreshToken', typeof body.refreshToken === 'string');
  check('Returns user object', body.user?.id);
}

{
  const r = await post('/auth/login', { email: USER_EMAIL, password: 'wrongpassword' });
  check('401 on wrong password', r.status === 401);
}

{
  const r = await post('/auth/login', { email: 'noone@example.com', password: USER_PASS });
  check('401 on unknown email', r.status === 401);
}

{
  const r = await post('/auth/login', { email: USER_EMAIL });
  check('400 on missing password', r.status === 400);
}

// ── 3. POST /auth/refresh ─────────────────────────────────────────────────────
console.log('\n── 3. POST /auth/refresh');

{
  const r = await post('/auth/refresh', { refreshToken });
  const body = await r.json();
  check('200 on valid refresh', r.status === 200);
  check('Returns new access token', typeof body.token === 'string');
}

{
  const r = await post('/auth/refresh', { refreshToken: 'badtoken' });
  check('401 on invalid refresh token', r.status === 401);
}

{
  const r = await post('/auth/refresh', {});
  check('400 when refreshToken missing', r.status === 400);
}

// ── 4. POST /auth/forgot-password ────────────────────────────────────────────
console.log('\n── 4. POST /auth/forgot-password');

{
  const r = await post('/auth/forgot-password', { email: USER_EMAIL });
  const body = await r.json();
  check('200 for known email', r.status === 200);
  check('Returns generic message', typeof body.message === 'string');
}

{
  // Should still return 200 for unknown email (enumeration prevention)
  const r = await post('/auth/forgot-password', { email: 'nobody@example.com' });
  check('200 for unknown email (no enumeration)', r.status === 200);
}

{
  const r = await post('/auth/forgot-password', {});
  check('400 when email missing', r.status === 400);
}

// ── 5. POST /auth/reset-password ─────────────────────────────────────────────
console.log('\n── 5. POST /auth/reset-password');

// We need a real reset token — trigger forgot-password and capture from server log
// Since we can't read server stdout here, we'll test the validation paths only
// and verify login with new password after a full flow in the next block.

{
  const r = await post('/auth/reset-password', { resetToken: 'fakebadtoken', newPassword: 'NewPass123!' });
  check('400 on invalid reset token', r.status === 400);
}

{
  const r = await post('/auth/reset-password', { resetToken: 'tok', newPassword: 'short' });
  check('400 on short new password', r.status === 400);
}

{
  const r = await post('/auth/reset-password', { newPassword: 'NewPass123!' });
  check('400 when resetToken missing', r.status === 400);
}

// ── 6. POST /auth/register/admin-invite ──────────────────────────────────────
console.log('\n── 6. POST /auth/register/admin-invite');

// First create an admin so we can generate an invite token
let inviteToken;
{
  // Use the dev seed to get an admin token
  const seed = await fetch(`${BASE}/test/seed`, { method: 'POST' });
  const sData = await seed.json();
  adminToken = sData.adminToken;

  // Generate invite link
  const inv = await fetch(`${BASE}/admin/invite-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ expiresInHours: 48 }),
  });
  const invBody = await inv.json();
  inviteToken = invBody.inviteToken;
  check('Got invite token from admin', typeof inviteToken === 'string');
}

{
  const r = await post('/auth/register/admin-invite', {
    inviteToken,
    username: `newadmin${UNIQUE}`,
    email: `newadmin_${UNIQUE}@example.com`,
    password: USER_PASS,
    firstName: 'New', lastName: 'Admin',
  });
  const body = await r.json();
  check('201 on valid admin-invite registration', r.status === 201);
  check('accountType is admin', body.user?.accountType === 'admin');
  check('Returns token', typeof body.token === 'string');
}

{
  // Re-using the same token should fail (already used)
  const r = await post('/auth/register/admin-invite', {
    inviteToken,
    username: `newadmin2${UNIQUE}`,
    email: `newadmin2_${UNIQUE}@example.com`,
    password: USER_PASS,
    firstName: 'New2', lastName: 'Admin2',
  });
  check('400 on reused invite token', r.status === 400);
}

{
  const r = await post('/auth/register/admin-invite', {
    inviteToken: 'completely-fake-token',
    username: `fake${UNIQUE}`, email: `fake_${UNIQUE}@example.com`,
    password: USER_PASS, firstName: 'F', lastName: 'G',
  });
  check('400 on invalid invite token', r.status === 400);
}

{
  const r = await post('/auth/register/admin-invite', {});
  check('400 when inviteToken missing', r.status === 400);
}

// ── 7. POST /auth/logout ──────────────────────────────────────────────────────
console.log('\n── 7. POST /auth/logout');

{
  const r = await post('/auth/logout', { refreshToken }, userToken);
  check('204 on logout', r.status === 204);
}

{
  // After logout, the refresh token should no longer work
  const r = await post('/auth/refresh', { refreshToken });
  check('401 on refresh after logout', r.status === 401);
}

{
  // Logout without auth header should be rejected
  const r = await post('/auth/logout', {});
  check('401 logout without auth token', r.status === 401);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n── Done ─────────────────────────────────────────────────────────────`);
console.log(`   ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
