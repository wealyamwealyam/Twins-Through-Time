/**
 * index.js — Entry point
 * ----------------------
 * Loads environment variables BEFORE any other module runs.
 * In ES modules, all `import` statements are hoisted, so dotenv must be
 * loaded here (the first file Node executes) using --env-file or this shim.
 */
import { config } from 'dotenv';
config();                       // loads .env synchronously as the very first thing

// Now safe to import server (which in turn imports supabase.js)
await import('./server.js');
