/* Chatora - auth client (Firebase Auth REST + Supabase PostgREST, no SDK).
   Firebase handles sign-in. The Firebase ID token is sent to Supabase, which
   accepts it through Third-Party Auth. Session lives in localStorage. */
(function () {
  var C = window.CHATORA_CONFIG || {};
  var URLB = C.SUPABASE_URL;
  var KEY = C.SUPABASE_ANON_KEY;
  var FK = C.FIREBASE_API_KEY;
  var GCID = C.GOOGLE_CLIENT_ID;
  var IT = "https://identitytoolkit.googleapis.com/v1/";
  var ST = "https://securetoken.googleapis.com/v1/token";
  var LS = "chatora.session.v2";
  var LS_EMAIL = "chatora.emaillink";

  function read() {
    try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) { return null; }
  }
  function write(s) {
    if (s) localStorage.setItem(LS, JSON.stringify(s));
    else localStorage.removeItem(LS);
  }
  function fail(data, status) {
    var code = (data && data.error && data.error.message) || "HTTP " + status;
    var m = String(code);
    var msg = m;
    if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(m)) msg = "invalid login credentials";
    else if (/EMAIL_EXISTS/.test(m)) msg = "user already registered";
    else if (/WEAK_PASSWORD/.test(m)) msg = "password too weak";
    else if (/INVALID_EMAIL/.test(m)) msg = "invalid email";
    else if (/TOO_MANY_ATTEMPTS|QUOTA/.test(m)) { msg = "rate limit"; status = 429; }
    else if (/OPERATION_NOT_ALLOWED|CONFIGURATION_NOT_FOUND/.test(m)) { msg = "provider not enabled"; status = 400; }
    return Object.assign(new Error(msg), { status: status, data: data, code: code });
  }
  async function post(url, body, form) {
    var r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
      body: form ? new URLSearchParams(body).toString() : JSON.stringify(body)
    });
    var data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw fail(data, r.status);
    return data;
  }
  function idt(path, body) { return post(IT + path + "?key=" + encodeURIComponent(FK), body); }

  function normalise(d, email) {
    if (!d || !(d.idToken || d.id_token)) return null;
    var prev = read();
    return {
      access_token: d.idToken || d.id_token,
      refresh_token: d.refreshToken || d.refresh_token,
      expires_at: Date.now() + (parseInt(d.expiresIn || d.expires_in || "3600", 10) - 60) * 1000,
      user: {
        id: d.localId || d.user_id || (prev && prev.user && prev.user.id) || null,
        email: d.email || email || (prev && prev.user && prev.user.email) || ""
      }
    };
  }

  function safeNext() {
    var q = new URLSearchParams(location.search);
    var n = q.get("next") || "app.html";
    return /^app\.html(?:\?view=templates(?:&tpl=[a-z0-9]+(?:-[a-z0-9]+)*)?)?$/i.test(n) ? n : "app.html";
  }

  // Email-link sign-in lands back on this page with ?oobCode=...&mode=signIn.
  var linkDone = null;
  function fromLink() {
    var q = new URLSearchParams(location.search);
    var code = q.get("oobCode");
    if (!code || q.get("mode") !== "signIn") return;
    var email = localStorage.getItem(LS_EMAIL) || "";
    if (!email) return;
    linkDone = idt("accounts:signInWithEmailLink", { email: email, oobCode: code }).then(function (d) {
      write(normalise(d, email));
      localStorage.removeItem(LS_EMAIL);
      location.replace(location.pathname.replace(/[^/]*$/, "") + safeNext());
    }).catch(function () {});
  }

  function loadGis() {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve();
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("network")); };
      document.head.appendChild(s);
    });
  }

  var api = {
    session: read,
    user: function () { var s = read(); return s && s.user; },

    async signUp(email, password) {
      var d = await idt("accounts:signUp", { email: email, password: password, returnSecureToken: true });
      var s = normalise(d, email);
      if (s) write(s);
      try { await idt("accounts:sendOobCode", { requestType: "VERIFY_EMAIL", idToken: d.idToken }); } catch (e) {}
      return { session: s, needsConfirm: false };
    },

    async signIn(email, password) {
      var d = await idt("accounts:signInWithPassword", { email: email, password: password, returnSecureToken: true });
      var s = normalise(d, email); write(s); return s;
    },

    async magic(email) {
      var url = location.origin + location.pathname;
      var next = safeNext();
      if (next !== "app.html") url += "?next=" + encodeURIComponent(next);
      await idt("accounts:sendOobCode", {
        requestType: "EMAIL_SIGNIN", email: email, continueUrl: url, canHandleCodeInApp: true
      });
      localStorage.setItem(LS_EMAIL, email);
      return true;
    },

    // Google Identity Services popup -> access token -> Firebase signInWithIdp.
    async google() {
      if (!GCID) throw Object.assign(new Error("provider not enabled"), { status: 400 });
      await loadGis();
      var tok = await new Promise(function (resolve, reject) {
        var client = window.google.accounts.oauth2.initTokenClient({
          client_id: GCID,
          scope: "openid email profile",
          callback: function (resp) {
            if (resp && resp.access_token) resolve(resp.access_token);
            else reject(new Error((resp && resp.error) || "google sign-in cancelled"));
          },
          error_callback: function (err) { reject(new Error((err && err.type) || "google sign-in cancelled")); }
        });
        client.requestAccessToken({ prompt: "select_account" });
      });
      var d = await idt("accounts:signInWithIdp", {
        postBody: "access_token=" + encodeURIComponent(tok) + "&providerId=google.com",
        requestUri: location.origin,
        returnIdpCredential: true,
        returnSecureToken: true
      });
      write(normalise(d));
      location.replace(location.pathname.replace(/[^/]*$/, "") + safeNext());
      return true;
    },

    // Password reset mail from Firebase; the reset itself happens on Firebase's hosted page.
    recovery: function () { return false; },
    async recover(email) {
      return idt("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email: email });
    },

    async updateUser(payload) {
      var s = await api.ensure();
      if (!s) throw Object.assign(new Error("no-session"), { status: 401 });
      var body = { idToken: s.access_token, returnSecureToken: true };
      if (payload && payload.password) body.password = payload.password;
      var d = await idt("accounts:update", body);
      var n = normalise(d); if (n) write(n);
      return d;
    },

    async signOut() {
      write(null);
      location.href = "login.html";
    },

    async ensure() {
      var s = read();
      if (!s) return null;
      if (Date.now() < s.expires_at) return s;
      try {
        var d = await post(ST + "?key=" + encodeURIComponent(FK), { grant_type: "refresh_token", refresh_token: s.refresh_token }, true);
        var n = normalise(d) || s;
        n.user = n.user && n.user.id ? n.user : s.user;
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

  fromLink();
  window.CHATORA_AUTH = api;
})();
