/**
 * test-suggestions.mjs
 * Full end-to-end test suite for the Onboarding Request Suggestions API (§7).
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
const { userToken, adminToken, user, admin, reviewedPhoto1, reviewedPhoto2 } = seed.body;
pass(`user: ${user.username} (${user.id})`);
pass(`admin: ${admin.username} (${admin.id})`);
pass(`reviewedPhoto1: ${reviewedPhoto1.id}  reviewedPhoto2: ${reviewedPhoto2.id}`);

// ── Setup: create + submit an onboarding request ──────────────────────────────
section('Setup — create and submit an onboarding request');
let r = await req('POST', '/api/onboarding-requests', {
  onboardingRequestTitle: 'Batch for suggestion tests',
  photoIds: [reviewedPhoto1.id, reviewedPhoto2.id],
}, userToken);
const onbId = r.body.id;
pass(`Created onboarding request: ${onbId}`);

await req('POST', '/api/onboarding-requests/' + onbId + '/submit', null, userToken);
pass('Submitted request → under_review');

// ── 1. POST /:id/suggestions  🔴 ──────────────────────────────────────────────
section('1. POST /onboarding-requests/:id/suggestions');

// Full suggestion with note + photoEdits for both photos
r = await req('POST', '/api/onboarding-requests/' + onbId + '/suggestions', {
  onboardingRequestNote: 'A few corrections needed before approval.',
  photoEdits: [
    {
      originalPhotoId:   reviewedPhoto1.id,
      suggestedName:     'Unidentified Confederate soldier',
      suggestedRegiment: 'Unknown',
      suggestedTags:     ['confederate', 'portrait'],
      suggestedNotes:    'Uniform buttons suggest Confederate, not Union.',
    },
    {
      originalPhotoId:   reviewedPhoto2.id,
      suggestedRegiment: '9th Indiana Infantry',
      suggestedNotes:    'Regiment identifiable from insignia on cap.',
    },
  ],
}, adminToken);
const suggestionId = r.body.id;
const editId1 = r.body.photoEdits?.[0]?.id;
const editId2 = r.body.photoEdits?.[1]?.id;

if (
  r.status === 201 &&
  r.body.onboardingRequestId === onbId &&
  r.body.reviewerId === admin.id &&
  r.body.photoEdits.length === 2 &&
  editId1 && editId2
) {
  pass(`Suggestion created (201) — id=${suggestionId}, edits=${r.body.photoEdits.length}`);
} else {
  fail('Create suggestion', r);
}

// Suggestion with note only (no photoEdits)
r = await req('POST', '/api/onboarding-requests/' + onbId + '/suggestions', {
  onboardingRequestNote: 'Overall the metadata looks good.',
}, adminToken);
const suggestionId2 = r.body.id;
if (r.status === 201 && r.body.photoEdits.length === 0) {
  pass('Suggestion with note only — no photoEdits (201)');
} else {
  fail('Note-only suggestion', r);
}

// Neither note nor edits provided
r = await req('POST', '/api/onboarding-requests/' + onbId + '/suggestions', {}, adminToken);
if (r.status === 400) pass('Rejects empty suggestion body (400)');
else fail('Should 400 for empty body', r);

// Photo not in request
r = await req('POST', '/api/onboarding-requests/' + onbId + '/suggestions', {
  photoEdits: [{ originalPhotoId: 'non-existent-photo-id', suggestedName: 'X' }],
}, adminToken);
if (r.status === 422) pass('Rejects edit for photo not in request (422)');
else fail('Should 422 for photo not in request', r);

// Missing originalPhotoId in edit
r = await req('POST', '/api/onboarding-requests/' + onbId + '/suggestions', {
  photoEdits: [{ suggestedName: 'Missing photo id' }],
}, adminToken);
if (r.status === 422) pass('Rejects edit missing originalPhotoId (422)');
else fail('Should 422 for missing originalPhotoId', r);

// Duplicate originalPhotoId in same suggestion
r = await req('POST', '/api/onboarding-requests/' + onbId + '/suggestions', {
  photoEdits: [
    { originalPhotoId: reviewedPhoto1.id, suggestedName: 'First' },
    { originalPhotoId: reviewedPhoto1.id, suggestedName: 'Second' },
  ],
}, adminToken);
if (r.status === 422) pass('Rejects duplicate originalPhotoId in same suggestion (422)');
else fail('Should 422 for duplicate photoId', r);

// Non-admin cannot create
r = await req('POST', '/api/onboarding-requests/' + onbId + '/suggestions', {
  onboardingRequestNote: 'Should be blocked.',
}, userToken);
if (r.status === 403) pass('Non-admin is forbidden from creating suggestions (403)');
else fail('Should 403 for non-admin', r);

// Onboarding request not found
r = await req('POST', '/api/onboarding-requests/bad-id/suggestions', {
  onboardingRequestNote: 'No request.',
}, adminToken);
if (r.status === 404) pass('Returns 404 for unknown onboarding request');
else fail('Should 404 for unknown request', r);

// ── 2. GET /:id/suggestions  🔒 ───────────────────────────────────────────────
section('2. GET /onboarding-requests/:id/suggestions');

r = await req('GET', '/api/onboarding-requests/' + onbId + '/suggestions', null, adminToken);
if (r.status === 200 && Array.isArray(r.body) && r.body.length >= 2) {
  pass(`Admin lists suggestions (${r.body.length} total)`);
} else {
  fail('Admin list suggestions', r);
}

r = await req('GET', '/api/onboarding-requests/' + onbId + '/suggestions', null, userToken);
if (r.status === 200 && Array.isArray(r.body)) {
  pass(`Submitter can list suggestions (${r.body.length} items)`);
} else {
  fail('Submitter list suggestions', r);
}

// Unauthenticated
r = await req('GET', '/api/onboarding-requests/' + onbId + '/suggestions');
if (r.status === 401) pass('Rejects unauthenticated list (401)');
else fail('Should 401 without token', r);

// ── Verify hasReceivedSuggestions flag is set ─────────────────────────────────
r = await req('GET', '/api/onboarding-requests/' + onbId, null, userToken);
if (r.status === 200 && r.body.hasReceivedSuggestions === true) {
  pass('hasReceivedSuggestions=true after suggestion creation');
} else {
  fail('hasReceivedSuggestions should be true', r);
}

// Verify suggestions are hydrated in the detail response
if (r.status === 200 && Array.isArray(r.body.suggestions) && r.body.suggestions.length >= 2) {
  pass(`GET /:id includes hydrated suggestions (${r.body.suggestions.length} items)`);
} else {
  fail('Detail view should include suggestions', r);
}

// ── 3. GET /:id/suggestions/:suggestionId  🔒 ─────────────────────────────────
section('3. GET /onboarding-requests/:id/suggestions/:suggestionId');

r = await req('GET', '/api/onboarding-requests/' + onbId + '/suggestions/' + suggestionId, null, adminToken);
if (r.status === 200 && r.body.id === suggestionId && r.body.photoEdits.length === 2) {
  pass('Admin fetches single suggestion with photoEdits hydrated (200)');
} else {
  fail('Get single suggestion', r);
}

r = await req('GET', '/api/onboarding-requests/' + onbId + '/suggestions/' + suggestionId, null, userToken);
if (r.status === 200 && r.body.id === suggestionId) {
  pass('Submitter fetches single suggestion (200)');
} else {
  fail('Submitter get suggestion', r);
}

r = await req('GET', '/api/onboarding-requests/' + onbId + '/suggestions/non-existent', null, adminToken);
if (r.status === 404) pass('Returns 404 for unknown suggestion');
else fail('Should 404 for unknown suggestion', r);

// ── 4. POST …/photo-edits/:eid/apply  🔒 ──────────────────────────────────────
section('4. POST …/suggestions/:sid/photo-edits/:eid/apply');

const applyPath = `/api/onboarding-requests/${onbId}/suggestions/${suggestionId}/photo-edits/${editId1}/apply`;

r = await req('POST', applyPath, null, userToken);
if (
  r.status === 200 &&
  r.body.photoId === reviewedPhoto1.id &&
  r.body.appliedEdit.appliedBy === user.id &&
  r.body.appliedEdit.appliedAt &&
  r.body.updatedPhoto.name === 'Unidentified Confederate soldier'
) {
  pass('Edit applied — photo metadata updated, appliedBy/appliedAt set (200)');
} else {
  fail('Apply photo edit', r);
}

// Cannot apply same edit twice
r = await req('POST', applyPath, null, userToken);
if (r.status === 422) pass('Cannot apply same edit twice (422)');
else fail('Should 422 for re-apply', r);

// Admin cannot apply (only submitter can)
const applyPath2 = `/api/onboarding-requests/${onbId}/suggestions/${suggestionId}/photo-edits/${editId2}/apply`;
r = await req('POST', applyPath2, null, adminToken);
if (r.status === 403) pass('Admin (non-submitter) is forbidden from applying edits (403)');
else fail('Should 403 for non-submitter apply', r);

// Unknown edit id
r = await req(
  'POST',
  `/api/onboarding-requests/${onbId}/suggestions/${suggestionId}/photo-edits/bad-edit-id/apply`,
  null, userToken
);
if (r.status === 404) pass('Returns 404 for unknown photo edit on apply');
else fail('Should 404 for unknown edit', r);

// ── 5. POST …/photo-edits/:eid/note  🔒 ───────────────────────────────────────
section('5. POST …/suggestions/:sid/photo-edits/:eid/note');

const notePath = `/api/onboarding-requests/${onbId}/suggestions/${suggestionId}/photo-edits/${editId2}/note`;

r = await req('POST', notePath, {
  note: 'I disagree — the buttons are consistent with Union issue.',
}, userToken);
if (r.status === 200 && r.body.responderNote === 'I disagree — the buttons are consistent with Union issue.') {
  pass('Note added to photo edit (200) — responderNote set');
} else {
  fail('Add note to photo edit', r);
}

// Overwrite an existing note (allowed — no restriction in spec)
r = await req('POST', notePath, { note: 'Updated note.' }, userToken);
if (r.status === 200 && r.body.responderNote === 'Updated note.') {
  pass('Note overwritten successfully (200)');
} else {
  fail('Overwrite note', r);
}

// Missing note
r = await req('POST', notePath, {}, userToken);
if (r.status === 400) pass('Rejects missing note field (400)');
else fail('Should 400 for missing note', r);

// Empty note
r = await req('POST', notePath, { note: '   ' }, userToken);
if (r.status === 400) pass('Rejects blank note (400)');
else fail('Should 400 for blank note', r);

// Unknown edit
r = await req(
  'POST',
  `/api/onboarding-requests/${onbId}/suggestions/${suggestionId}/photo-edits/bad-id/note`,
  { note: 'test' }, userToken
);
if (r.status === 404) pass('Returns 404 for unknown photo edit on note');
else fail('Should 404 for unknown edit on note', r);

// Unauthenticated
r = await req('POST', notePath, { note: 'No token.' });
if (r.status === 401) pass('Rejects unauthenticated note (401)');
else fail('Should 401 without token', r);

console.log('\n── Done ──────────────────────────────────────────────────────\n');
