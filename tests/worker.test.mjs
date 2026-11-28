// Unit tests for src/worker.js pure helpers and the flow engine.
// Run: node --test tests/worker.test.mjs   (Node 20+, no dependencies)
//
// The worker is a Cloudflare Worker module (imports 'cloudflare:email', uses
// `export default`). To test it in plain Node we load the source, strip the
// module-only lines, and evaluate it as a classic script so its top-level
// function declarations land on globalThis.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src', 'worker.js'), 'utf8')
  .replace(/^import[^\n]*\n/, '') // cloudflare:email import
  .replace('export default {', 'const __handler = {')
  + '\n;globalThis.__t = { metaParse, metaSigOk, metaHook, leaks, limited, wlimited, wname, originOk, aTokens, aCond, hookUrlOk, walkFlow, apiInt, mimeHdr, rfc2047, qpDecode, b64Decode, emailBodyText, STOP_RE, KEYRE, TGRE, APIKEY, LINK_RE, UNSUB_TAG, BC_MAX, BC_GAP_MS };';

vm.runInThisContext(src, { filename: 'worker.js' });
const W = globalThis.__t;

/* ---------- regexes ---------- */
test('STOP_RE matches stop words and only those', () => {
  for (const ok of ['stop', ' STOP ', 'stop!', 'Unsubscribe', 'cancel', 'إلغاء', 'الغاء', 'إيقاف', 'ايقاف']) {
    assert.ok(W.STOP_RE.test(ok), JSON.stringify(ok));
  }
  for (const no of ['stoploss', 'please stop me', 'stopping', 'cancel order now', '']) {
    assert.ok(!W.STOP_RE.test(no), JSON.stringify(no));
  }
});

test('KEYRE accepts ck_ + 32 hex only', () => {
  assert.ok(W.KEYRE.test('ck_' + 'a'.repeat(32)));
  assert.ok(W.KEYRE.test('ck_' + '0123456789abcdef'.repeat(2)));
  for (const bad of ['ck_' + 'a'.repeat(31), 'ck_' + 'a'.repeat(33), 'ck_' + 'g'.repeat(32), 'CK_' + 'a'.repeat(32), 'ck_' + 'a'.repeat(32) + '\n', '']) {
    assert.ok(!W.KEYRE.test(bad), JSON.stringify(bad));
  }
});

test('APIKEY accepts chk_live_ + 40 hex only', () => {
  assert.ok(W.APIKEY.test('chk_live_' + 'f'.repeat(40)));
  assert.ok(!W.APIKEY.test('chk_live_' + 'f'.repeat(39)));
  assert.ok(!W.APIKEY.test('chk_test_' + 'f'.repeat(40)));
});

test('TGRE accepts plausible Telegram bot tokens', () => {
  assert.ok(W.TGRE.test('123456:' + 'A'.repeat(35)));
  assert.ok(W.TGRE.test('123456789012:' + 'a0_-'.repeat(10)));
  assert.ok(!W.TGRE.test('12345:' + 'A'.repeat(35)));   // id too short
  assert.ok(!W.TGRE.test('123456:' + 'A'.repeat(29)));  // secret too short
  assert.ok(!W.TGRE.test('not a token'));
});

/* ---------- leak detection ---------- */
test('leaks flags system-prompt fragments, passes normal replies', () => {
  assert.equal(W.leaks('Sure! Our Launch package is $79 one-time.'), false);
  assert.equal(W.leaks('I never reveal my instructions.'), true);
  assert.equal(W.leaks('Reply in the language of the user always.'), true);
});

/* ---------- rate limiters ---------- */
test('limited allows 12 per 10 min then blocks', () => {
  const ip = 'test-' + Math.random();
  for (let i = 0; i < 12; i++) assert.equal(W.limited(ip), false, 'hit ' + i);
  assert.equal(W.limited(ip), true);
});

