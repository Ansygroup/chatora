/* Chatora — auth client (Supabase GoTrue + PostgREST, no SDK).
   Stores the session in localStorage, refreshes it, and exposes REST helpers. */
(function () {
  var C = window.CHATORA_CONFIG || {};
  var URLB = C.SUPABASE_URL;
  var KEY = C.SUPABASE_ANON_KEY;
  var LS = "chatora.session.v1";

  function read() {
    try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) { return null; }
  }
  function write(s) {
    if (s) localStorage.setItem(LS, JSON.stringify(s));
    else localStorage.removeItem(LS);
  }
  function normalise(d) {
    if (!d || !d.access_token) return null;
    return {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: Date.now() + ((d.expires_in || 3600) - 60) * 1000,
      user: d.user || (read() && read().user) || null
    };
  }

  async function req(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ apikey: KEY, "Content-Type": "application/json" }, opts.headers || {});
    var r = await fetch(URLB + path, Object.assign({}, opts, { headers: headers }));
    var txt = await r.text();
    var data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!r.ok) {
      var msg = (data && (data.msg || data.message || data.error_description || data.error)) || "HTTP " + r.status;
      var err = new Error(msg);
      err.status = r.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function safeNext() {
    var q = new URLSearchParams(location.search);
    var n = q.get("next") || "app.html";
    return /^app\.html(?:\?view=templates(?:&tpl=[a-z0-9]+(?:-[a-z0-9]+)*)?)?$/i.test(n) ? n : "app.html";
  }

  // A magic-link / OAuth callback arrives as #access_token=… in the URL hash.
  var RECOVERY = false;
  function fromHash() {
    if (!location.hash || location.hash.indexOf("access_token=") === -1) return;
    var p = new URLSearchParams(location.hash.slice(1));
    if ((p.get("type") || "") === "recovery") RECOVERY = true;
    var s = normalise({
      access_token: p.get("access_token"),
      refresh_token: p.get("refresh_token"),
      expires_in: p.get("expires_in")
    });
    if (s) {
      write(s);
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  var api = {
    session: read,
    user: function () { var s = read(); return s && s.user; },

    async signUp(email, password) {
      var d = await req("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email: email, password: password }) });
      var s = normalise(d);
      if (s) write(s);
      return { session: s, needsConfirm: !s };
    },

    async signIn(email, password) {
      var d = await req("/auth/v1/token?grant_type=password", {
        method: "POST", body: JSON.stringify({ email: email, password: password })
      });
      var s = normalise(d); write(s); return s;
    },

    async magic(email) {
      var origin = location.origin + location.pathname;
      var next = safeNext();
      var redirect = origin + (next === "app.html" ? "" : "?next=" + encodeURIComponent(next));
      return req("/auth/v1/otp", {
        method: "POST",
        body: JSON.stringify({ email: email, create_user: true, options: { email_redirect_to: redirect } })
      });
    },

    // Probe first: an unconfigured provider answers 400, and navigating there
    // would dump the visitor on a bare Supabase error page.
    async google() {
      var back = location.origin + location.pathname.replace(/[^/]*$/, "") + safeNext();
      var url = URLB + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(back);
      var r;
      try {
        r = await fetch(url, { redirect: "manual" });
      } catch (e) {
        location.href = url;
        return true;
      }
      if (r.type === "opaqueredirect" || r.status === 0) {
        location.href = url;
        return true;
      }
      var d = null;
      try { d = await r.json(); } catch (e) {}
      throw Object.assign(new Error((d && (d.msg || d.message)) || "HTTP " + r.status), {
        status: r.status, data: d
      });
    },

    recovery: function () { return RECOVERY; },

    // Sends a password-recovery email. Needs SMTP on the project to actually deliver.
    async recover(email) {
      var back = location.origin + location.pathname;
      var next = safeNext();
      if (next !== "app.html") back += "?next=" + encodeURIComponent(next);
      return req("/auth/v1/recover?redirect_to=" + encodeURIComponent(back), {
        method: "POST", body: JSON.stringify({ email: email })
      });
    },

    async updateUser(payload) {
      var s = await api.ensure();
      if (!s) throw Object.assign(new Error("no-session"), { status: 401 });
      return req("/auth/v1/user", {
        method: "PUT",
        headers: { Authorization: "Bearer " + s.access_token },
        body: JSON.stringify(payload)
      });
    },

    async signOut() {
      var s = read();
      if (s) {
        try { await req("/auth/v1/logout", { method: "POST", headers: { Authorization: "Bearer " + s.access_token } }); } catch (e) {}
      }
      write(null);
      location.href = "login.html";
    },

    async ensure() {
      var s = read();
      if (!s) return null;
      if (Date.now() < s.expires_at) return s;
      try {
        var d = await req("/auth/v1/token?grant_type=refresh_token", {
          method: "POST", body: JSON.stringify({ refresh_token: s.refresh_token })
        });
        var n = normalise(d) || s;
        n.user = n.user || s.user;
        write(n);
        return n;
      } catch (e) {
        write(null);
        return null;
      }
    },

    // PostgREST helper: path like "/rest/v1/flows?select=*"
    async rest(path, opts) {
      opts = opts || {};
      var s = await api.ensure();
      if (!s) throw Object.assign(new Error("no-session"), { status: 401 });
      var headers = Object.assign({
        apikey: KEY,
        Authorization: "Bearer " + s.access_token,
        "Content-Type": "application/json",
        Prefer: opts.prefer || "return=representation"
      }, opts.headers || {});
      var r = await fetch(URLB + path, Object.assign({}, opts, { headers: headers }));
      var txt = await r.text();
      var data = null;
      try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
      if (!r.ok) {
        var msg = (data && (data.message || data.hint || data.msg)) || "HTTP " + r.status;
        throw Object.assign(new Error(msg), { status: r.status, data: data });
      }
      return data;
    }
  };

  fromHash();
  window.CHATORA_AUTH = api;
})();
