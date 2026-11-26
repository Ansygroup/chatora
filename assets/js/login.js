/* Chatora — login / signup page controller. */
(function () {
  var A = window.CHATORA_AUTH;
  var LANG = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();

  var T = {
    en: {
      submitSignin: "Sign in", submitSignup: "Create my workspace", submitMagic: "Email me a sign-in link",
      hintPassword: "At least 10 characters.",
      hintMagic: "We send a one-time link. No password needed.",
      busy: "One moment…",
      created: "Workspace ready — opening it now.",
      needConfirm: "If confirmation is required and email delivery is configured, check your inbox. If you already have an account, sign in instead.",
      magicSent: "If email delivery is configured, a sign-in link is on its way to {email}. Check your inbox and spam folder.",
      badCreds: "Email or password is not right.",
      exists: "That email already has an account — try signing in.",
      weak: "Use at least 10 characters with letters and numbers.",
      pwShort: "Use at least 10 characters.",
      invalid: "That email doesn't look valid.",
      googleOff: "Google sign-in is not configured yet. ",
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
      hintPassword: "10 حروف على الأقل.",
      hintMagic: "بنبعت لينك لمرة واحدة. من غير باسورد.",
      busy: "لحظة واحدة…",
      created: "مساحة العمل جاهزة — بنفتحها دلوقتي.",
      needConfirm: "لو تأكيد الإيميل مطلوب وإرساله متاح، راجع الوارد. لو عندك حساب بالفعل، سجّل الدخول بدلًا من كده.",
      magicSent: "لو إرسال الإيميل متاح، هيجيلك لينك دخول على {email}. راجع الوارد والسبام.",
      badCreds: "الإيميل أو الباسورد مش مظبوطين.",
      exists: "الإيميل ده عنده حساب بالفعل — جرّب تسجيل الدخول.",
      weak: "استخدم 10 حروف على الأقل مع أحرف وأرقام.",
      pwShort: "استخدم 10 حروف على الأقل.",
      invalid: "الإيميل ده مش صحيح.",
      googleOff: "الدخول بجوجل مش مظبوط لسه. ",
      net: "مشكلة في الشبكة — راجع اتصالك وجرّب تاني.",
      titleSignin: "أهلًا بعودتك", titleSignup: "أنشئ مساحة عملك", titleMagic: "لينك، من غير باسورد",
      subSignin: "سجّل الدخول لمساحة عمل شاتورا.", subSignup: "معاينة · بدون فوترة. استكشف مساحة عمل حقيقية بمسودات قابلة للتعديل وأدوات CSV؛ القنوات المباشرة وردود الذكاء الاصطناعي غير مفعّلة.",
      subMagic: "هنطلب لينك دخول لمرة واحدة؛ وصوله بيعتمد على إعداد البريد الإلكتروني للمشروع.",
      forgotSent: "لو العنوان له حساب وكان إرسال الإيميل متاحًا، هيتبعت لينك إعادة تعيين صالح لمدة ساعة.",
      forgotNeed: "اكتب الإيميل اللي سجلت بيه الأول.",
      newpassTitle: "اختار باسورد جديد", newpassSub: "أنت فتحت لينك استرجاع — حدّد الباسورد اللي هتستخدمه من دلوقتي.",
      newpassOk: "الباسورد اتحدّث — وأنت مسجل الدخول.",
      mailOff: "إرسال الإيميلات غير متاح أو عليه حدّ مؤقت حاليًا. جرّب لاحقًا أو سجّل الدخول بالباسورد.",
    },
    es: {
      "submitSignin": "Iniciar sesión",
      "submitSignup": "Crear mi espacio de trabajo",
      "submitMagic": "Envíame un enlace de acceso",
      "hintPassword": "Al menos 10 caracteres.",
      "hintMagic": "Enviamos un enlace de un solo uso. Sin contraseña.",
      "busy": "Un momento…",
      "created": "Espacio de trabajo listo: abriéndolo ahora.",
      "needConfirm": "Si se requiere confirmación y el envío de correo está configurado, revisa tu bandeja de entrada. Si ya tienes una cuenta, inicia sesión.",
      "magicSent": "Si el envío de correo está configurado, un enlace de acceso va de camino a {email}. Revisa la bandeja de entrada y la carpeta de spam.",
      "badCreds": "El correo o la contraseña no son correctos.",
      "exists": "Ese correo ya tiene una cuenta: prueba a iniciar sesión.",
      "weak": "Usa al menos 10 caracteres con letras y números.",
      "pwShort": "Usa al menos 10 caracteres.",
      "invalid": "Ese correo no parece válido.",
      "googleOff": "El acceso con Google aún no está configurado.",
      "net": "Problema de red: revisa tu conexión e inténtalo de nuevo.",
      "titleSignin": "Te damos la bienvenida de nuevo",
      "titleSignup": "Crea tu espacio de trabajo",
      "titleMagic": "Un enlace, sin contraseña",
      "subSignin": "Inicia sesión en tu espacio de trabajo de Chatora.",
      "subSignup": "Vista previa · sin facturación. Explora un espacio de trabajo real con borradores editables y herramientas CSV; los canales en vivo y las respuestas de IA no están activados.",
      "subMagic": "Solicitamos un enlace de acceso de un solo uso; la entrega depende de la configuración de correo del proyecto.",
      "forgotSent": "Si esa dirección tiene una cuenta y el envío de correo está disponible, se enviará un enlace de restablecimiento. Caduca en una hora.",
      "forgotNeed": "Escribe primero el correo con el que te registraste.",
      "newpassTitle": "Elige una contraseña nueva",
      "newpassSub": "Abriste un enlace de recuperación: define la contraseña que usarás a partir de ahora.",
      "newpassOk": "Contraseña actualizada: ya has iniciado sesión.",
      "mailOff": "El envío de correo no está disponible o está limitado en este momento. Inténtalo más tarde o inicia sesión con tu contraseña."
    },
    fr: {
      "submitSignin": "Se connecter",
      "submitSignup": "Créer mon espace de travail",
      "submitMagic": "M’envoyer un lien de connexion",
      "hintPassword": "Au moins 10 caractères.",
      "hintMagic": "Nous envoyons un lien à usage unique. Aucun mot de passe requis.",
      "busy": "Un instant…",
      "created": "Espace de travail prêt : ouverture en cours.",
      "needConfirm": "Si une confirmation est requise et que l’envoi d’e-mails est configuré, consultez votre boîte de réception. Si vous avez déjà un compte, connectez-vous.",
      "magicSent": "Si l’envoi d’e-mails est configuré, un lien de connexion est en route vers {email}. Vérifiez votre boîte de réception et vos courriers indésirables.",
      "badCreds": "L’adresse e-mail ou le mot de passe est incorrect.",
      "exists": "Cette adresse a déjà un compte : essayez de vous connecter.",
      "weak": "Utilisez au moins 10 caractères avec lettres et chiffres.",
      "pwShort": "Utilisez au moins 10 caractères.",
      "invalid": "Cette adresse e-mail ne semble pas valide.",
      "googleOff": "La connexion Google n’est pas encore configurée.",
      "net": "Problème de réseau : vérifiez votre connexion et réessayez.",
      "titleSignin": "Bon retour",
      "titleSignup": "Créez votre espace de travail",
      "titleMagic": "Un lien, sans mot de passe",
      "subSignin": "Connectez-vous à votre espace de travail Chatora.",
      "subSignup": "Aperçu · sans facturation. Explorez un véritable espace de travail avec des brouillons modifiables et des outils CSV ; les canaux en direct et les réponses IA ne sont pas activés.",
      "subMagic": "Nous demandons un lien de connexion à usage unique ; sa livraison dépend de la configuration e-mail du projet.",
      "forgotSent": "Si cette adresse a un compte et que l’envoi d’e-mails est disponible, un lien de réinitialisation sera envoyé. Il expire dans une heure.",
      "forgotNeed": "Saisissez d’abord l’adresse e-mail utilisée à l’inscription.",
      "newpassTitle": "Choisissez un nouveau mot de passe",
      "newpassSub": "Vous avez ouvert un lien de récupération : définissez le mot de passe à utiliser désormais.",
      "newpassOk": "Mot de passe mis à jour : vous êtes connecté.",
      "mailOff": "L’envoi d’e-mails est indisponible ou limité pour le moment. Réessayez plus tard ou connectez-vous avec votre mot de passe."
    },
    de: {
      "submitSignin": "Anmelden",
      "submitSignup": "Meinen Arbeitsbereich erstellen",
      "submitMagic": "Anmeldelink per E-Mail senden",
      "hintPassword": "Mindestens 10 Zeichen.",
      "hintMagic": "Wir senden einen Einmal-Link. Kein Passwort nötig.",
      "busy": "Einen Moment…",
      "created": "Arbeitsbereich bereit – wird jetzt geöffnet.",
      "needConfirm": "Falls eine Bestätigung erforderlich und der E-Mail-Versand eingerichtet ist, prüfe deinen Posteingang. Wenn du bereits ein Konto hast, melde dich stattdessen an.",
      "magicSent": "Falls der E-Mail-Versand eingerichtet ist, ist ein Anmeldelink an {email} unterwegs. Prüfe Posteingang und Spam-Ordner.",
      "badCreds": "E-Mail oder Passwort stimmt nicht.",
      "exists": "Zu dieser E-Mail gibt es bereits ein Konto – versuche, dich anzumelden.",
      "weak": "Verwende mindestens 10 Zeichen mit Buchstaben und Zahlen.",
      "pwShort": "Verwende mindestens 10 Zeichen.",
      "invalid": "Diese E-Mail-Adresse sieht nicht gültig aus.",
      "googleOff": "Die Google-Anmeldung ist noch nicht eingerichtet.",
      "net": "Netzwerkproblem – prüfe deine Verbindung und versuche es erneut.",
      "titleSignin": "Willkommen zurück",
      "titleSignup": "Erstelle deinen Arbeitsbereich",
      "titleMagic": "Ein Link, kein Passwort",
      "subSignin": "Melde dich in deinem Chatora-Arbeitsbereich an.",
      "subSignup": "Vorschau · keine Abrechnung. Erkunde einen echten Arbeitsbereich mit bearbeitbaren Entwürfen und CSV-Werkzeugen; Live-Kanäle und KI-Antworten sind nicht aktiviert.",
      "subMagic": "Wir fordern einen Einmal-Anmeldelink an; die Zustellung hängt von der E-Mail-Konfiguration des Projekts ab.",
      "forgotSent": "Falls zu dieser Adresse ein Konto besteht und der E-Mail-Versand verfügbar ist, wird ein Link zum Zurücksetzen gesendet. Er läuft nach einer Stunde ab.",
      "forgotNeed": "Gib zuerst die E-Mail-Adresse ein, mit der du dich registriert hast.",
      "newpassTitle": "Wähle ein neues Passwort",
      "newpassSub": "Du hast einen Wiederherstellungslink geöffnet – lege das Passwort fest, das du ab jetzt verwenden möchtest.",
      "newpassOk": "Passwort aktualisiert – du bist angemeldet.",
      "mailOff": "Der E-Mail-Versand ist derzeit nicht verfügbar oder begrenzt. Versuche es später erneut oder melde dich mit deinem Passwort an."
    },
    pt: {
      "submitSignin": "Entrar",
      "submitSignup": "Criar meu espaço de trabalho",
      "submitMagic": "Enviar um link de acesso por e-mail",
      "hintPassword": "Pelo menos 10 caracteres.",
      "hintMagic": "Enviamos um link de uso único. Sem senha.",
      "busy": "Um momento…",
      "created": "Espaço de trabalho pronto — abrindo agora.",
      "needConfirm": "Se a confirmação for exigida e o envio de e-mails estiver configurado, confira sua caixa de entrada. Se você já tem uma conta, entre.",
      "magicSent": "Se o envio de e-mails estiver configurado, um link de acesso está a caminho de {email}. Confira a caixa de entrada e o spam.",
      "badCreds": "E-mail ou senha incorretos.",
      "exists": "Esse e-mail já tem uma conta — tente entrar.",
      "weak": "Use pelo menos 10 caracteres com letras e números.",
      "pwShort": "Use pelo menos 10 caracteres.",
      "invalid": "Esse e-mail não parece válido.",
      "googleOff": "O login com Google ainda não está configurado.",
      "net": "Problema de rede — verifique sua conexão e tente novamente.",
      "titleSignin": "Que bom ter você de volta",
      "titleSignup": "Crie seu espaço de trabalho",
      "titleMagic": "Um link, sem senha",
      "subSignin": "Entre no seu espaço de trabalho da Chatora.",
      "subSignup": "Prévia · sem cobrança. Explore um espaço de trabalho real com rascunhos editáveis e ferramentas CSV; canais ao vivo e respostas de IA não estão ativados.",
      "subMagic": "Solicitamos um link de acesso de uso único; a entrega depende da configuração de e-mail do projeto.",
      "forgotSent": "Se esse endereço tiver uma conta e o envio de e-mails estiver disponível, um link de redefinição será enviado. Ele expira em uma hora.",
      "forgotNeed": "Digite primeiro o e-mail usado no cadastro.",
      "newpassTitle": "Escolha uma nova senha",
      "newpassSub": "Você abriu um link de recuperação — defina a senha que vai usar a partir de agora.",
      "newpassOk": "Senha atualizada — você está conectado.",
      "mailOff": "O envio de e-mails está indisponível ou limitado no momento. Tente mais tarde ou entre com sua senha."
    }
  };
  T = T[LANG] || T.en;

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
    /* New passwords need 8+ characters; sign-in only checks that one was typed. */
    if (mode === "signup" && (pass.length < 10 || !/\d/.test(pass) || !/[^\d\s]/.test(pass))) { msg(T.weak, "is-err"); return; }
    if (mode === "signin" && !pass.length) { msg(T.badCreds, "is-err"); return; }
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
      else if (m.indexOf("invalid email") !== -1) msg(T.invalid, "is-err");
      else msg(T.net, "is-err");
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
      if (v.length < 10) { msg(T.pwShort, "is-err"); return; }
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
        if (/cancel|popup_closed|popup_failed|access_denied/i.test((e && e.message) || "")) { msg("", ""); return; }
        msg(off ? T.googleOff : T.net, "is-err");
      });
    });
    // If a session already exists, go straight in.
    if (A.session()) {
      A.ensure().then(function (s) { if (s) location.replace(nextUrl()); });
    }
  });
})();
