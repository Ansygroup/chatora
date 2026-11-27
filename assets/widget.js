(function () {
  var s = document.currentScript;
  if (!s || window.__chatoraWidget) return;
  var key = s.getAttribute('data-key') || '';
  if (!/^ck_[a-f0-9]{32}$/.test(key)) return;
  window.__chatoraWidget = 1;
  var base = new URL(s.src).origin;
  var vid;
  try { vid = localStorage.getItem('chatora_vid'); if (!vid) { vid = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(function (b) { return (b % 36).toString(36); }).join(''); localStorage.setItem('chatora_vid', vid); } }
  catch (e) { vid = Math.random().toString(36).slice(2, 14).padEnd(12, 'x'); }
  var hist = [];
  fetch(base + '/api/widget/config?key=' + key).then(function (r) { return r.ok ? r.json() : null; }).then(function (cfg) { if (cfg) mount(cfg); }).catch(function () {});
  function mount(cfg) {
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483000;';
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' +
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,sans-serif}' +
      '.b{width:56px;height:56px;border-radius:50%;border:0;background:#6d4aff;color:#fff;font-size:26px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25)}' +
      '.p{display:none;position:absolute;right:0;bottom:70px;width:340px;max-width:calc(100vw - 40px);height:460px;max-height:calc(100vh - 110px);background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.28);flex-direction:column;overflow:hidden}' +
      '.p.o{display:flex}.h{background:#6d4aff;color:#fff;padding:12px 14px;font-weight:600;font-size:15px}' +
      '.m{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f6f6fa}' +
      '.g{max-width:82%;padding:8px 11px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}' +
      '.a{background:#fff;color:#222;align-self:flex-start;border:1px solid #e4e4ee}.u{background:#6d4aff;color:#fff;align-self:flex-end}' +
      'form{display:flex;border-top:1px solid #e4e4ee}input{flex:1;border:0;background:#fff;color:#222;padding:12px;font-size:14px;outline:0}' +
      'form button{border:0;background:#fff;color:#6d4aff;font-weight:600;padding:0 14px;cursor:pointer}' +
      '</style><div class="p"><div class="h"></div><div class="m"></div><form><input maxlength="400" placeholder="Type a message" aria-label="Message"><button>Send</button></form></div><button class="b" aria-label="Chat">\uD83D\uDCAC</button>';
    var panel = root.querySelector('.p'), msgs = root.querySelector('.m'), inp = root.querySelector('input');
    var since = new Date().toISOString();
    setInterval(function () {
      fetch(base + '/api/widget/poll?key=' + key + '&visitor=' + vid + '&since=' + encodeURIComponent(since))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.messages) return;
          j.messages.forEach(function (m) { add(m.body, 'a'); hist.push({ role: 'assistant', content: m.body }); since = m.created_at; });
        })
        .catch(function () {});
    }, 12000);
    root.querySelector('.h').textContent = cfg.workspace || 'Chat';
    function add(t, c) { var d = document.createElement('div'); d.className = 'g ' + c; d.textContent = t; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; }
    add(cfg.greeting || 'Hi! How can we help?', 'a');
    root.querySelector('.b').onclick = function () { panel.classList.toggle('o'); if (panel.classList.contains('o')) inp.focus(); };
    root.querySelector('form').onsubmit = function (e) {
      e.preventDefault();
      var t = inp.value.trim(); if (!t) return;
      inp.value = ''; add(t, 'u'); hist.push({ role: 'user', content: t });
      var w = add('...', 'a');
      fetch(base + '/api/widget/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: key, visitor: vid, messages: hist.slice(-8) }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.human) { w.remove(); return; }
          var r = j && j.reply ? j.reply : 'Sorry, something went wrong.'; w.textContent = r; hist.push({ role: 'assistant', content: r });
        })
        .catch(function () { w.textContent = 'Sorry, something went wrong.'; });
    };
    document.body.appendChild(host);
  }
})();
