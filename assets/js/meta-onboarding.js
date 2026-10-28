/* Chatora Meta onboarding client: Facebook JS SDK + authenticated Edge Function.
   Public IDs/config IDs only. App Secret, system-user token and encryption key
   stay in Supabase Edge Function secrets. */
(function () {
  "use strict";
  const C = window.CHATORA_CONFIG || {};
  const A = window.CHATORA_AUTH;
  const PROVIDERS = { whatsapp: "whatsapp_cloud", instagram: "instagram_messenger" };
  let sdkPromise = null;
  let sdkAppId = "";
  let sdkVersion = "";

  function publicVersion() {
    const version = String(C.META_GRAPH_API_VERSION || "v26.0");
    return /^v\d+\.\d+$/.test(version) ? version : "";
  }

  function isConfigured(kind) {
    const appId = String(C.META_APP_ID || "");
    if (!/^\d{5,32}$/.test(appId) || !publicVersion() || !C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) return false;
    if (kind === "whatsapp") {
      return /^\d{5,32}$/.test(String(C.META_WHATSAPP_CONFIG_ID || "")) &&
        ["tech_provider", "solution_partner"].includes(String(C.META_WHATSAPP_PROVIDER_TYPE || ""));
    }
    if (kind === "instagram") return /^\d{5,32}$/.test(String(C.META_INSTAGRAM_CONFIG_ID || ""));
    return false;
  }

  async function invoke(body) {
    if (!A || typeof A.ensure !== "function") throw new Error("no_session");
    const session = await A.ensure();
    if (!session || !session.access_token) throw new Error("no_session");
    const response = await fetch(C.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/meta-connect", {
      method: "POST",
      headers: {
        apikey: C.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      const code = data && typeof data.error === "string" ? data.error : "meta_onboarding_request_failed";
      throw Object.assign(new Error(code), { code: code, status: response.status });
    }
    return data;
  }

  function initializeSdk(appId, version) {
    if (sdkAppId && (sdkAppId !== appId || sdkVersion !== version)) throw new Error("meta_sdk_configuration_changed");
    if (window.FB) {
      if (!sdkAppId) {
        window.FB.init({ appId: appId, autoLogAppEvents: false, xfbml: false, version: version });
        sdkAppId = appId;
        sdkVersion = version;
      }
      return Promise.resolve();
    }
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      window.fbAsyncInit = function () {
        try {
          window.FB.init({ appId: appId, autoLogAppEvents: false, xfbml: false, version: version });
          sdkAppId = appId;
          sdkVersion = version;
          resolve();
        } catch (_) { reject(new Error("meta_sdk_init_failed")); }
      };
      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.onerror = function () { reject(new Error("meta_sdk_load_failed")); };
      document.head.appendChild(script);
    });
    return sdkPromise;
  }

  function facebookLogin(options) {
    return new Promise((resolve, reject) => {
      try {
        window.FB.login((response) => {
          const code = response && response.authResponse && response.authResponse.code;
          if (typeof code === "string" && code.length >= 10) resolve(code);
          else reject(new Error("meta_login_cancelled_or_missing_code"));
        }, options);
      } catch (_) { reject(new Error("meta_login_failed")); }
    });
  }

  function facebookOrigin(origin) {
    try {
      const url = new URL(origin);
      const host = url.hostname.toLowerCase();
      return url.protocol === "https:" && (host === "facebook.com" || host.endsWith(".facebook.com"));
    } catch (_) { return false; }
  }

  function readSignupMessage(raw) {
    if (raw && typeof raw === "object") return raw;
    if (typeof raw !== "string") return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  async function start(provider, workspaceId) {
    workspaceId = String(workspaceId || "");
    if (!workspaceId) throw new Error("workspace_missing");
    const result = await invoke({ action: "start", provider: provider, workspaceId: workspaceId });
    const expectedVersion = publicVersion();
    const expectedConfig = provider === PROVIDERS.whatsapp
      ? String(C.META_WHATSAPP_CONFIG_ID || "") : String(C.META_INSTAGRAM_CONFIG_ID || "");
    const providerModeMatches = provider !== PROVIDERS.whatsapp ||
      result.providerType === String(C.META_WHATSAPP_PROVIDER_TYPE || "");
    if (!result.appId || result.appId !== String(C.META_APP_ID || "") || !result.configId ||
        result.configId !== expectedConfig || !providerModeMatches || !result.state || result.graphApiVersion !== expectedVersion) {
      throw new Error("meta_public_server_config_mismatch");
    }
    await initializeSdk(result.appId, result.graphApiVersion);
    return result;
  }

  async function connectWhatsApp(workspaceId, pin, currency) {
    if (!isConfigured("whatsapp")) throw new Error("meta_client_not_configured");
    if (!/^\d{6}$/.test(String(pin || ""))) throw new Error("invalid_whatsapp_pin");
    const started = await start(PROVIDERS.whatsapp, workspaceId);
    const publicType = String(C.META_WHATSAPP_PROVIDER_TYPE || "");
    if (started.providerType !== publicType) throw new Error("provider_type_changed_restart_signup");

    let resolveEvent;
    let rejectEvent;
    const eventPromise = new Promise((resolve, reject) => { resolveEvent = resolve; rejectEvent = reject; });
    // Meta may report cancellation before FB.login calls back; mark the promise
    // handled immediately while still allowing the later await to receive errors.
    eventPromise.catch(() => {});
    let captured = false;
    const onMessage = (event) => {
      if (!facebookOrigin(event.origin)) return;
      const message = readSignupMessage(event.data);
      if (!message || message.type !== "WA_EMBEDDED_SIGNUP" || captured) return;
      captured = true;
      if (message.event === "FINISH" && message.data && typeof message.data === "object") resolveEvent(message);
      else if (message.event === "FINISH_ONLY_WABA") rejectEvent(new Error("whatsapp_phone_number_required"));
      else if (message.event === "CANCEL") rejectEvent(new Error("whatsapp_signup_cancelled"));
      else if (message.event === "ERROR") rejectEvent(new Error("whatsapp_signup_error"));
      else rejectEvent(new Error("whatsapp_signup_not_completed"));
    };
    window.addEventListener("message", onMessage);
    try {
      const code = await facebookLogin({
        config_id: started.configId,
        response_type: "code",
        override_default_response_type: true,
        state: started.state,
        extras: { setup: {} }
      });
      let timeoutId;
      const sessionInfo = await Promise.race([
        eventPromise,
        new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error("whatsapp_session_info_timeout")), 15000); })
      ]).finally(() => clearTimeout(timeoutId));
      return await invoke({
        action: "whatsapp_finish",
        workspaceId: String(workspaceId),
        state: started.state,
        code: code,
        sessionInfo: sessionInfo,
        providerType: publicType,
        pin: String(pin),
        currency: String(currency || "").toUpperCase()
      });
    } finally {
      window.removeEventListener("message", onMessage);
    }
  }

  async function beginInstagram(workspaceId) {
    if (!isConfigured("instagram")) throw new Error("meta_client_not_configured");
    const started = await start(PROVIDERS.instagram, workspaceId);
    const code = await facebookLogin({
      config_id: started.configId,
      response_type: "code",
      override_default_response_type: true,
      state: started.state
    });
    const result = await invoke({
      action: "instagram_prepare",
      workspaceId: String(workspaceId),
      state: started.state,
      code: code
    });
    return { state: started.state, pages: result.pages || [] };
  }

  async function finishInstagram(workspaceId, state, pageId) {
    if (!workspaceId || !state || !pageId) throw new Error("instagram_page_required");
    return invoke({
      action: "instagram_select",
      workspaceId: String(workspaceId),
      state: state,
      pageId: pageId
    });
  }

  window.CHATORA_META_ONBOARDING = {
    isConfigured: isConfigured,
    connectWhatsApp: connectWhatsApp,
    beginInstagram: beginInstagram,
    finishInstagram: finishInstagram
  };
})();
