/**
 * test-onboarding-requests.mjs
 * Full end-to-end test suite for the Onboarding Requests API (§6).
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
const { userToken, adminToken, user, admin, reviewedPhoto1, reviewedPhoto2, photo1 } = seed.body;
pass(`user: ${user.username} (${user.id})`);
pass(`admin: ${admin.username} (${admin.id})`);
pass(`reviewedPhoto1: ${reviewedPhoto1.id}  reviewedPhoto2: ${reviewedPhoto2.id}`);
pass(`pending photo1: ${photo1.id}  (status=pending_review)`);

// ── 1. POST /onboarding-requests ──────────────────────────────────────────────
section('1. POST /onboarding-requests');

let r = await req('POST', '/api/onboarding-requests', {
  onboardingRequestTitle: 'LOC Civil War Photographs — Batch 1',
  onboardingRequestNotes: 'All photos verified as public domain.',
  photoIds: [reviewedPhoto1.id, reviewedPhoto2.id],
}, userToken);
const onbId = r.body.id;
if (r.status === 201 && r.body.status === 'pending' && r.body.photoCount === 2) {
  pass('Created onboarding request (201), photoCount=2');
} else {
  fail('Create onboarding request', r);
}

// Missing title
r = await req('POST', '/api/onboarding-requests', {
  photoIds: [reviewedPhoto1.id],
}, userToken);
if (r.status === 400) pass('Rejects missing title (400)');
else fail('Should 400 for missing title', r);

// Title too long
r = await req('POST', '/api/onboarding-requests', {
  onboardingRequestTitle: 'x'.repeat(256),
  photoIds: [reviewedPhoto1.id],
}, userToken);
if (r.status === 400) pass('Rejects title > 255 chars (400)');
else fail('Should 400 for long title', r);

// Notes too long
r = await req('POST', '/api/onboarding-requests', {
  onboardingRequestTitle: 'Test',
  onboardingRequestNotes: 'x'.repeat(2001),
  photoIds: [reviewedPhoto1.id],
}, userToken);
if (r.status === 400) pass('Rejects notes > 2000 chars (400)');
else fail('Should 400 for long notes', r);

// Empty photoIds
r = await req('POST', '/api/onboarding-requests', {
  onboardingRequestTitle: 'Test',
  photoIds: [],
}, userToken);
if (r.status === 400) pass('Rejects empty photoIds (400)');
else fail('Should 400 for empty photoIds', r);

// Non-reviewed photo
r = await req('POST', '/api/onboarding-requests', {
  onboardingRequestTitle: 'Test',
  photoIds: [photo1.id],  // status=pending_review
}, userToken);
if (r.status === 422) pass('Rejects non-reviewed photo (422)');
else fail('Should 422 for non-reviewed photo', r);

// Unauthenticated
r = await req('POST', '/api/onboarding-requests', {
  onboardingRequestTitle: 'Test',
  photoIds: [reviewedPhoto1.id],
});
if (r.status === 401) pass('Rejects unauthenticated create (401)');
else fail('Should 401 without token', r);

// ── 2. GET /onboarding-requests ───────────────────────────────────────────────
section('2. GET /onboarding-requests');

r = await req('GET', '/api/onboarding-requests', null, userToken);
if (r.status === 200 && Array.isArray(r.body.data) && r.body.total >= 1) {
  pass(`User sees their own requests (total=${r.body.total})`);
} else {
  fail('User list', r);
}

// Admin sees all
r = await req('GET', '/api/onboarding-requests', null, adminToken);
if (r.status === 200 && r.body.total >= 1) pass(`Admin sees all requests (total=${r.body.total})`);
else fail('Admin list', r);

// Filter by status
r = await req('GET', '/api/onboarding-requests?status=pending', null, userToken);
if (r.status === 200 && r.body.data.every((x) => x.status === 'pending')) {
  pass('Filters by status=pending');
} else {
  fail('Filter by status', r);
}

// Invalid status
r = await req('GET', '/api/onboarding-requests?status=unknown', null, userToken);
if (r.status === 400) pass('Rejects unknown status filter (400)');
else fail('Should 400 for unknown status', r);

// submittedBy filter — non-admin is forbidden
r = await req('GET', '/api/onboarding-requests?submittedBy=' + user.id, null, userToken);
if (r.status === 403) pass('Non-admin cannot use submittedBy filter (403)');
else fail('Should 403 for non-admin submittedBy filter', r);

// Admin can use submittedBy
r = await req('GET', '/api/onboarding-requests?submittedBy=' + user.id, null, adminToken);
if (r.status === 200 && r.body.data.every((x) => x.submittedBy === user.id)) {
  pass('Admin can filter by submittedBy');
} else {
  fail('Admin submittedBy filter', r);
}

// ── 3. GET /onboarding-requests/:id ───────────────────────────────────────────
section('3. GET /onboarding-requests/:id');

r = await req('GET', '/api/onboarding-requests/' + onbId, null, userToken);
if (r.status === 200 && r.body.id === onbId && Array.isArray(r.body.photos) && r.body.photos.length === 2) {
  pass('Submitter fetches own request with photos hydrated (200)');
} else {
  fail('Get own request', r);
}

r = await req('GET', '/api/onboarding-requests/' + onbId, null, adminToken);
if (r.status === 200 && r.body.id === onbId) pass('Admin fetches any request (200)');
else fail('Admin get request', r);

r = await req('GET', '/api/onboarding-requests/non-existent-id', null, userToken);
if (r.status === 404) pass('Returns 404 for unknown id');
else fail('Should 404 for unknown id', r);

// ── 4. PATCH /onboarding-requests/:id ─────────────────────────────────────────
section('4. PATCH /onboarding-requests/:id');

r = await req('PATCH', '/api/onboarding-requests/' + onbId, {
  onboardingRequestTitle: 'LOC Civil War Photographs — Batch 1 (Revised)',
  onboardingRequestNotes: 'Updated notes.',
}, userToken);
if (r.status === 200 && r.body.onboardingRequestTitle === 'LOC Civil War Photographs — Batch 1 (Revised)') {
  pass('Title and notes updated (200)');
} else {
  fail('PATCH title/notes', r);
}

// No editable fields
r = await req('PATCH', '/api/onboarding-requests/' + onbId, {}, userToken);
if (r.status === 400) pass('Rejects empty PATCH body (400)');
else fail('Should 400 for empty PATCH', r);

// Non-submitter cannot edit
r = await req('PATCH', '/api/onboarding-requests/' + onbId, {
  onboardingRequestTitle: 'Hijacked',
}, adminToken);
if (r.status === 403) pass('Non-submitter admin is forbidden from editing (403)');
else fail('Should 403 for non-submitter edit', r);

// ── 5. POST /:id/photos ────────────────────────────────────────────────────────
section('5. POST /onboarding-requests/:id/photos');

// Create a third reviewed photo to add
const extraSeed = await req('POST', '/api/test/seed');
// We need another reviewed photo — use reviewedPhoto1/2 from a fresh seed call
// Instead, we mark photo1 as reviewed via the Photos API then add it
await req('PATCH', '/api/photos/' + photo1.id + '/status', { status: 'reviewed' }, userToken);

r = await req('POST', '/api/onboarding-requests/' + onbId + '/photos', {
  photoIds: [photo1.id],
}, userToken);
if (r.status === 200 && r.body.photoIds.includes(photo1.id)) {
  pass('Added reviewed photo to request (200)');
} else {
  fail('Add photo', r);
}

// Duplicate photo
r = await req('POST', '/api/onboarding-requests/' + onbId + '/photos', {
  photoIds: [reviewedPhoto1.id],
}, userToken);
if (r.status === 422) pass('Rejects duplicate photo in request (422)');
else fail('Should 422 for duplicate photo', r);

// Empty photoIds
r = await req('POST', '/api/onboarding-requests/' + onbId + '/photos', { photoIds: [] }, userToken);
if (r.status === 400) pass('Rejects empty photoIds on add (400)');
else fail('Should 400 for empty photoIds on add', r);

// ── 6. DELETE /:id/photos/:photoId ────────────────────────────────────────────
section('6. DELETE /onboarding-requests/:id/photos/:photoId');

r = await req('DELETE', '/api/onboarding-requests/' + onbId + '/photos/' + photo1.id, null, userToken);
if (r.status === 204) pass('Removed photo from request (204)');
else fail('Remove photo', r);

// Photo not in request
r = await req('DELETE', '/api/onboarding-requests/' + onbId + '/photos/non-existent', null, userToken);
if (r.status === 404) pass('Returns 404 for photo not in request');
else fail('Should 404 for photo not in request', r);

// ── 7. POST /:id/submit ────────────────────────────────────────────────────────
section('7. POST /onboarding-requests/:id/submit');

// Re-submit should fail if already non-pending — but it's still pending, so it should work
r = await req('POST', '/api/onboarding-requests/' + onbId + '/submit', null, userToken);
if (r.status === 200 && r.body.status === 'under_review') {
  pass('Submitted request — status=under_review (200)');
} else {
  fail('Submit', r);
}

// Cannot submit again
r = await req('POST', '/api/onboarding-requests/' + onbId + '/submit', null, userToken);
if (r.status === 422) pass('Cannot re-submit a non-pending request (422)');
else fail('Should 422 for re-submit', r);

// Non-submitter cannot submit a different request
r = await req('POST', '/api/onboarding-requests/' + onbId + '/submit', null, adminToken);
if (r.status === 403) pass('Non-submitter is forbidden from submitting (403)');
else fail('Should 403 for non-submitter submit', r);

// ── 8. POST /:id/approve ──────────────────────────────────────────────────────
section('8. POST /onboarding-requests/:id/approve');

r = await req('POST', '/api/onboarding-requests/' + onbId + '/approve', {
  adminNote: 'All metadata verified.',
}, adminToken);
if (r.status === 200 && r.body.status === 'approved' && r.body.reviewedBy === admin.id) {
  pass('Admin approves request (200) — reviewedBy set');
} else {
  fail('Approve', r);
}

// Cannot approve again
r = await req('POST', '/api/onboarding-requests/' + onbId + '/approve', {}, adminToken);
if (r.status === 422) pass('Cannot approve a non-under_review request (422)');
else fail('Should 422 for re-approve', r);

// Non-admin cannot approve
r = await req('POST', '/api/onboarding-requests/' + onbId + '/approve', {}, userToken);
if (r.status === 403) pass('Non-admin is forbidden from approving (403)');
else fail('Should 403 for non-admin approve', r);

// ── 9. POST /:id/reject ───────────────────────────────────────────────────────
section('9. POST /onboarding-requests/:id/reject');

// Create a second onboarding request to test rejection
const r2Seed = await req('POST', '/api/test/seed');
const { userToken: uT2, reviewedPhoto1: rp3, reviewedPhoto2: rp4 } = r2Seed.body;

// Create and submit a second request
const r2Create = await req('POST', '/api/onboarding-requests', {
  onboardingRequestTitle: 'Batch 2 for rejection test',
  photoIds: [rp3.id, rp4.id],
}, uT2);
const onbId2 = r2Create.body.id;
await req('POST', '/api/onboarding-requests/' + onbId2 + '/submit', null, uT2);

r = await req('POST', '/api/onboarding-requests/' + onbId2 + '/reject', {
  adminNote: 'Missing regiment data on several photos.',
}, adminToken);
if (r.status === 200 && r.body.status === 'rejected' && r.body.adminNote) {
  pass('Admin rejects request (200) — adminNote set');
} else {
  fail('Reject', r);
}

// Non-admin cannot reject
r = await req('POST', '/api/onboarding-requests/' + onbId2 + '/reject', {}, uT2);
if (r.status === 403) pass('Non-admin is forbidden from rejecting (403)');
else fail('Should 403 for non-admin reject', r);

// ── 10. PATCH /:id/assign ─────────────────────────────────────────────────────
section('10. PATCH /onboarding-requests/:id/assign');

// Create a fresh request for assign test
const r3Seed = await req('POST', '/api/test/seed');
const { userToken: uT3, adminToken: aT3, admin: admin3, reviewedPhoto1: rp5, reviewedPhoto2: rp6 } = r3Seed.body;

const r3Create = await req('POST', '/api/onboarding-requests', {
  onboardingRequestTitle: 'Batch 3 for assign test',
  photoIds: [rp5.id, rp6.id],
}, uT3);
const onbId3 = r3Create.body.id;

r = await req('PATCH', '/api/onboarding-requests/' + onbId3 + '/assign', {
  reviewerId: admin3.id,
}, adminToken);
if (r.status === 200 && r.body.reviewerId === admin3.id) {
  pass('Admin assigns reviewer (200)');
} else {
  fail('Assign reviewer', r);
}

// Missing reviewerId
r = await req('PATCH', '/api/onboarding-requests/' + onbId3 + '/assign', {}, adminToken);
if (r.status === 400) pass('Rejects missing reviewerId (400)');
else fail('Should 400 for missing reviewerId', r);

// Reviewer must be an admin (assign a non-admin user)
// Get the user id from uT3 — decode the token
const userPayload = JSON.parse(Buffer.from(uT3.split('.')[1], 'base64url').toString());
r = await req('PATCH', '/api/onboarding-requests/' + onbId3 + '/assign', {
  reviewerId: userPayload.id,
}, adminToken);
if (r.status === 422) pass('Rejects assigning a non-admin reviewer (422)');
else fail('Should 422 for non-admin reviewer', r);

// Non-admin cannot assign
r = await req('PATCH', '/api/onboarding-requests/' + onbId3 + '/assign', {
  reviewerId: admin3.id,
}, uT3);
if (r.status === 403) pass('Non-admin is forbidden from assigning (403)');
else fail('Should 403 for non-admin assign', r);

// ── 11. DELETE /onboarding-requests/:id ───────────────────────────────────────
section('11. DELETE /onboarding-requests/:id');

// Create a fresh pending request to delete
const r4Seed = await req('POST', '/api/test/seed');
const { userToken: uT4, reviewedPhoto1: rp7 } = r4Seed.body;

const r4Create = await req('POST', '/api/onboarding-requests', {
  onboardingRequestTitle: 'To be deleted',
  photoIds: [rp7.id],
}, uT4);
const onbId4 = r4Create.body.id;

// Non-submitter non-admin cannot delete
r = await req('DELETE', '/api/onboarding-requests/' + onbId4, null, userToken);
if (r.status === 403) pass('Non-submitter is forbidden from deleting (403)');
else fail('Should 403 for non-submitter delete', r);

// Submitter can delete pending request
r = await req('DELETE', '/api/onboarding-requests/' + onbId4, null, uT4);
if (r.status === 204) pass('Submitter deletes own pending request (204)');
else fail('Submitter delete', r);

// Already deleted
r = await req('DELETE', '/api/onboarding-requests/' + onbId4, null, uT4);
if (r.status === 404) pass('Returns 404 after deletion');
else fail('Should 404 for already-deleted request', r);

// Cannot delete a non-pending request (the approved one)
r = await req('DELETE', '/api/onboarding-requests/' + onbId, null, adminToken);
if (r.status === 422) pass('Cannot delete a non-pending (approved) request (422)');
else fail('Should 422 for deleting non-pending request', r);

console.log('\n── Done ──────────────────────────────────────────────────────\n');
