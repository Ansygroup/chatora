/* ==========================================================================
   CHATORA — interactive flow-builder playground (vanilla, touch friendly)
   ========================================================================== */
(function () {
  const T = (k, f) => {
    const lang = (document.documentElement.lang || "en").slice(0, 2);
    const pages = ((window.CHATORA_I18N_PAGES || {})[lang]) || {};
    const general = ((window.CHATORA_I18N || {})[lang]) || {};
    if (pages[k] != null) return pages[k];
    if (general[k] != null) return general[k];
    return window.chatoraT ? window.chatoraT(k, f) : f;
  };
  "use strict";
  const L = (t) => T(t.lkey, t.label);
  const H = (t) => T(t.hkey, t.hint);
  const root = document.querySelector("[data-pg]");
  if (!root) return;

  const canvas = root.querySelector("[data-pg-canvas]");
  const nodesLayer = root.querySelector("[data-pg-nodes]");
  const linksLayer = root.querySelector("[data-pg-links]");
  const emptyMsg = root.querySelector("[data-pg-empty]");
  const logEl = root.querySelector("[data-pg-log]");
  const countEl = root.querySelector("[data-pg-count]");
  const presetSel = root.querySelector("#pg-preset");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* labels + hints carry dictionary keys; the text is resolved at render time
     so a page loaded in Arabic never shows an English node. */
  const TYPES = {
    trigger:   { label: "Trigger",       lkey: "pg.t.trigger",   hint: 'Comment "price"', hkey: "pg.h.trigger",   cls: "t", icon: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"/>' },
    message:   { label: "Message",       lkey: "pg.t.message",   hint: "Send a DM",       hkey: "pg.h.message",   cls: "m", icon: '<path d="M4 5h16v11H8l-4 4V5Z"/>' },
    ai:        { label: "AI reply",      lkey: "pg.t.ai",        hint: "Grounded answer", hkey: "pg.h.ai",        cls: "a", icon: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/>' },
    condition: { label: "Condition",     lkey: "pg.t.condition", hint: "Replied in 2h?",  hkey: "pg.h.condition", cls: "c", icon: '<path d="M12 3v6M12 15v6M6 12h12"/>' },
    delay:     { label: "Delay",         lkey: "pg.t.delay",     hint: "Wait 2 hours",    hkey: "pg.h.delay",     cls: "d", icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>' },
    tag:       { label: "Tag contact",   lkey: "pg.t.tag",       hint: "hot-lead",        hkey: "pg.h.tag",       cls: "g", icon: '<path d="M4 12V5h7l9 9-7 7-9-9Z"/><circle cx="8" cy="8" r="1.4"/>' },
    human:     { label: "Human handoff", lkey: "pg.t.human",     hint: "Assign to Nour",  hkey: "pg.h.human",     cls: "h", icon: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/>' },
    link:      { label: "Checkout link", lkey: "pg.t.link",      hint: "Tracked order",   hkey: "pg.h.link",      cls: "l", icon: '<path d="M10 14a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11 7.4"/><path d="M14 10a4 4 0 0 0-5.7 0L5.7 12.6a4 4 0 0 0 5.7 5.7l1.6-1.6"/>' },
  };

  let nodes = [];
  let seq = 0;
  let running = false;

  /* ---------------- rendering ---------------- */
  function render() {
    nodesLayer.innerHTML = "";
    nodes.forEach((n, i) => {
      const def = TYPES[n.type];
      const el = document.createElement("div");
      el.className = "pg-node pg-" + def.cls;
      el.dataset.id = n.id;
      el.style.left = n.x + "px";
      el.style.top = n.y + "px";
      el.tabIndex = 0;
      el.innerHTML =
        '<div class="pg-node-top">' +
          '<span class="pg-node-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' + def.icon + "</svg></span>" +
          '<span class="pg-node-label">' + L(def) + "</span>" +
          '<span class="pg-node-idx">' + (i + 1) + "</span>" +
          '<button class="pg-node-del" type="button" aria-label="Remove step ' + (i + 1) + '">×</button>' +
        "</div>" +
        '<div class="pg-node-hint">' + (n.text || H(def)) + "</div>";
      nodesLayer.appendChild(el);
    });
    emptyMsg.hidden = nodes.length > 0;
    countEl.textContent = nodes.length;
    drawLinks();
  }

  function center(el) {
    return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
  }

  function drawLinks() {
    const els = Array.from(nodesLayer.children);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    linksLayer.setAttribute("viewBox", "0 0 " + W + " " + H);
    linksLayer.setAttribute("width", W);
    linksLayer.setAttribute("height", H);
    let d = "";
    for (let i = 0; i < els.length - 1; i++) {
      const a = center(els[i]);
      const b = center(els[i + 1]);
      const ax = a.x + a.w;
      const ay = a.y + a.h / 2;
      const bx = b.x - 8;
      const by = b.y + b.h / 2;
      const dx = Math.max(30, Math.abs(bx - ax) * 0.5);
      d += "M" + ax + " " + ay + " C" + (ax + dx) + " " + ay + " " + (bx - dx) + " " + by + " " + bx + " " + by + " ";
    }
    linksLayer.innerHTML =
      '<path class="pg-link-path" d="' + d + '"></path>' +
      '<path class="pg-link-glow" d="' + d + '"></path>';
  }

  /* ---------------- adding / removing ---------------- */
  function addNode(type, pos) {
    const el = { x: 0, y: 0 };
    const count = nodes.length;
    const x = pos ? pos.x : 34 + (count % 2) * 116;
    const y = pos ? pos.y : 20 + count * 82;
    const n = { id: ++seq, type: type, x: Math.max(8, x), y: Math.max(8, y) };
    nodes.push(n);
    render();
    const created = nodesLayer.querySelector('[data-id="' + n.id + '"]');
    if (created) {
      created.classList.add("pg-pop");
      setTimeout(() => created.classList.remove("pg-pop"), 420);
      created.focus({ preventScroll: true });
    }
    log("+ " + L(TYPES[type]) + " added", "dim");
  }

  function removeNode(id) {
    nodes = nodes.filter((n) => n.id !== Number(id));
    render();
  }

  /* ---------------- dragging ---------------- */
  let drag = null;
  nodesLayer.addEventListener("pointerdown", (e) => {
    const del = e.target.closest(".pg-node-del");
    if (del) {
      const node = e.target.closest(".pg-node");
      removeNode(node.dataset.id);
      return;
    }
    const el = e.target.closest(".pg-node");
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    drag = {
      el: el,
      id: Number(el.dataset.id),
      startX: e.clientX,
      startY: e.clientY,
      origX: parseFloat(el.style.left) || 0,
      origY: parseFloat(el.style.top) || 0,
    };
    el.classList.add("is-dragging");
  });

  nodesLayer.addEventListener("pointermove", (e) => {
    if (!drag) return;
    e.preventDefault();
    const maxX = Math.max(0, canvas.clientWidth - drag.el.offsetWidth - 6);
    const maxY = Math.max(0, canvas.clientHeight - drag.el.offsetHeight - 6);
    const nx = Math.min(maxX, Math.max(6, drag.origX + (e.clientX - drag.startX)));
    const ny = Math.min(maxY, Math.max(6, drag.origY + (e.clientY - drag.startY)));
    drag.el.style.left = nx + "px";
    drag.el.style.top = ny + "px";
    const node = nodes.find((n) => n.id === drag.id);
    if (node) { node.x = nx; node.y = ny; }
    drawLinks();
  });

  function endDrag() {
    if (!drag) return;
    drag.el.classList.remove("is-dragging");
    drag = null;
  }
  nodesLayer.addEventListener("pointerup", endDrag);
  nodesLayer.addEventListener("pointercancel", endDrag);

  /* ---------------- logging ---------------- */
  function log(text, cls) {
    const line = document.createElement("div");
    line.className = "pg-log-line " + (cls || "");
    line.textContent = text;
    if (logEl.querySelector(".muted") && logEl.children.length === 1) logEl.innerHTML = "";
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function clearLog() {
    logEl.innerHTML = '<div class="pg-log-line muted">Waiting for a run…</div>';
  }

  /* ---------------- run simulation ---------------- */
  function run() {
    if (!nodes.length) {
      log(T("pg.l.empty","Add at least one step first."), "warn");
      return;
    }
    if (running) return;
    running = true;
    const badge = root.querySelector(".pg-live");
    badge && badge.classList.add("is-running");
    clearLog();
    const els = Array.from(nodesLayer.children);
    const step = reduce ? 120 : 620;
    els.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add("is-active");
        const def = TYPES[nodes[i].type];
        log(i + 1 + ". " + L(def) + " — " + (nodes[i].text || H(def)), "ok");
        setTimeout(() => el.classList.remove("is-active"), step * 0.8);
        if (i === els.length - 1) {
          setTimeout(() => {
            log(T("pg.l.done","✓ Flow finished in ") + (0.8 + nodes.length * 0.4).toFixed(1) + T("pg.l.done2","s — order tracked, contact tagged."), "done");
            badge && badge.classList.remove("is-running");
            running = false;
          }, step);
        }
      }, i * step);
    });
  }

  /* ---------------- presets ---------------- */
  const PRESETS = {
    comment: [
      ["trigger", ["pg.p1", 'Comment "price"']],
      ["message", ["pg.p2","Public thank-you + DM"]],
      ["ai", ["pg.p3","Answer with product & price"]],
      ["link", ["pg.p4","Send tracked checkout"]],
      ["tag", ["pg.p5","Tag: hot-lead"]],
    ],
    cod: [
      ["trigger", ["pg.p6","New COD order"]],
      ["message", ["pg.p7","Confirm delivery 24h before"]],
      ["condition", ["pg.p8","Replied ✅?"]],
      ["human", ["pg.p9","Escalate failed confirms"]],
      ["tag", ["pg.p10","Tag: confirmed"]],
    ],
    cart: [
      ["trigger", ["pg.p11","Checkout abandoned"]],
      ["delay", ["pg.p12","Wait 2 hours"]],
      ["message", ["pg.p13","Reminder + unique link"]],
      ["condition", ["pg.p14","Opened link?"]],
      ["link", ["pg.p15","Second chance link"]],
    ],
    support: [
      ["trigger", "New DM"],
      ["ai", ["pg.p16","Answer from your FAQs"]],
      ["condition", ["pg.p17","Refund or angry?"]],
      ["human", ["pg.p18","Assign to a specialist"]],
      ["tag", ["pg.p19","Tag: resolved-by-AI"]],
    ],
  };

  function loadPreset(key) {
    if (!PRESETS[key]) return;
    nodes = [];
    seq = 0;
    PRESETS[key].forEach(([type, tx], i) => {
      const [tk, tf] = Array.isArray(tx) ? tx : [null, tx];
      nodes.push({
        id: ++seq,
        type: type,
        text: tk ? T(tk, tf) : tf,
        x: i % 2 === 0 ? 34 : 150,
        y: 20 + i * 82,
      });
    });
    render();
    clearLog();
    log(T("pg.l.preset","Preset loaded · ") + PRESETS[key].length + T("pg.l.steps"," steps"), "ok");
  }

  /* ---------------- wiring ---------------- */
  root.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { addNode(add.dataset.add); return; }
    if (e.target.closest("[data-pg-run]")) { run(); return; }
    if (e.target.closest("[data-pg-clear]")) {
      nodes = [];
      seq = 0;
      render();
      clearLog();
      log(T("pg.l.clear","Canvas cleared"), "dim");
    }
  });

  presetSel && presetSel.addEventListener("change", () => {
    if (presetSel.value) loadPreset(presetSel.value);
    presetSel.value = "";
  });

  window.addEventListener("resize", drawLinks);

  /* keyboard: delete focused node with Delete/Backspace */
  nodesLayer.addEventListener("keydown", (e) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    const node = e.target.closest(".pg-node");
    if (!node) return;
    e.preventDefault();
    removeNode(node.dataset.id);
  });

  /* first paint with a friendly starter flow.
     i18n-pages.js + main.js are deferred and run AFTER this file, so we wait for
     DOMContentLoaded (fires once every deferred script has executed) before
     painting any translated label. */
  function boot() {
    loadPreset("comment");
    log(T("pg.l.ready", "Demo workspace ready — try Run flow."), "dim");
    drawLinks();
  }
  /* Deferred scripts run at readyState "interactive", i.e. BEFORE i18n-pages.js
     (which sits in the footer) has executed. Waiting for DOMContentLoaded is
     what guarantees the dictionary is loaded when we paint the labels. */
  if (document.readyState === "complete") boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
