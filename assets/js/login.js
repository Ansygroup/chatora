/* Chatora — login / signup page controller. */
(function () {
  var A = window.CHATORA_AUTH;
  var AR = (document.documentElement.lang || "en").slice(0, 2) === "ar";

  var T = {
    en: {
      submitSignin: "Sign in", submitSignup: "Create my workspace", submitMagic: "Email me a sign-in link",
      hintPassword: "At least 6 characters.",
      hintMagic: "We send a one-time link. No password needed.",
      busy: "One moment…",
      created: "Workspace ready — opening it now.",
      needConfirm: "If confirmation is required and email delivery is configured, check your inbox. If you already have an account, sign in instead.",
      magicSent: "If email delivery is configured, a sign-in link is on its way to {email}. Check your inbox and spam folder.",
      badCreds: "Email or password is not right.",
      exists: "That email already has an account — try signing in.",
      weak: "Use at least 6 characters.",
      pwShort: "Use at least 6 characters.",
      invalid: "That email doesn't look valid.",
      googleOff: "Google sign-in is not configured yet. Add a Google OAuth client in Supabase → Authentication → Providers.",
      net: "Network problem — check your connection and try again.",
      titleSignin: "Welcome back", titleSignup: "Create your workspace", titleMagic: "A link, no password",
      subSignin: "Sign in to your Chatora workspace.", subSignup: "Preview · no billing. Explore a real workspace with editable drafts and CSV tools; live channels and AI replies aren't enabled.",
      subMagic: "We request a one-time sign-in link; delivery depends on the project's email configuration.",
      forgotSent: "If that address has an account and email delivery is available, a reset link will be sent. It expires in an hour.",
      forgotNeed: "Type the email you signed up with first.",
      newpassTitle: "Choose a new password", newpassSub: "You opened a recovery link — set the password you want to use from now on.",
      newpassOk: "Password updated — you're signed in.",
      mailOff: "Email delivery is unavailable or rate-limited right now. Try again later, or sign in with your password.",
    },
    ar: {
      submitSignin: "تسجيل الدخول", submitSignup: "اعمل مساحة عملي", submitMagic: "ابعتلي لينك دخول",
      hintPassword: "6 حروف على الأقل.",
      hintMagic: "بنبعت لينك لمرة واحدة. من غير باسورد.",
      busy: "لحظة واحدة…",
      created: "مساحة العمل جاهزة — بنفتحها دلوقتي.",
      needConfirm: "لو تأكيد الإيميل مطلوب وإرساله متاح، راجع الوارد. لو عندك حساب بالفعل، سجّل الدخول بدلًا من كده.",
      magicSent: "لو إرسال الإيميل متاح، هيجيلك لينك دخول على {email}. راجع الوارد والسبام.",
      badCreds: "الإيميل أو الباسورد مش مظبوطين.",
      exists: "الإيميل ده عنده حساب بالفعل — جرّب تسجيل الدخول.",
      weak: "استخدم 6 حروف على الأقل.",
      pwShort: "استخدم 6 حروف على الأقل.",
      invalid: "الإيميل ده مش صحيح.",
      googleOff: "الدخول بجوجل مش مظبوط لسه. أضف Google OAuth client في Supabase ← Authentication ← Providers.",
      net: "مشكلة في الشبكة — راجع اتصالك وجرّب تاني.",
      titleSignin: "أهلًا بعودتك", titleSignup: "أنشئ مساحة عملك", titleMagic: "لينك، من غير باسورد",
      subSignin: "سجّل الدخول لمساحة عمل شاتورا.", subSignup: "معاينة · بدون فوترة. استكشف مساحة عمل حقيقية بمسودات قابلة للتعديل وأدوات CSV؛ القنوات المباشرة وردود الذكاء الاصطناعي غير مفعّلة.",
      subMagic: "هنطلب لينك دخول لمرة واحدة؛ وصوله بيعتمد على إعداد البريد الإلكتروني للمشروع.",
      forgotSent: "لو العنوان له حساب وكان إرسال الإيميل متاحًا، هيتبعت لينك إعادة تعيين صالح لمدة ساعة.",
      forgotNeed: "اكتب الإيميل اللي سجلت بيه الأول.",
      newpassTitle: "اختار باسورد جديد", newpassSub: "أنت فتحت لينك استرجاع — حدّد الباسورد اللي هتستخدمه من دلوقتي.",
      newpassOk: "الباسورد اتحدّث — وأنت مسجل الدخول.",
      mailOff: "إرسال الإيميلات غير متاح أو عليه حدّ مؤقت حاليًا. جرّب لاحقًا أو سجّل الدخول بالباسورد.",
    }
  }[AR ? "ar" : "en"];

  var mode = "signin";
  var $ = function (s) { return document.querySelector(s); };

  function setMode(m) {
    mode = m;
    document.querySelectorAll(".auth-tab").forEach(function (b) {
      var on = b.getAttribute("data-mode") === m;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("#auth-pass-field").hidden = m === "magic";
    $("#auth-hint").textContent = m === "magic" ? T.hintMagic : T.hintPassword;
    $("#auth-hint").hidden = false;
    $("#auth-forgot-row").hidden = m !== "signin";
    $("#auth-submit").textContent = m === "signup" ? T.submitSignup : m === "magic" ? T.submitMagic : T.submitSignin;
    var t = m === "signup" ? T.titleSignup : m === "magic" ? T.titleMagic : T.titleSignin;
    var s = m === "signup" ? T.subSignup : m === "magic" ? T.subMagic : T.subSignin;
    $(".auth-title").textContent = t;
    $(".auth-sub").textContent = s;
    $("#auth-msg").textContent = "";
    $("#auth-msg").className = "auth-msg";
    if (m === "signup") $("#auth-password").setAttribute("autocomplete", "new-password");
    else $("#auth-password").setAttribute("autocomplete", "current-password");
  }

  function msg(text, kind) {
    var el = $("#auth-msg");
    el.textContent = text;
    el.className = "auth-msg " + (kind || "");
  }

  function busy(on) {
    var b = $("#auth-submit");
    b.disabled = on;
    if (on) { b.dataset.label = b.textContent; b.textContent = T.busy; }
    else if (b.dataset.label) b.textContent = b.dataset.label;
  }

  function nextUrl() {
    var q = new URLSearchParams(location.search);
    var n = q.get("next");
    return n && /^app\.html(?:\?view=templates(?:&tpl=[a-z0-9]+(?:-[a-z0-9]+)*)?)?$/i.test(n) ? n : "app.html";
  }

  async function go() {
    var email = $("#auth-email").value.trim();
    var pass = $("#auth-password").value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg(T.invalid, "is-err"); return; }
    if (mode !== "magic" && pass.length < 6) { msg(T.weak, "is-err"); return; }
    busy(true);
    try {
      if (mode === "magic") {
        await A.magic(email);
        msg(T.magicSent.replace("{email}", email), "is-ok");
        return;
      }
      if (mode === "signup") {
        var res = await A.signUp(email, pass);
        if (res.session) { msg(T.created, "is-ok"); location.replace(nextUrl()); return; }
        msg(T.needConfirm, "is-ok");
        return;
      }
      await A.signIn(email, pass);
      msg(T.created, "is-ok");
      location.replace(nextUrl());
    } catch (e) {
      var m = (e && e.message || "").toLowerCase();
      if (m.indexOf("invalid login") !== -1 || m.indexOf("invalid_grant") !== -1) msg(T.badCreds, "is-err");
      else if (m.indexOf("already") !== -1 || m.indexOf("registered") !== -1) msg(T.exists, "is-err");
      else if (m.indexOf("password") !== -1) msg(T.weak, "is-err");
      else if ((e && e.status === 429) || m.indexOf("rate") !== -1) msg(T.mailOff, "is-err");
      else msg((e && e.message) || T.net, "is-err");
    } finally { busy(false); }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var q = new URLSearchParams(location.search);
    setMode(q.get("mode") === "signup" ? "signup" : "signin");
    document.querySelectorAll(".auth-tab").forEach(function (b) {
      b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); });
    });
    $("#auth-form").addEventListener("submit", function (e) { e.preventDefault(); go(); });
    $("#auth-forgot").addEventListener("click", async function () {
      var email = $("#auth-email").value.trim();
      if (!email) { msg(T.forgotNeed, "is-err"); $("#auth-email").focus(); return; }
      try {
        await A.recover(email);
        msg(T.forgotSent, "is-ok");
      } catch (e) {
        var m = (e && e.message || "").toLowerCase();
        if (m.indexOf("invalid") !== -1) msg(T.invalid, "is-err");
        else if (m.indexOf("rate") !== -1) msg(T.mailOff, "is-err");
        else msg(e.message || T.net, "is-err");
      }
    });

    $("#auth-newpass-save").addEventListener("click", async function () {
      var v = $("#auth-newpass-input").value;
      if (v.length < 6) { msg(T.pwShort, "is-err"); return; }
      try {
        await A.updateUser({ password: v });
        msg(T.newpassOk, "is-ok");
        setTimeout(function () { location.replace(nextUrl()); }, 900);
      } catch (e) { msg(e.message || T.net, "is-err"); }
    });

    // A recovery link lands here with a session + type=recovery
    if (A.recovery && A.recovery()) {
      document.querySelector(".auth-tabs").hidden = true;
      $("#auth-form").hidden = true;
      $("#auth-forgot-row").hidden = true;
      $("#auth-newpass").hidden = false;
      $(".auth-title").textContent = T.newpassTitle;
      $(".auth-sub").textContent = T.newpassSub;
      $("#auth-google").closest(".auth-or").hidden = true;
      $("#auth-google").hidden = true;
    }

    $("#auth-google").addEventListener("click", function () {
      A.google().catch(function (e) {
        var off = e && (e.status === 400 || /provider|not enabled|disabled/i.test(e.message || ""));
        msg(off ? T.googleOff : (e && e.message) || T.net, "is-err");
      });
    });
    // If a session already exists, go straight in.
    if (A.session()) {
      A.ensure().then(function (s) { if (s) location.replace(nextUrl()); });
    }
  });
})();