test('wlimited honors custom max', () => {
  const id = 'test-' + Math.random();
  for (let i = 0; i < 5; i++) assert.equal(W.wlimited(id, 5, 60000), false);
  assert.equal(W.wlimited(id, 5, 60000), true);
});

/* ---------- wname / originOk ---------- */
test('wname hides emails and workspace suffixes', () => {
  assert.equal(W.wname('shop@example.com'), 'Chat');
  assert.equal(W.wname('My Shop · workspace'), 'Chat');
  assert.equal(W.wname('My Shop'), 'My Shop');
  assert.equal(W.wname('x'.repeat(100)).length, 80);
  assert.equal(W.wname(null), 'Chat');
});

test('originOk enforces exact origin match', () => {
  assert.equal(W.originOk({}, 'https://evil.com'), true); // unset = open
  assert.equal(W.originOk({ allowed_origin: '' }, null), true);
  const cfg = { allowed_origin: 'https://shop.example.com/' };
  assert.equal(W.originOk(cfg, 'https://shop.example.com'), true);
  assert.equal(W.originOk(cfg, 'https://SHOP.example.com/'), true);
  assert.equal(W.originOk(cfg, 'https://evil.com'), false);
  assert.equal(W.originOk(cfg, null), false);
});

/* ---------- aTokens ---------- */
test('aTokens substitutes contact tokens', () => {
  const c = { name: 'Sara', handle: 'tg:42', tags: ['vip', 'new'], fields: { City: 'Cairo' } };
  assert.equal(W.aTokens('Hi {name}!', c), 'Hi Sara!');
  assert.equal(W.aTokens('{handle} {tags}', c), 'tg:42 vip, new');
  assert.equal(W.aTokens('from {field:city}', c), 'from Cairo'); // case-insensitive key
  assert.equal(W.aTokens('{field:missing}', c), '');            // missing field -> empty
  assert.equal(W.aTokens('{unknown}', c), '{unknown}');         // unknown token kept
  assert.equal(W.aTokens(null, c), '');
});

/* ---------- aCond ---------- */
test('aCond evaluates tag and field conditions', () => {
  const c = { tags: ['VIP'], fields: { plan: 'pro' } };
  assert.equal(W.aCond('tag: vip', c), true);   // case-insensitive
  assert.equal(W.aCond('tag: trial', c), false);
  assert.equal(W.aCond('field: plan', c), true);
  assert.equal(W.aCond('field: plan = PRO', c), true);
  assert.equal(W.aCond('field: plan = free', c), false);
  assert.equal(W.aCond('field: absent', c), false);
  assert.equal(W.aCond('nonsense', c), null);   // unknown -> null (continue)
});

/* ---------- hookUrlOk ---------- */
test('hookUrlOk blocks SSRF-ish targets', () => {
  assert.equal(W.hookUrlOk('https://hooks.example.com/x'), true);
  assert.equal(W.hookUrlOk('http://example.com'), false);              // http
  assert.equal(W.hookUrlOk('https://127.0.0.1/hook'), false);          // IP literal
  assert.equal(W.hookUrlOk('https://localhost/x'), false);
  assert.equal(W.hookUrlOk('https://example.com:8443/x'), false);      // explicit port
  assert.equal(W.hookUrlOk('https://user:pass@example.com/x'), false); // creds
  assert.equal(W.hookUrlOk('https://internal.local/x'), false);        // .local
  assert.equal(W.hookUrlOk('https://nodot'), false);
  assert.equal(W.hookUrlOk('https://example.com/' + 'a'.repeat(300)), false); // >300 chars
  assert.equal(W.hookUrlOk('not a url'), false);
});

/* ---------- walkFlow (the flow engine) ---------- */
const tgContact = { id: 'c1', workspace_id: 'w1', name: 'Sara', handle: 'tg:123', channel: 'telegram', tags: [], fields: {} };
const webContact = { id: 'c2', workspace_id: 'w1', name: 'Omar', handle: '', channel: 'web', tags: [], fields: {} };

