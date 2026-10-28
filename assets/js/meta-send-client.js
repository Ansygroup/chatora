/* Browser client for the authenticated Meta reply endpoint.
   META_SEND_ENABLED is a public UI gate only; the server-side kill switch is authoritative. */
(function () {
  "use strict";
  const C = window.CHATORA_CONFIG || {};
  const A = window.CHATORA_AUTH;

  function isEnabled() {
    return C.META_SEND_ENABLED === true;
  }

  async function send(input) {
    if (!isEnabled()) throw Object.assign(new Error("sending_disabled"), { code: "sending_disabled" });
    if (!A || typeof A.ensure !== "function") throw Object.assign(new Error("no_session"), { code: "no_session" });
    const session = await A.ensure();
    if (!session || !session.access_token) throw Object.assign(new Error("no_session"), { code: "no_session" });

    const base = String(C.SUPABASE_URL || "").replace(/\/$/, "");
    if (!base || !C.SUPABASE_ANON_KEY) throw Object.assign(new Error("client_not_configured"), { code: "client_not_configured" });
    const response = await fetch(base + "/functions/v1/meta-send", {
      method: "POST",
      headers: {
        apikey: C.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        workspaceId: String(input && input.workspaceId || ""),
        conversationId: String(input && input.conversationId || ""),
        connectionId: String(input && input.connectionId || ""),
        clientMessageId: String(input && input.clientMessageId || ""),
        text: String(input && input.text || "")
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      const code = data && typeof data.error === "string" ? data.error : "send_request_failed";
      throw Object.assign(new Error(code), { code, status: response.status, data });
    }
    return data;
  }

  window.CHATORA_META_SEND = { isEnabled, send };
})();
