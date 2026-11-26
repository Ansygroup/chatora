document.getElementById('svc-form').addEventListener('submit',function(e){e.preventDefault();
var t='Hi Chatora, I\'d like a free 15-min audit.\nName: '+document.getElementById('f-name').value+'\nBusiness: '+document.getElementById('f-biz').value+'\nChannel: '+document.getElementById('f-ch').value+'\nGoal: '+document.getElementById('f-msg').value;
window.open('https://wa.me/201044772636?text='+encodeURIComponent(t),'_blank','noopener');});

/* Chatora AI chat widget (lead qualification + WhatsApp handoff) */
(function () {
  var WA = '201044772636';
  var ar = (document.documentElement.lang || '').indexOf('ar') === 0;
  var T = ar ? { open: 'تكلم معنا', ph: 'اكتب رسالتك...', send: 'إرسال', wa: 'كمل على واتساب', hi: 'أهلاً! أنا مساعد Chatora. ايه نوع نشاطك وبتستخدم انستجرام ولا واتساب؟', title: 'مساعد Chatora' }
    : { open: 'Chat with us', ph: 'Type your message...', send: 'Send', wa: 'Continue on WhatsApp', hi: 'Hi! I am the Chatora assistant. What kind of business do you run, and do you use Instagram, WhatsApp or both?', title: 'Chatora assistant' };
  var s = document.createElement('style');
  s.textContent = '#cw-b{position:fixed;bottom:20px;right:20px;z-index:9999;background:linear-gradient(135deg,#a78bfa,#5eead4);color:#0a0a12;border:0;border-radius:999px;padding:14px 20px;font:600 15px system-ui;cursor:pointer;box-shadow:0 6px 24px #0008}#cw-p{position:fixed;bottom:80px;right:20px;z-index:9999;width:min(360px,calc(100vw - 32px));height:480px;max-height:70vh;background:#0f0f1a;color:#eee;border:1px solid #333;border-radius:16px;display:none;flex-direction:column;font:14px system-ui;overflow:hidden}#cw-p.o{display:flex}#cw-h{padding:12px 14px;font-weight:600;border-bottom:1px solid #2a2a3a}#cw-m{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}#cw-m div{padding:8px 11px;border-radius:12px;max-width:85%;white-space:pre-wrap}.cw-u{align-self:flex-end;background:#6d5bd0}.cw-a{align-self:flex-start;background:#1e1e2e}#cw-f{display:flex;gap:6px;padding:8px;border-top:1px solid #2a2a3a}#cw-i{flex:1;background:#181826;color:#eee;border:1px solid #333;border-radius:8px;padding:8px}#cw-s{background:#6d5bd0;color:#fff;border:0;border-radius:8px;padding:0 12px;cursor:pointer}#cw-w{display:block;text-align:center;padding:10px;background:#25d366;color:#04210f;font-weight:600;text-decoration:none}';
  document.head.appendChild(s);
  var b = document.createElement('button'); b.id = 'cw-b'; b.textContent = T.open; b.type = 'button';
  var p = document.createElement('div'); p.id = 'cw-p';
  p.innerHTML = '<div id="cw-h"></div><div id="cw-m"></div><a id="cw-w" target="_blank" rel="noopener"></a><div id="cw-f"><input id="cw-i" dir="auto" maxlength="500"><button id="cw-s" type="button"></button></div>';
  document.body.appendChild(b); document.body.appendChild(p);
  var m = p.querySelector('#cw-m'), i = p.querySelector('#cw-i'), w = p.querySelector('#cw-w'), hist = [];
  p.querySelector('#cw-h').textContent = T.title; p.querySelector('#cw-s').textContent = T.send; i.placeholder = T.ph; w.textContent = T.wa;
  function wa() {
    var u = hist.filter(function (x) { return x.role === 'user'; }).map(function (x) { return x.content; }).join(' | ').slice(0, 400);
    w.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('Hi Chatora, I would like a free 15-min audit. ' + (u ? 'About me: ' + u : ''));
  }
  function add(c, r) { var d = document.createElement('div'); d.className = r === 'user' ? 'cw-u' : 'cw-a'; d.setAttribute('dir', 'auto'); d.textContent = c; m.appendChild(d); m.scrollTop = m.scrollHeight; }
  add(T.hi, 'assistant'); wa();
  b.onclick = function () { p.classList.toggle('o'); if (p.classList.contains('o')) i.focus(); };
  function send() {
    var t = i.value.trim(); if (!t) return; i.value = ''; add(t, 'user'); hist.push({ role: 'user', content: t }); wa();
    fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: hist }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { var r = d.reply || '...'; hist.push({ role: 'assistant', content: r }); add(r, 'assistant'); })
      .catch(function () { add('...', 'assistant'); });
  }
  p.querySelector('#cw-s').onclick = send;
  i.onkeydown = function (e) { if (e.key === 'Enter') send(); };
})();

/* Language switch: services page is English-only, so send other languages to their localized home instead of a 404 */
(function(){function go(c){location.href=(c==='en'?'/':'/'+c+'/');}document.addEventListener('click',function(e){var o=e.target.closest&&e.target.closest('[data-lang]');if(o){e.preventDefault();e.stopImmediatePropagation();go(o.getAttribute('data-lang'));}},true);document.addEventListener('change',function(e){var s=e.target;if(s&&s.matches&&s.matches('select[data-lang-select]')){e.stopImmediatePropagation();go(s.value);}},true);})();
