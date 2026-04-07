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
  console.log('  ❌ ' + label + ' — status=' + got.status + ' body=' + JSON.stringify(got.body));
const section = (s) => console.log('\n── ' + s);

// ── Debug token ───────────────────────────────────────────────────────────────
section('Debug: inspect seed token');
const seedResp = await fetch(BASE + '/api/test/seed', { method: 'POST' });
const seedBody = await seedResp.json();
const token = seedBody.userToken;
console.log('  Token exists:', !!token);
console.log('  Token type:', typeof token);
console.log('  Token (first 80 chars):', token?.slice(0, 80));

if (token) {
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  console.log('  Decoded payload:', payload);
  console.log('  Issued at:', new Date(payload.iat * 1000).toISOString());
  console.log('  Expires at:', new Date(payload.exp * 1000).toISOString());
  console.log('  Alg header:', JSON.parse(Buffer.from(parts[0], 'base64url').toString()));
}

// ── Seed ──────────────────────────────────────────────────────────────────────
section('Seeding test users');
const seed = await req('POST', '/api/test/seed');
const { userToken, adminToken, user, admin } = seed.body;
console.log('  user:', user?.username, user?.id);
console.log('  admin:', admin?.username, admin?.id);
console.log('  userToken (first 80):', userToken?.slice(0, 80));
console.log('  adminToken (first 80):', adminToken?.slice(0, 80));

// ── 1. GET /account/profile ───────────────────────────────────────────────────
section('1. GET /account/profile');
let r = await req('GET', '/api/account/profile', null, userToken);
if (r.status === 200 && r.body.username === 'jsmith') pass('Own profile returned');
else fail('Own profile', r);

r = await req('GET', '/api/account/profile');
if (r.status === 401) pass('Rejects missing token (401)');
else fail('Should reject missing token', r);

// ── 2. PATCH /account/profile ────────────────────────────────────────────────
section('2. PATCH /account/profile');
r = await req('PATCH', '/api/account/profile', { firstName: 'Johnny', age: 35 }, userToken);
if (r.status === 200 && r.body.firstName === 'Johnny' && r.body.age === 35) pass('Profile updated (firstName + age)');
else fail('Profile update', r);

r = await req('PATCH', '/api/account/profile', { age: 5 }, userToken);
if (r.status === 400) pass('Rejects invalid age < 13 (400)');
else fail('Should reject age < 13', r);

r = await req('PATCH', '/api/account/profile', { accountType: 'admin' }, userToken);
if (r.status === 400) pass('Rejects disallowed field accountType (400)');
else fail('Should reject accountType update', r);

r = await req('PATCH', '/api/account/profile', { firstName: 'Jane' });
if (r.status === 401) pass('Rejects missing token on PATCH (401)');
else fail('Should reject missing token on PATCH', r);

// ── 3. GET /account/users/:id ────────────────────────────────────────────────
section('3. GET /account/users/:id (admin only)');
r = await req('GET', '/api/account/users/' + user.id, null, adminToken);
if (r.status === 200 && r.body.id === user.id) pass('Admin can fetch any user by id');
else fail('Admin get user by id', r);

r = await req('GET', '/api/account/users/' + user.id, null, userToken);
if (r.status === 403) pass('Community member is forbidden (403)');
else fail('Should be 403 for community member', r);

r = await req('GET', '/api/account/users/non-existent-id', null, adminToken);
if (r.status === 404) pass('Returns 404 for unknown user');
else fail('Should 404 for unknown id', r);

// ── 4. PATCH /account/users/:id/role ─────────────────────────────────────────
section('4. PATCH /account/users/:id/role (admin only)');
r = await req('PATCH', '/api/account/users/' + user.id + '/role', { accountType: 'contributor' }, adminToken);
if (r.status === 200 && r.body.accountType === 'contributor') pass('Admin promoted user to contributor');
else fail('Admin update role', r);

r = await req('PATCH', '/api/account/users/' + user.id + '/role', { accountType: 'contributor' }, userToken);
if (r.status === 403) pass('Non-admin is forbidden from updating roles (403)');
else fail('Should be 403 for non-admin', r);

r = await req('PATCH', '/api/account/users/' + user.id + '/role', { accountType: 'superuser' }, adminToken);
if (r.status === 400) pass('Rejects invalid role (400)');
else fail('Should reject invalid role', r);

r = await req('PATCH', '/api/account/users/' + user.id + '/role', {}, adminToken);
if (r.status === 400) pass('Rejects missing accountType (400)');
else fail('Should reject missing accountType', r);

console.log('\n── Done ──────────────────────────────────────────────────────\n');
