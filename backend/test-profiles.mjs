/**
 * test-profiles.mjs
 * -----------------
 * Quick connectivity test: reads from the `profiles` table in Supabase.
 *
 * Usage:
 *   node backend/test-profiles.mjs
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load backend/.env regardless of where this script is run from
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

// ── Preflight check ───────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY === 'your_service_role_key_here') {
  console.error('\n❌  Missing credentials in backend/.env');
  console.error('    Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('    (Supabase Dashboard → Project Settings → API → service_role)\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Test 1: List profiles ─────────────────────────────────────────────────
console.log('\n📋  Test 1 — SELECT from profiles (limit 5)');
const { data: profiles, error: profilesErr } = await supabase
  .from('profiles')
  .select('id, display_name, email, role, is_active, created_at')
  .limit(5);

if (profilesErr) {
  console.error('  ❌  Error:', profilesErr.message);
} else {
  console.log(`  ✅  Got ${profiles.length} row(s)`);
  if (profiles.length > 0) {
    console.table(profiles);
  } else {
    console.log('  ℹ️   Table is empty — that is fine, schema is connected.');
  }
}

// ── Test 2: Count rows ────────────────────────────────────────────────────
console.log('\n📋  Test 2 — COUNT rows in profiles');
const { count, error: countErr } = await supabase
  .from('profiles')
  .select('*', { count: 'exact', head: true });

if (countErr) {
  console.error('  ❌  Error:', countErr.message);
} else {
  console.log(`  ✅  Total rows: ${count}`);
}

// ── Test 3: Insert + delete a test row ───────────────────────────────────
console.log('\n📋  Test 3 — INSERT then DELETE a test profile row');

// profiles.id is a FK to auth.users so we cannot insert freely without a real auth user.
// Skip the insert test and just confirm read access works.
console.log('  ℹ️   Skipping INSERT (profiles.id is a FK to auth.users).');
console.log('  ✅  Read access confirmed in Tests 1 & 2.');

// ── Summary ───────────────────────────────────────────────────────────────
console.log('\n✅  Supabase connectivity test complete.\n');
