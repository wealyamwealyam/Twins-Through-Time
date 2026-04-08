/**
 * test-validate-scrape-url.mjs
 * ----------------------------
 * Focused integration tests for the merged validateScrapeUrl rules.
 *
 * Covers every rule documented in validators.js:
 *   ✓ Required / type check
 *   ✓ Max 2048 characters
 *   ✓ Must be parseable as a URL
 *   ✓ Protocol must be http or https
 *   ✓ No embedded credentials (user:pass@host)
 *   ✓ No private / reserved IP ranges (SSRF)
 *   ✓ Hostname must contain a dot (no bare names like "intranet")
 *   ✓ Valid public URLs are accepted
 *
 * Run: node test-validate-scrape-url.mjs
 */

const BASE = 'http://localhost:3000/api';

let pass = 0;
let fail = 0;

const check = (label, ok, extra = '') => {
  if (ok) { console.log(`  ✅ ${label}`); pass++; }
  else     { console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); fail++; }
};

// Seed to get an auth token
const seed  = await fetch(`${BASE}/test/seed`, { method: 'POST' });
const token = (await seed.json()).userToken;

const submit = (url, maxPhotos = 10) =>
  fetch(`${BASE}/scrape-jobs`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ url, maxPhotos }),
  });

// ── Required / type ──────────────────────────────────────────────────────────
console.log('\n── Required / type checks');

{
  const r = await submit(undefined);
  check('400 — url is required (undefined)', r.status === 400);
}
{
  const r = await submit('');
  check('400 — url is required (empty string)', r.status === 400);
}
{
  const r = await submit(null);
  check('400 — url is required (null)', r.status === 400);
}
{
  const r = await submit(12345);
  check('400 — url must be a string (number)', r.status === 400);
}

// ── URL length ───────────────────────────────────────────────────────────────
console.log('\n── URL length');

{
  const longUrl = 'https://example.com/' + 'a'.repeat(2048);
  const r = await submit(longUrl);
  check('400 — URL > 2048 characters rejected', r.status === 400);
}
{
  // Exactly at the limit — path of 2048 - len('https://example.com/') chars
  const maxUrl = 'https://example.com/' + 'a'.repeat(2048 - 'https://example.com/'.length);
  check('URL at exactly 2048 chars is within limit', maxUrl.length === 2048);
  const r = await submit(maxUrl);
  check('201 — URL at exactly 2048 characters accepted', r.status === 201);
}

// ── Invalid URL format ───────────────────────────────────────────────────────
console.log('\n── Invalid URL format');

{
  const r = await submit('not-a-url-at-all');
  check('400 — bare string is not a URL', r.status === 400);
}
{
  const r = await submit('example.com/path');
  check('400 — missing protocol', r.status === 400);
}
{
  const r = await submit('//example.com/path');
  check('400 — protocol-relative URL rejected', r.status === 400);
}

// ── Protocol enforcement ─────────────────────────────────────────────────────
console.log('\n── Protocol enforcement');

{
  const r = await submit('ftp://example.com/files');
  check('400 — ftp:// rejected', r.status === 400);
}
{
  const r = await submit('file:///etc/passwd');
  check('400 — file:// rejected', r.status === 400);
}
{
  const r = await submit('javascript:alert(1)');
  check('400 — javascript: rejected', r.status === 400);
}
{
  const r = await submit('http://example.com/page');
  check('201 — http:// accepted', r.status === 201);
}
{
  const r = await submit('https://example.com/page');
  check('201 — https:// accepted', r.status === 201);
}

// ── Embedded credentials ─────────────────────────────────────────────────────
console.log('\n── Embedded credentials');

{
  const r = await submit('https://user:pass@example.com/path');
  check('400 — user:pass@host rejected', r.status === 400);
}
{
  const r = await submit('https://user@example.com/path');
  check('400 — user@host (no password) rejected', r.status === 400);
}

// ── Private / reserved IP ranges (SSRF) ─────────────────────────────────────
console.log('\n── SSRF / private IP protection');

const ssrfCases = [
  ['http://localhost/data',              'localhost'],
  ['http://127.0.0.1/data',             '127.x loopback'],
  ['http://127.99.0.1/data',            '127.x loopback (non-zero)'],
  ['http://10.0.0.1/data',              '10.x private'],
  ['http://10.255.255.255/data',        '10.x private (upper)'],
  ['http://192.168.0.1/data',           '192.168.x private'],
  ['http://192.168.255.1/data',         '192.168.x private (upper)'],
  ['http://172.16.0.1/data',            '172.16-31.x private'],
  ['http://172.31.255.255/data',        '172.31.x private (upper)'],
  ['http://169.254.1.1/data',           '169.254 link-local'],
  ['http://[::1]/data',                 'IPv6 loopback'],
  ['http://[fc00::1]/data',             'IPv6 ULA fc00'],
  ['http://[fe80::1]/data',             'IPv6 link-local fe80'],
];

for (const [url, label] of ssrfCases) {
  const r = await submit(url);
  check(`400 — ${label} blocked`, r.status === 400);
}

// ── Bare hostnames (no dot) ──────────────────────────────────────────────────
console.log('\n── Bare hostname rejection');

{
  const r = await submit('http://intranet/page');
  check('400 — bare hostname "intranet" rejected', r.status === 400);
}
{
  const r = await submit('http://myserver/api');
  check('400 — bare hostname "myserver" rejected', r.status === 400);
}

// ── Valid public URLs accepted ───────────────────────────────────────────────
console.log('\n── Valid public URLs');

const validCases = [
  'https://www.civilwarsleuth.com/photos',
  'https://contentdm.library.cornell.edu/digital/collection/p16694coll19',
  'http://example.com',
  'https://sub.domain.example.co.uk/path?query=1&page=2',
  'https://example.com/path#fragment',
];

for (const url of validCases) {
  const r = await submit(url);
  check(`201 — accepted: ${url.slice(0, 60)}`, r.status === 201);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n── Done ─────────────────────────────────────────────────────────────`);
console.log(`   ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
