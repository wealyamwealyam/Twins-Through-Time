/**
 * test-writes.mjs
 * ---------------
 * Tests every write operation (INSERT / UPDATE / DELETE) against Supabase
 * directly — no HTTP server required.
 *
 * Covers:
 *   Table 1 — users                   (INSERT, UPDATE, DELETE)
 *   Table 2 — refresh_tokens          (INSERT, DELETE)
 *   Table 3 — reset_tokens            (INSERT, UPDATE used=true, DELETE)
 *   Table 4 — scrape_jobs             (INSERT, UPDATE status, DELETE)
 *   Table 5 — photos                  (INSERT, UPDATE metadata+status, DELETE)
 *   Table 6 — onboarding_requests     (INSERT, UPDATE status, DELETE)
 *   Table 7 — suggestions             (INSERT, DELETE)
 *   Table 8 — suggested_photo_edits   (INSERT, UPDATE applied_at, DELETE)
 *   Table 9 — account_change_requests (INSERT, UPDATE status, DELETE)
 *
 * Usage:
 *   node backend/test-writes.mjs          # writes, pauses for inspection, then cleans up
 *   node backend/test-writes.mjs --keep   # writes and exits WITHOUT deleting (data stays in DB)
 *   node backend/test-writes.mjs --clean  # deletes any leftover rows from a previous --keep run
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { createInterface } from 'readline';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

// ── CLI flags ─────────────────────────────────────────────────────────────────
const KEEP_FILE = resolve(__dirname, '.test-writes-ids.json');
const flag = process.argv[2]; // --keep | --clean | (none)

const MODE_KEEP  = flag === '--keep';
const MODE_CLEAN = flag === '--clean';

import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY === 'your_service_role_key_here') {
  console.error('\n❌  Missing or placeholder credentials in backend/.env');
  console.error('    Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function ok(label) {
  console.log(`  ✅  ${label}`);
  passed++;
}
function ko(label, detail) {
  console.log(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
  failed++;
  failures.push({ label, detail });
}
function check(label, condition, detail = '') {
  condition ? ok(label) : ko(label, detail);
}

const tok = () => randomBytes(40).toString('hex');
const UNIQUE = Date.now();

// Track created IDs for cleanup
const c = {};

// ── --clean mode: load saved IDs and jump straight to cleanup ─────────────────
if (MODE_CLEAN) {
  if (!existsSync(KEEP_FILE)) {
    console.log('\n⚠️   No saved IDs file found (.test-writes-ids.json). Nothing to clean.\n');
    process.exit(0);
  }
  Object.assign(c, JSON.parse(readFileSync(KEEP_FILE, 'utf8')));
  console.log('\n🧹  --clean mode: deleting rows from previous --keep run...');
  console.log('    IDs loaded:', JSON.stringify(c, null, 2));
}

// ── Skip all writes in --clean mode ──────────────────────────────────────────
if (!MODE_CLEAN) {

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 1 — users
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TABLE 1: users ───────────────────────────────────────────');

// INSERT main test user
{
  const { data, error } = await sb.from('users').insert({
    username:      `testwrite_${UNIQUE}`,
    email:         `testwrite_${UNIQUE}@example.com`,
    password_hash: '$2b$10$fakehashforwritetest000000000000000000000000000000000',
    first_name:    'Write',
    last_name:     'Test',
    account_type:  'community_member',
    is_active:     true,
  }).select().single();

  check('INSERT user', !error && !!data?.id, error?.message);
  if (data) c.userId = data.id;
}

// INSERT admin/reviewer user
{
  const { data, error } = await sb.from('users').insert({
    username:      `testreviewer_${UNIQUE}`,
    email:         `testreviewer_${UNIQUE}@example.com`,
    password_hash: '$2b$10$fakehashforwritetest000000000000000000000000000000000',
    first_name:    'Reviewer',
    last_name:     'Admin',
    account_type:  'admin',
    is_active:     true,
  }).select().single();

  check('INSERT admin user', !error && !!data?.id, error?.message);
  if (data) c.reviewerId = data.id;
}

// UPDATE user
if (c.userId) {
  const { error } = await sb.from('users')
    .update({ first_name: 'Updated' })
    .eq('id', c.userId);
  check('UPDATE user first_name', !error, error?.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 2 — refresh_tokens
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TABLE 2: refresh_tokens ──────────────────────────────────');

if (c.userId) {
  const token = tok();
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const { data, error } = await sb.from('refresh_tokens').insert({
    token,
    user_id:    c.userId,
    expires_at: expiresAt,
  }).select().single();

  check('INSERT refresh_token', !error && data?.token === token, error?.message);
  if (data) c.refreshToken = token;

  if (c.refreshToken) {
    const { error: delErr } = await sb.from('refresh_tokens').delete().eq('token', c.refreshToken);
    check('DELETE refresh_token', !delErr, delErr?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 3 — reset_tokens
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TABLE 3: reset_tokens ────────────────────────────────────');

if (c.userId) {
  const token = tok();
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

  const { data, error } = await sb.from('reset_tokens').insert({
    token,
    user_id:    c.userId,
    expires_at: expiresAt,
    used:       false,
  }).select().single();

  check('INSERT reset_token', !error && data?.used === false, error?.message);
  if (data) c.resetToken = token;

  if (c.resetToken) {
    const { error: updErr } = await sb.from('reset_tokens')
      .update({ used: true })
      .eq('token', c.resetToken);
    check('UPDATE reset_token used=true', !updErr, updErr?.message);
  }

  if (c.resetToken) {
    const { error: delErr } = await sb.from('reset_tokens').delete().eq('token', c.resetToken);
    check('DELETE reset_token', !delErr, delErr?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 4 — scrape_jobs
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TABLE 4: scrape_jobs ─────────────────────────────────────');

if (c.userId) {
  const { data, error } = await sb.from('scrape_jobs').insert({
    url:          'https://example.com/civil-war-photos',
    max_photos:   50,
    status:       'queued',
    submitted_by: c.userId,
    photo_count:  0,
  }).select().single();

  check('INSERT scrape_job', !error && !!data?.id, error?.message);
  if (data) c.scrapeJobId = data.id;

  if (c.scrapeJobId) {
    const { error: e2 } = await sb.from('scrape_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', c.scrapeJobId);
    check('UPDATE scrape_job status=running', !e2, e2?.message);
  }

  if (c.scrapeJobId) {
    const { error: e3 } = await sb.from('scrape_jobs')
      .update({ status: 'completed', photo_count: 12, completed_at: new Date().toISOString() })
      .eq('id', c.scrapeJobId);
    check('UPDATE scrape_job status=completed', !e3, e3?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 5 — photos
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TABLE 5: photos ──────────────────────────────────────────');

if (c.userId && c.scrapeJobId) {
  const { data, error } = await sb.from('photos').insert({
    scrape_job_id:     c.scrapeJobId,
    submitted_by:      c.userId,
    image_url:         'https://example.com/photo1.jpg',
    status:            'pending_review',
    is_duplicate:      false,
    is_auto_extracted: true,
    name:              'Unknown Soldier',
    regiment:          '1st Virginia Infantry',
    tags:              ['portrait', 'union'],
  }).select().single();

  check('INSERT photo', !error && !!data?.id, error?.message);
  if (data) c.photoId = data.id;

  if (c.photoId) {
    const { error: e2 } = await sb.from('photos')
      .update({
        name:               'John Doe',
        location:           'Richmond, VA',
        date_taken:         '1863',
        metadata_edited_by: c.userId,
        metadata_edited_at: new Date().toISOString(),
      })
      .eq('id', c.photoId);
    check('UPDATE photo metadata', !e2, e2?.message);
  }

  if (c.photoId) {
    const { error: e3 } = await sb.from('photos')
      .update({ status: 'reviewed' })
      .eq('id', c.photoId);
    check('UPDATE photo status=reviewed', !e3, e3?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 6 — onboarding_requests
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TABLE 6: onboarding_requests ─────────────────────────────');

if (c.userId && c.photoId) {
  const { data, error } = await sb.from('onboarding_requests').insert({
    onboarding_request_title: 'Test Batch Upload',
    onboarding_request_notes: 'Write-test batch.',
    submitted_by:             c.userId,
    status:                   'pending',
    photo_ids:                [c.photoId],
  }).select().single();

  check('INSERT onboarding_request', !error && !!data?.id, error?.message);
  if (data) c.onboardingId = data.id;

  if (c.onboardingId && c.reviewerId) {
    const { error: e2 } = await sb.from('onboarding_requests')
      .update({ status: 'under_review', reviewer_id: c.reviewerId })
      .eq('id', c.onboardingId);
    check('UPDATE onboarding_request status=under_review', !e2, e2?.message);
  }

  if (c.onboardingId && c.reviewerId) {
    const { error: e3 } = await sb.from('onboarding_requests')
      .update({
        status:      'approved',
        reviewed_by: c.reviewerId,
        reviewed_at: new Date().toISOString(),
        admin_note:  'Looks good.',
      })
      .eq('id', c.onboardingId);
    check('UPDATE onboarding_request status=approved', !e3, e3?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 7 — suggestions
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TABLE 7: suggestions ─────────────────────────────────────');

if (c.onboardingId && c.reviewerId) {
  const { data, error } = await sb.from('suggestions').insert({
    onboarding_request_id:   c.onboardingId,
    reviewer_id:             c.reviewerId,
    onboarding_request_note: 'Please verify regiment name.',
  }).select().single();

  check('INSERT suggestion', !error && !!data?.id, error?.message);
  if (data) c.suggestionId = data.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 8 — suggested_photo_edits
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TABLE 8: suggested_photo_edits ───────────────────────────');

if (c.suggestionId && c.photoId) {
  const { data, error } = await sb.from('suggested_photo_edits').insert({
    suggestion_id:      c.suggestionId,
    original_photo_id:  c.photoId,
    suggested_name:     'John A. Doe',
    suggested_regiment: '2nd Virginia Infantry',
    suggested_tags:     ['portrait', 'confederate'],
    suggested_notes:    'Regiment appears to be 2nd, not 1st.',
  }).select().single();

  check('INSERT suggested_photo_edit', !error && !!data?.id, error?.message);
  if (data) c.editId = data.id;

  if (c.editId) {
    const { error: e2 } = await sb.from('suggested_photo_edits')
      .update({
        applied_at:     new Date().toISOString(),
        applied_by:     c.reviewerId,
        responder_note: 'Applied after verification.',
      })
      .eq('id', c.editId);
    check('UPDATE suggested_photo_edit applied_at', !e2, e2?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 9 — account_change_requests
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TABLE 9: account_change_requests ─────────────────────────');

if (c.userId) {
  const { data, error } = await sb.from('account_change_requests').insert({
    user_id:            c.userId,
    current_account:    'community_member',
    requesting_account: 'contributor',
    reason_message:     'I have uploaded 50+ verified photos.',
    status:             'pending',
  }).select().single();

  check('INSERT account_change_request', !error && !!data?.id, error?.message);
  if (data) c.acrId = data.id;

  if (c.acrId && c.reviewerId) {
    const { error: e2 } = await sb.from('account_change_requests')
      .update({
        status:      'approved',
        admin_note:  'Approved after review.',
        reviewed_by: c.reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', c.acrId);
    check('UPDATE account_change_request status=approved', !e2, e2?.message);
  }
}

// ── End of write section ──────────────────────────────────────────────────────
} // end if (!MODE_CLEAN)

// ─────────────────────────────────────────────────────────────────────────────
// PAUSE or KEEP — let user inspect the DB before cleanup
// ─────────────────────────────────────────────────────────────────────────────
if (MODE_KEEP) {
  // Save IDs so --clean can find them later
  writeFileSync(KEEP_FILE, JSON.stringify(c, null, 2));
  console.log('\n📌  --keep mode: data has been written to the database and will NOT be deleted.');
  console.log('    You can now inspect the tables in the Supabase dashboard:');
  console.log('    https://supabase.com/dashboard/project/lswuvxwfiffqxfhoizah/editor');
  console.log('\n    Saved row IDs to .test-writes-ids.json');
  console.log('    Run  node backend/test-writes.mjs --clean  when done to delete the test rows.\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\n  Failed checks:');
    failures.forEach(({ label, detail }) =>
      console.log(`    ❌  ${label}${detail ? ': ' + detail : ''}`)
    );
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

if (!MODE_CLEAN) {
  // Default mode: pause and wait for Enter before cleaning up
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('  ⏸   Data written. Inspect the tables now in Supabase:');
  console.log('      https://supabase.com/dashboard/project/lswuvxwfiffqxfhoizah/editor');
  console.log('\n      Written IDs:');
  Object.entries(c).forEach(([k, v]) => console.log(`        ${k}: ${v}`));
  console.log('\n  Press ENTER to delete the test rows and finish...');
  console.log('──────────────────────────────────────────────────────────────');

  await new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => { rl.close(); resolve(); });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP — delete in reverse FK order so constraints are respected
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── CLEANUP ──────────────────────────────────────────────────');

if (c.editId) {
  const { error } = await sb.from('suggested_photo_edits').delete().eq('id', c.editId);
  check('DELETE suggested_photo_edit', !error, error?.message);
}
if (c.suggestionId) {
  const { error } = await sb.from('suggestions').delete().eq('id', c.suggestionId);
  check('DELETE suggestion', !error, error?.message);
}
if (c.acrId) {
  const { error } = await sb.from('account_change_requests').delete().eq('id', c.acrId);
  check('DELETE account_change_request', !error, error?.message);
}
if (c.onboardingId) {
  const { error } = await sb.from('onboarding_requests').delete().eq('id', c.onboardingId);
  check('DELETE onboarding_request', !error, error?.message);
}
if (c.photoId) {
  const { error } = await sb.from('photos').delete().eq('id', c.photoId);
  check('DELETE photo', !error, error?.message);
}
if (c.scrapeJobId) {
  const { error } = await sb.from('scrape_jobs').delete().eq('id', c.scrapeJobId);
  check('DELETE scrape_job', !error, error?.message);
}
// users last — CASCADE handles refresh/reset tokens
if (c.reviewerId) {
  const { error } = await sb.from('users').delete().eq('id', c.reviewerId);
  check('DELETE reviewer user', !error, error?.message);
}
if (c.userId) {
  const { error } = await sb.from('users').delete().eq('id', c.userId);
  check('DELETE test user', !error, error?.message);
}

// Remove the saved IDs file if it exists
if (existsSync(KEEP_FILE)) {
  const { unlinkSync } = await import('fs');
  unlinkSync(KEEP_FILE);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\n  Failed checks:');
  failures.forEach(({ label, detail }) =>
    console.log(`    ❌  ${label}${detail ? ': ' + detail : ''}`)
  );
}
console.log('═══════════════════════════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