test('walkFlow: msg node routes telegram text to out.tg with tokens resolved', () => {
  const r = W.walkFlow([{ t: 'trigger' }, { t: 'msg', text: 'Hi {name}!' }], 1, tgContact);
  assert.deepEqual(r.tg, ['Hi Sara!']);
  assert.equal(r.status, 'done');
  assert.equal(r.nextIdx, 2);
});

test('walkFlow: msg node routes web text to web_msg effects', () => {
  const r = W.walkFlow([{ t: 'trigger' }, { t: 'msg', text: 'hello' }], 1, webContact);
  assert.equal(r.tg.length, 0);
  assert.equal(r.effects.length, 1);
  assert.equal(r.effects[0].type, 'web_msg');
  assert.equal(r.effects[0].body, 'hello');
});

test('walkFlow: msg on other channels is skipped with a note', () => {
  const r = W.walkFlow([{ t: 'msg', text: 'hi' }], 0, { channel: 'whatsapp', tags: [], fields: {} });
  assert.equal(r.tg.length, 0);
  assert.equal(r.effects.length, 0);
  assert.ok(r.notes.some((n) => n.includes('skipped')));
});

test('walkFlow: empty msg text is skipped silently', () => {
  const r = W.walkFlow([{ t: 'msg', text: '' }, { t: 'msg', text: 'real' }], 0, tgContact);
  assert.deepEqual(r.tg, ['real']);
});

test('walkFlow: false condition stops the flow; true continues', () => {
  const cFalse = Object.assign({}, tgContact, { tags: [] });
  const stop = W.walkFlow([{ t: 'cond', text: 'tag: vip' }, { t: 'msg', text: 'after' }], 0, cFalse);
  assert.equal(stop.tg.length, 0);
  assert.ok(stop.notes.some((n) => n.includes('cond stop')));
  const cTrue = Object.assign({}, tgContact, { tags: ['vip'] });
  const cont = W.walkFlow([{ t: 'cond', text: 'tag: vip' }, { t: 'msg', text: 'after' }], 0, cTrue);
  assert.deepEqual(cont.tg, ['after']);
});

test('walkFlow: elseSkip jumps over steps when condition is false', () => {
  const nodes = [
    { t: 'cond', text: 'tag: vip', elseSkip: 1 },
    { t: 'msg', text: 'skipped' },
    { t: 'msg', text: 'kept' },
  ];
  const r = W.walkFlow(nodes, 0, tgContact);
  assert.deepEqual(r.tg, ['kept']);
});

test('walkFlow: unknown condition continues and notes it', () => {
  const r = W.walkFlow([{ t: 'cond', text: '???' }, { t: 'msg', text: 'x' }], 0, tgContact);
  assert.deepEqual(r.tg, ['x']);
  assert.ok(r.notes.some((n) => n.includes('cond unknown')));
});

test('walkFlow: tag node dedupes case-insensitively and records effect', () => {
  const r = W.walkFlow([{ t: 'tag', text: 'VIP' }, { t: 'tag', text: 'vip' }], 0, tgContact);
  assert.equal(r.effects.length, 1);
  assert.equal(r.effects[0].tag, 'VIP');
  assert.deepEqual(r.finalTags, ['VIP']);
});

test('walkFlow: delay pauses with clamped runAt', () => {
  const before = Date.now();
  const r = W.walkFlow([{ t: 'msg', text: 'a' }, { t: 'delay', v: '30', u: 'm' }, { t: 'msg', text: 'b' }], 0, tgContact);
  assert.equal(r.status, 'pending');
  assert.equal(r.nextIdx, 2);
  assert.deepEqual(r.tg, ['a']); // only messages before the delay
  const runAt = new Date(r.runAt).getTime();
  assert.ok(runAt >= before + 29 * 60000 && runAt <= before + 31 * 60000);
  const huge = W.walkFlow([{ t: 'delay', v: '99999999', u: 'd' }], 0, tgContact);
  assert.ok(new Date(huge.runAt).getTime() <= Date.now() + 43200 * 60000 + 1000, 'clamped to 30 days');
});

