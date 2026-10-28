/* ==========================================================================
   CHATORA — lead capture layer
   Talks to Supabase (PostgREST) with the public anon key.
   Hard rules:
     · never blocks the UI  · never throws outside its returned Promise
     · queues only when offline / transient server failure
     · never reports a lead as saved unless server or local storage confirmed it
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.CHATORA_CONFIG || {};
  var URL = (CFG.SUPABASE_URL || "").replace(/\/+$/, "");
  var KEY = CFG.SUPABASE_ANON_KEY || "";
  var TIMEOUT = CFG.TIMEOUT_MS || 9000;
  var QUEUE_KEY = "chatora.queue.v1";
  var MAX_PENDING_LEADS = 60;

  function online() {
    return !!(URL && KEY) && navigator.onLine !== false && location.protocol.indexOf("http") === 0;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    if (window.crypto && crypto.getRandomValues) {
      var bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      return Array.from(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("")
        .replace(/^(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})$/, "$1-$2-$3-$4-$5");
    }
    /* This is a deduplication ID, not a credential. */
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function read(key) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (e) {
      return [];
    }
  }

  function write(key, rows) {
    if (!Array.isArray(rows)) return false;
    try {
      /* Do not truncate the queue: pending customer submissions must not be dropped. */
      localStorage.setItem(key, JSON.stringify(rows));
      return true;
    } catch (e) {
      return false;
    }
  }

  function enqueue(row) {
    var pending = read(QUEUE_KEY);
    if (pending.some(function (item) { return item && item.client_id === row.client_id; })) return true;
    if (pending.length >= MAX_PENDING_LEADS) return false;
    pending.push(row);
    return write(QUEUE_KEY, pending);
  }

  function queueError() {
    var error = new Error("lead_queue_unavailable");
    error.code = "lead_queue_unavailable";
    return error;
  }

  function headers() {
    return {
      "Content-Type": "application/json",
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      Prefer: "return=minimal"
    };
  }

  function post(path, rows) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, TIMEOUT);
    return fetch(URL + "/rest/v1/" + path, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(rows),
      signal: ctrl ? ctrl.signal : undefined,
      keepalive: true
    })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        /* 409 = this client_id is already stored; the lead is safe, not an error. */
        if (res.status === 409) return true;
        if (!res.ok) {
          var error = new Error("HTTP " + res.status);
          error.status = res.status;
          throw error;
        }
        return true;
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
  }

  function retryable(err) {
    var status = Number(err && err.status);
    return !Number.isFinite(status) || status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
  }

  function validLead(row) {
    return !!row && typeof row === "object" &&
      typeof row.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email) &&
      row.email.length <= 254 && typeof row.client_id === "string" && row.client_id.length > 0;
  }

  /* ---------- context the server can't infer on its own ---------- */
  function ctx() {
    var params = new URLSearchParams(location.search);
    var utm = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"].forEach(function (k) {
      if (params.get(k)) utm[k] = params.get(k);
    });
    var page = location.pathname.split("/").pop() || "index.html";
    return {
      source_page: page,
      locale: (document.documentElement.lang || "en").slice(0, 2),
      referrer: document.referrer || null,
      utm: utm,
      user_agent: navigator.userAgent,
      client_id: uuid()
    };
  }

  /* ---------- public: save a lead ---------- */
  function submitLead(data) {
    data = data || {};
    var base = ctx();
    var row = {
      email: String(data.email || "").trim().toLowerCase(),
      name: data.name ? String(data.name).slice(0, 120) : null,
      channel: data.channel ? String(data.channel).slice(0, 80) : null,
      topic: data.topic ? String(data.topic).slice(0, 120) : null,
      message: data.message ? String(data.message).slice(0, 2000) : null,
      variant: data.variant ? String(data.variant).slice(0, 80) : null,
      source_page: data.source_page ? String(data.source_page).slice(0, 255) : base.source_page,
      locale: base.locale,
      referrer: base.referrer,
      utm: base.utm,
      user_agent: base.user_agent,
      client_id: base.client_id
    };
    if (!row.email) return Promise.reject(new Error("email required"));
    if (!validLead(row)) return Promise.reject(new Error("email invalid"));

    if (!online()) {
      return enqueue(row)
        ? Promise.resolve({ queued: true })
        : Promise.reject(queueError());
    }

    return post("leads", row)
      .then(function () { return { queued: false }; })
      .catch(function (err) {
        /* Permanent 4xx responses need correction, not an endless offline retry. */
        if (!retryable(err)) throw err;
        return enqueue(row)
          ? { queued: true }
          : Promise.reject(queueError());
      });
  }

  /* ---------- public: lightweight product analytics ---------- */
  function track(name, props) {
    if (!online()) return Promise.resolve(false);
    var base = ctx();
    return post("events", [
      {
        name: String(name).slice(0, 80),
        page: base.source_page,
        locale: base.locale,
        props: props || {},
        client_id: base.client_id
      }
    ]).catch(function () {
      return false;
    });
  }

  /* ---------- retry whatever is sitting in the queue ---------- */
  var flushing = null;
  function flush() {
    if (flushing) return flushing; /* one run at a time */
    var pending = read(QUEUE_KEY);
    if (!pending.length || !online()) return Promise.resolve(0);

    var sentIds = [];
    flushing = pending
      .reduce(function (chain, row) {
        return chain.then(function () {
          if (!validLead(row)) return;
          return post("leads", row)
            .then(function () { sentIds.push(row.client_id); })
            .catch(function () { /* Keep failed or invalid rows queued. */ });
        });
      }, Promise.resolve())
      .then(function () {
        /* Re-read storage: another tab or an earlier run may have changed it. */
        var still = read(QUEUE_KEY).filter(function (row) {
          return !row || sentIds.indexOf(row.client_id) < 0;
        });
        write(QUEUE_KEY, still);
        return sentIds.length;
      })
      .catch(function () { return 0; })
      .then(function (count) {
        flushing = null;
        return count;
      });
    return flushing;
  }

  window.addEventListener("online", function () {
    flush();
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(flush, 1500); });
  } else {
    setTimeout(flush, 1500);
  }

  /* ---------- public: one pageview per page per session ---------- */
  var seenView = false;
  function pageview() {
    if (seenView) return Promise.resolve(false);
    seenView = true;
    var key = "chatora.pv:" + location.pathname;
    try {
      if (sessionStorage.getItem(key)) return Promise.resolve(false);
      sessionStorage.setItem(key, "1");
    } catch (e) {
      /* private mode — still count it */
    }
    return track("pageview", {
      title: document.title,
      path: location.pathname,
      referrer: document.referrer || null,
      lang: (document.documentElement.lang || "en").slice(0, 2)
    });
  }

  window.ChatoraAPI = {
    submitLead: submitLead,
    pageview: pageview,
    track: track,
    flush: flush,
    pending: function () { return read(QUEUE_KEY).length; },
    online: online
  };
})();
