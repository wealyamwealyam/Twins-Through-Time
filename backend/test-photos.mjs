/**
 * test-photos.mjs
 * Full end-to-end test suite for the Photos API (§5 in docs/apis.md).
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
section('Seeding test data');
const seed = await req('POST', '/api/test/seed');
const { userToken, adminToken, user, admin, photo1, photo2, scrapeJobId } = seed.body;
pass(`user: ${user.username} (${user.id})`);
pass(`admin: ${admin.username} (${admin.id})`);
pass(`photo1: ${photo1.id}  photo2: ${photo2.id}`);

// ── 1. GET /photos ────────────────────────────────────────────────────────────
section('1. GET /photos');

let r = await req('GET', '/api/photos', null, userToken);
if (r.status === 200 && Array.isArray(r.body.data) && r.body.total >= 2) {
  pass(`User sees their own photos (total=${r.body.total})`);
} else {
  fail('User should see own photos', r);
}

// Admin sees all photos
r = await req('GET', '/api/photos', null, adminToken);
if (r.status === 200 && r.body.total >= 2) pass(`Admin sees all photos (total=${r.body.total})`);
else fail('Admin should see all photos', r);

// Filter by scrapeJobId
r = await req('GET', '/api/photos?scrapeJobId=' + scrapeJobId, null, userToken);
if (r.status === 200 && r.body.data.every((p) => p.scrapeJobId === scrapeJobId)) {
  pass('Filters by scrapeJobId');
} else {
  fail('Should filter by scrapeJobId', r);
}

// Filter by status
r = await req('GET', '/api/photos?status=pending_review', null, userToken);
if (r.status === 200 && r.body.data.every((p) => p.status === 'pending_review')) {
  pass('Filters by status=pending_review');
} else {
  fail('Should filter by status', r);
}

// Filter by isDuplicate
r = await req('GET', '/api/photos?isDuplicate=false', null, userToken);
if (r.status === 200 && r.body.data.every((p) => p.isDuplicate === false)) {
  pass('Filters by isDuplicate=false');
} else {
  fail('Should filter by isDuplicate', r);
}

// Filter by tags (comma-separated)
r = await req('GET', '/api/photos?tags=union,portrait', null, userToken);
if (r.status === 200 && r.body.data.length >= 1) pass('Filters by tags (union,portrait)');
else fail('Should filter by tags', r);

// Invalid status
r = await req('GET', '/api/photos?status=unknown', null, userToken);
if (r.status === 400) pass('Rejects invalid status filter (400)');
else fail('Should 400 for invalid status', r);

// Unauthenticated
r = await req('GET', '/api/photos');
if (r.status === 401) pass('Rejects unauthenticated list (401)');
else fail('Should 401 without token', r);

// ── 2. GET /photos/:id ────────────────────────────────────────────────────────
section('2. GET /photos/:id');

r = await req('GET', '/api/photos/' + photo1.id, null, userToken);
if (r.status === 200 && r.body.id === photo1.id) pass('User fetches own photo (200)');
else fail('User get own photo', r);

r = await req('GET', '/api/photos/' + photo1.id, null, adminToken);
if (r.status === 200 && r.body.id === photo1.id) pass('Admin fetches any photo (200)');
else fail('Admin should fetch any photo', r);

// Another user's photo → 403 (simulate by swapping tokens — admin-owned photo would need a second user)
// We test 404 for an unknown id
r = await req('GET', '/api/photos/non-existent-id', null, userToken);
if (r.status === 404) pass('Returns 404 for unknown photo id');
else fail('Should 404 for unknown id', r);

r = await req('GET', '/api/photos/' + photo1.id);
if (r.status === 401) pass('Rejects unauthenticated get (401)');
else fail('Should 401 without token', r);

// ── 3. PATCH /photos/:id  (update metadata) ───────────────────────────────────
section('3. PATCH /photos/:id');

r = await req('PATCH', '/api/photos/' + photo1.id, {
  name: 'Sergeant William H. Carney',
  regiment: '54th Massachusetts Infantry',
  age: '23',
  dateTaken: '1863-07',
  location: 'Fort Wagner, South Carolina',
  photographer: 'Unknown',
  collection: 'Selected Civil War Photographs',
  photoNotes: 'Portrait of Sgt. Carney in uniform.',
  tags: ['union', '54th massachusetts', 'medal of honor', 'portrait'],
  license: 'Public Domain',
}, userToken);
if (
  r.status === 200 &&
  r.body.name === 'Sergeant William H. Carney' &&
  r.body.isAutoExtracted === false &&
  r.body.metadataEditedBy === user.id
) {
  pass('Metadata updated — isAutoExtracted=false, metadataEditedBy set');
} else {
  fail('Metadata update', r);
}

// No editable fields provided
r = await req('PATCH', '/api/photos/' + photo1.id, { accountType: 'admin' }, userToken);
if (r.status === 400) pass('Rejects body with no editable fields (400)');
else fail('Should 400 for no editable fields', r);

// Invalid tags (not an array)
r = await req('PATCH', '/api/photos/' + photo1.id, { tags: 'not-an-array' }, userToken);
if (r.status === 400) pass('Rejects tags that is not an array (400)');
else fail('Should 400 for non-array tags', r);

// Unknown photo
r = await req('PATCH', '/api/photos/bad-id', { name: 'Test' }, userToken);
if (r.status === 404) pass('Returns 404 for unknown photo on PATCH');
else fail('Should 404 for unknown photo PATCH', r);

r = await req('PATCH', '/api/photos/' + photo1.id, { name: 'Test' });
if (r.status === 401) pass('Rejects unauthenticated PATCH (401)');
else fail('Should 401 without token on PATCH', r);

// ── 4. PATCH /photos/:id/status ───────────────────────────────────────────────
section('4. PATCH /photos/:id/status');

r = await req('PATCH', '/api/photos/' + photo1.id + '/status', { status: 'reviewed' }, userToken);
if (r.status === 200 && r.body.status === 'reviewed') pass('Status updated to reviewed (200)');
else fail('Status update to reviewed', r);

r = await req('PATCH', '/api/photos/' + photo1.id + '/status', { status: 'rejected' }, userToken);
if (r.status === 200 && r.body.status === 'rejected') pass('Status updated to rejected (200)');
else fail('Status update to rejected', r);

r = await req('PATCH', '/api/photos/' + photo1.id + '/status', { status: 'flying' }, userToken);
if (r.status === 400) pass('Rejects invalid status value (400)');
else fail('Should 400 for invalid status', r);

r = await req('PATCH', '/api/photos/' + photo1.id + '/status', {}, userToken);
if (r.status === 400) pass('Rejects missing status field (400)');
else fail('Should 400 for missing status', r);

r = await req('PATCH', '/api/photos/bad-id/status', { status: 'reviewed' }, userToken);
if (r.status === 404) pass('Returns 404 for unknown photo on status PATCH');
else fail('Should 404 for unknown photo on status PATCH', r);

// ── 5. PATCH /photos/:id/duplicate ───────────────────────────────────────────
section('5. PATCH /photos/:id/duplicate');

// Flag photo2 as duplicate of photo1
r = await req('PATCH', '/api/photos/' + photo2.id + '/duplicate', {
  isDuplicate: true,
  duplicateOfId: photo1.id,
}, userToken);
if (r.status === 200 && r.body.isDuplicate === true && r.body.duplicateOfId === photo1.id) {
  pass('Flagged as duplicate of photo1 (200)');
} else {
  fail('Duplicate flag', r);
}

// Unflag
r = await req('PATCH', '/api/photos/' + photo2.id + '/duplicate', {
  isDuplicate: false,
}, userToken);
if (r.status === 200 && r.body.isDuplicate === false && r.body.duplicateOfId === null) {
  pass('Unflagged duplicate — duplicateOfId cleared (200)');
} else {
  fail('Unflag duplicate', r);
}

// isDuplicate=true without duplicateOfId
r = await req('PATCH', '/api/photos/' + photo2.id + '/duplicate', { isDuplicate: true }, userToken);
if (r.status === 400) pass('Rejects isDuplicate=true without duplicateOfId (400)');
else fail('Should 400 for missing duplicateOfId', r);

// isDuplicate is not a boolean
r = await req('PATCH', '/api/photos/' + photo2.id + '/duplicate', { isDuplicate: 'yes' }, userToken);
if (r.status === 400) pass('Rejects non-boolean isDuplicate (400)');
else fail('Should 400 for non-boolean isDuplicate', r);

// Photo duplicate of itself
r = await req('PATCH', '/api/photos/' + photo1.id + '/duplicate', {
  isDuplicate: true, duplicateOfId: photo1.id,
}, userToken);
if (r.status === 400) pass('Rejects photo marked as duplicate of itself (400)');
else fail('Should 400 for self-duplicate', r);

// duplicateOfId that does not exist
r = await req('PATCH', '/api/photos/' + photo2.id + '/duplicate', {
  isDuplicate: true, duplicateOfId: 'non-existent-id',
}, userToken);
if (r.status === 404) pass('Returns 404 when duplicateOfId does not exist');
else fail('Should 404 for unknown duplicateOfId', r);

// ── 6. GET /photos/:id/download ───────────────────────────────────────────────
section('6. GET /photos/:id/download');

r = await req('GET', '/api/photos/' + photo1.id + '/download', null, userToken);
if (r.status === 200 && r.body.url && r.body.expiresAt) {
  pass('Download URL returned with expiresAt (200)');
} else {
  fail('Download URL', r);
}

r = await req('GET', '/api/photos/bad-id/download', null, userToken);
if (r.status === 404) pass('Returns 404 for unknown photo on download');
else fail('Should 404 for unknown photo download', r);

r = await req('GET', '/api/photos/' + photo1.id + '/download');
if (r.status === 401) pass('Rejects unauthenticated download (401)');
else fail('Should 401 without token on download', r);

console.log('\n── Done ──────────────────────────────────────────────────────\n');
