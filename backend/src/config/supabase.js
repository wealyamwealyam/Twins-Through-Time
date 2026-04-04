/**
 * supabase.js
 * -----------
 * Initialises and exports a single Supabase client that is shared across
 * all models.  Uses the service-role key so that the backend can bypass
 * Row-Level Security when needed.
 *
 * Required environment variables (set in backend/.env):
 *   SUPABASE_URL              – e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY – service_role key from Project Settings → API
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseKey === 'your_service_role_key_here') {
  throw new Error(
    'Missing or placeholder SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in backend/.env.\n' +
    'Go to: Supabase Dashboard → Project Settings → API → service_role key\n' +
    'Then paste it into backend/.env as SUPABASE_SERVICE_ROLE_KEY=<key>'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // The service-role client must NOT auto-persist sessions
    persistSession: false,
    autoRefreshToken: false,
  },
});