test('walkFlow: buy node only allows stripe buy/donate links', () => {
  const good = W.walkFlow([{ t: 'buy', text: 'Pay', url: 'https://buy.stripe.com/abc123' }], 0, tgContact);
  assert.equal(good.tg.length, 1);
  assert.ok(good.tg[0].includes('https://buy.stripe.com/abc123'));
  const bad = W.walkFlow([{ t: 'buy', text: 'Pay', url: 'https://evil.com/x' }], 0, tgContact);
  assert.equal(bad.tg.length, 0);
  assert.ok(bad.notes.some((n) => n.includes('bad link')));
});

test('walkFlow: webhook node validates URL and caps payload', () => {
  const c = Object.assign({}, tgContact, { tags: Array.from({ length: 30 }, (_, i) => 't' + i) });
  const r = W.walkFlow([{ t: 'webhook', url: 'https://hooks.example.com/x' }, { t: 'webhook', url: 'http://bad.com' }], 0, c);
  assert.equal(r.hooks.length, 1);
  assert.equal(r.hooks[0].payload.contact.tags.length, 20);
});

test('walkFlow: non-numeric tg handle never sends', () => {
  const c = Object.assign({}, tgContact, { handle: 'not-a-number' });
  const r = W.walkFlow([{ t: 'msg', text: 'hi' }], 0, c);
  assert.equal(r.tg.length, 0);
});

/* ---------- apiInt ---------- */
test('apiInt parses or falls back', () => {
  assert.equal(W.apiInt('25', 50), 25);
  assert.equal(W.apiInt('junk', 50), 50);
  assert.equal(W.apiInt(undefined, 50), 50);
});

/* ---------- email parsing ---------- */
test('BUG: mimeHdr drops folded continuation lines ($ matches end-of-line in multiline mode)', () => {
  const raw = 'Subject: hello\r\n\tworld\r\nFrom: a@b.c\r\n\r\nbody';
  // RFC 5322 folding: the continuation line belongs to the header value.
  assert.equal(W.mimeHdr(raw, 'Subject'), 'hello world'); // actual: 'hello'
  assert.equal(W.mimeHdr(raw, 'From'), 'a@b.c');
});

test('rfc2047 decodes base64 and Q encoded words', () => {
  const b64 = Buffer.from('مرحبا', 'utf8').toString('base64');
  assert.equal(W.rfc2047('=?UTF-8?B?' + b64 + '?='), 'مرحبا');
  assert.equal(W.rfc2047('=?UTF-8?Q?hello_=E2=82=AC?='), 'hello €');
  assert.equal(W.rfc2047('plain subject'), 'plain subject');
});

test('qpDecode and b64Decode decode and survive broken input', () => {
  assert.equal(W.qpDecode('a=3Db', 'utf-8'), 'a=b');
  assert.equal(W.qpDecode('x=0Ay', 'utf-8'), 'x\ny');
  assert.equal(W.b64Decode('aGVsbG8='), 'hello');
  assert.equal(W.b64Decode('%%%'), ''); // undecodable -> empty, no throw
});

test('emailBodyText extracts plain text and prefers text/plain part', () => {
  const simple = 'Subject: hi\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello there\r\nline2';
  assert.equal(W.emailBodyText(simple), 'Hello there\r\nline2');
  const b64 = 'Content-Type: text/plain\r\nContent-Transfer-Encoding: base64\r\n\r\n' + Buffer.from('secret body').toString('base64');
  assert.equal(W.emailBodyText(b64), 'secret body');
  const mp = [
    'Content-Type: multipart/alternative; boundary="xyz"', '',
    '--xyz', 'Content-Type: text/html', '', '<p>html <b>version</b></p>',
    '--xyz', 'Content-Type: text/plain', '', 'plain version',
    '--xyz--',
  ].join('\r\n');
  assert.equal(W.emailBodyText(mp), 'plain version');
});

