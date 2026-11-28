// Live smoke tests against the deployed Chatora site.
// Run: node tests/e2e-smoke.mjs                 (defaults to https://chatora.us.ci)
//      BASE=http://localhost:8787 node tests/e2e-smoke.mjs
//
// Safe by design: no auth, no account creation, no state changes. The only
// POST bodies are intentionally invalid inputs that must be rejected.

const BASE = (process.env.BASE || 'https://chatora.us.ci').replace(/\/+$/, '');
let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { pass++; console.log('ok   ' + name); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
async function get(path, opts) {
  const t0 = Date.now();
  const r = await fetch(BASE + path, { redirect: 'manual', ...opts });
  return { r, ms: Date.now() - t0 };
}

/* ---- static pages and locales ---- */
{
  const { r, ms } = await get('/');
  const html = await r.text();
  ok('GET / is 200', r.status === 200, 'got ' + r.status);
  ok('GET / TTFB+body < 5s', ms < 5000, ms + 'ms');
  ok('home has <title>', /<title>[^<]{5,}<\/title>/.test(html));
  ok('home shows chatora.us.ci not old ansygroup domain', !html.includes('ansygroup.com'), 'old domain leaked');
  ok('home links a stylesheet', /href="(\/)?assets\/css\//.test(html));
  ok('home has meta description', /<meta [^>]*name="description"/.test(html) || /<meta name="description"/.test(html));
}
for (const [loc, expectRtl] of [['ar', true], ['es', false], ['fr', false], ['de', false], ['pt', false]]) {
  const { r } = await get('/' + loc + '/');
  const html = await r.text();
  ok('GET /' + loc + '/ is 200', r.status === 200, 'got ' + r.status);
  ok('/' + loc + '/ has lang=' + loc, new RegExp('<html[^>]*lang="' + loc).test(html));
  if (expectRtl) ok('/ar/ is dir=rtl', /<html[^>]*dir="rtl"/.test(html));
}
{
  const { r } = await get('/this-page-does-not-exist-qa');
  const html = await r.text();
  ok('unknown page returns real 404 status', r.status === 404, 'got ' + r.status + ' (soft-404 hurts SEO)');
  ok('404 page renders the 404 template', /404/.test(html));
}
{
  const { r } = await get('/ar/no-such-page-qa');
  ok('unknown /ar/ page returns 404', r.status === 404, 'got ' + r.status);
}
{
  const { r } = await get('/manifest.json');
  const j = await r.json().catch(() => null);
  ok('manifest.json is valid PWA manifest', r.status === 200 && j && j.name === 'Chatora');
}
{
  const { r } = await get('/robots.txt');
  ok('robots.txt served', r.status === 200 && (await r.text()).includes('Sitemap:'));
}
{
  const { r } = await get('/sitemap.xml');
  const x = await r.text();
  ok('sitemap.xml served and current-domain', r.status === 200 && x.includes('chatora.us.ci') && !x.includes('ansygroup.com'), 'stale domain in sitemap');
}
{
  const { r } = await get('/llms.txt');
  ok('llms.txt served', r.status === 200);
}
{
  const { r } = await get('/assets/widget.js');
  ok('widget.js asset served', r.status === 200, 'got ' + r.status);
}
{
  const { r } = await get('/favicon.ico');
  ok('favicon.ico redirects (301)', r.status === 301, 'got ' + r.status);
}
{
  const { r } = await get('/quiz.html');
  ok('quiz.html redirects to pricing (301)', r.status === 301 && (r.headers.get('location') || '').includes('/pricing.html'), 'got ' + r.status);
}
{
  const { r } = await get('/compare');
  ok('/compare redirects to compare.html', r.status === 301, 'got ' + r.status);
}

/* ---- security headers ---- */
{
  const { r } = await get('/');
  const h = r.headers;
  ok('CSP present', !!h.get('content-security-policy'));
  ok('CSP has no unsafe-inline for scripts', !(h.get('content-security-policy') || '').match(/script-src[^;]*unsafe-inline/));
  ok('X-Frame-Options DENY', h.get('x-frame-options') === 'DENY');
  ok('X-Content-Type-Options nosniff', h.get('x-content-type-options') === 'nosniff');
  ok('HSTS present', /max-age=\d{7,}/.test(h.get('strict-transport-security') || ''));
  ok('Referrer-Policy set', !!h.get('referrer-policy'));
  ok('/app.html is noindex', (await get('/app.html')).r.headers.get('x-robots-tag') === 'noindex, nofollow');
}

/* ---- public API surface: auth and validation ---- */
{
  const { r } = await get('/api/v1');
  const j = await r.json().catch(() => null);
  ok('GET /api/v1 discovery JSON', r.status === 200 && j && j.openapi);
}
{
  const { r } = await get('/api/v1/openapi.json');
  const j = await r.json().catch(() => null);
  ok('openapi.json valid', r.status === 200 && j && /^3\./.test(j.openapi || ''));
}
{
  const { r } = await get('/api/v1/contacts');
  ok('GET /api/v1/contacts without key is 401', r.status === 401, 'got ' + r.status);
}
{
  const { r } = await get('/api/v1/contacts', { headers: { authorization: 'Bearer chk_live_' + '0'.repeat(40) } });
  ok('forged-format API key is 401 not 500', r.status === 401, 'got ' + r.status);
}
{
  const { r } = await get('/mcp');
  ok('GET /mcp is 405 (stateless, POST only)', r.status === 405, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }) });
  ok('POST /mcp without key is 401', r.status === 401, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/widget/config?key=nope');
  ok('widget config with malformed key is 404', r.status === 404, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/widget/config?key=ck_' + '0'.repeat(32));
  ok('widget config with unknown valid-format key is 404 not 500', r.status === 404, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/widget/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not json' });
  ok('widget chat bad JSON is 400', r.status === 400, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/widget/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'ck_' + '0'.repeat(32), visitor: 'qa', messages: [{ role: 'user', content: 'hi' }] }) });
  ok('widget chat unknown key is 404', r.status === 404, 'got ' + r.status);
}
{
  const big = JSON.stringify({ key: 'ck_' + '0'.repeat(32), visitor: 'qa', messages: [{ role: 'user', content: 'x'.repeat(9000) }] });
  const r = await fetch(BASE + '/api/widget/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: big });
  ok('widget chat over-size body is 413', r.status === 413, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/widget/chat', { method: 'OPTIONS', headers: { origin: 'https://qa.example.com', 'access-control-request-method': 'POST' } });
  ok('widget chat OPTIONS preflight 204 with CORS', r.status === 204 && !!r.headers.get('access-control-allow-origin'), 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/channels/telegram/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: '123456:' + 'A'.repeat(35), workspace: '00000000-0000-0000-0000-000000000000' }) });
  ok('telegram connect without Bearer is 401', r.status === 401, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/automation/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  ok('automation event without Bearer is 401', r.status === 401, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/broadcast/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  ok('broadcast send without Bearer is 401', r.status === 401, 'got ' + r.status);
}
{
  const { r } = await get('/l/zzzzzz');
  ok('unknown short link is 404', r.status === 404, 'got ' + r.status);
}
{
  const { r } = await get('/l/invalid!!code');
  ok('malformed short link code is 404', r.status === 404, 'got ' + r.status);
}

/* ---- /api/chat (site AI chat) abuse checks ---- */
{
  const r = await fetch(BASE + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example.com' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) });
  ok('api/chat rejects foreign origin (403)', r.status === 403, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not json' });
  ok('api/chat bad JSON is 400', r.status === 400, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'assistant', content: 'only assistant' }] }) });
  ok('api/chat with no trailing user message is 400', r.status === 400, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/chat', { method: 'GET' });
  ok('api/chat GET is 405', r.status === 405, 'got ' + r.status);
}

/* ---- /api/lead validation ---- */
{
  const r = await fetch(BASE + '/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email', client_id: 'qa' }) });
  ok('lead with invalid email is 400', r.status === 400, 'got ' + r.status);
}
{
  const r = await fetch(BASE + '/api/lead', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example.com' }, body: JSON.stringify({ email: 'qa@example.com', client_id: 'qa' }) });
  ok('lead rejects foreign origin (403)', r.status === 403, 'got ' + r.status);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed against ' + BASE);
if (failures.length) { console.log('failures:'); for (const f of failures) console.log(' - ' + f); process.exit(1); }