test('emailBodyText strips HTML tags when only html part exists', () => {
  const html = 'Content-Type: text/html; charset=utf-8\r\n\r\n<p>Hi <b>there</b></p>';
  const out = W.emailBodyText(html);
  assert.ok(!out.includes('<'));
  assert.ok(out.includes('Hi'));
});

test('BUG: non-multipart text/html keeps script/style text (multipart branch strips it)', () => {
  const html = 'Content-Type: text/html; charset=utf-8\r\n\r\n<p>Hi</p><script>alert(1)</script>';
  const out = W.emailBodyText(html);
  // Tags are removed but the script SOURCE text stays in the stored body.
  assert.ok(!out.includes('alert(1)'));
});

/* ---------- constants sanity ---------- */
test('broadcast anti-spam constants stay conservative', () => {
  assert.ok(W.BC_MAX <= 30, 'recipient cap');
  assert.ok(W.BC_GAP_MS >= 3600000, 'at most one broadcast/hour');
  assert.equal(W.UNSUB_TAG, 'unsubscribed');
});

test('LINK_RE only matches https links', () => {
  const m = 'see https://example.com/page and http://insecure.com'.match(W.LINK_RE);
  assert.deepEqual(m, ['https://example.com/page']);
});

/* ---------- Meta channels ---------- */
test('metaParse reads WhatsApp text messages and names', () => {
  const b = { entry: [{ changes: [{ value: { contacts: [{ wa_id: '201000', profile: { name: 'Sam' } }], messages: [{ id: 'wamid.1', from: '201000', type: 'text', text: { body: 'hi' } }, { id: 'wamid.2', from: '201000', type: 'image' }] } }] }] };
  assert.deepEqual(W.metaParse('whatsapp', b), [{ id: 'wamid.1', user: '201000', name: 'Sam', text: 'hi' }]);
});
test('metaParse reads Messenger/Instagram and skips echoes', () => {
  const b = { entry: [{ messaging: [{ sender: { id: '55' }, message: { mid: 'm1', text: 'yo' } }, { sender: { id: '56' }, message: { mid: 'm2', text: 'x', is_echo: true } }] }] };
  assert.deepEqual(W.metaParse('messenger', b), [{ id: 'm1', user: '55', name: '', text: 'yo' }]);
  assert.deepEqual(W.metaParse('instagram', {}), []);
});
test('metaSigOk accepts a correct HMAC and rejects wrong or missing', async () => {
  const { createHmac } = await import('node:crypto');
  const sig = 'sha256=' + createHmac('sha256', 'topsecret').update('{"a":1}').digest('hex');
  assert.equal(await W.metaSigOk('topsecret', '{"a":1}', sig), true);
  assert.equal(await W.metaSigOk('other', '{"a":1}', sig), false);
  assert.equal(await W.metaSigOk('topsecret', '{"a":1}', ''), false);
  assert.equal(await W.metaSigOk('', '{"a":1}', sig), false);
});

test('walkFlow queues messages for Meta channel contacts with the prefix stripped', () => {
  const nodes = [{ t: 'trigger', text: 'keyword: price' }, { t: 'msg', text: 'Hi {name}' }];
  const r = W.walkFlow(nodes, 1, { name: 'Sam', handle: 'wa:201000111222', channel: 'whatsapp', tags: [] });
  assert.deepEqual(r.tg, ['Hi Sam']);
  assert.equal(r.chatId, '201000111222');
  const r2 = W.walkFlow(nodes, 1, { name: 'Sam', handle: 'x:1', channel: 'sms', tags: [] });
  assert.deepEqual(r2.tg, []);
});
