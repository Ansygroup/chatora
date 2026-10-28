// Shared, provider-checked normalizer used by webhook intake and the private
// replay worker. Keep the `page` object rejected to avoid misrouting Facebook.
function isoFromEpoch(value, multiplier) {
  const n = Number(value);
  if (!Number.isFinite(n)) return new Date().toISOString();
  const d = new Date(n * multiplier);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function waBody(message) {
  const candidates = [
    message?.text?.body,
    message?.interactive?.button_reply?.title,
    message?.interactive?.list_reply?.title,
    message?.button?.text,
    message?.image?.caption,
    message?.video?.caption,
    message?.document?.caption
  ];
  const text = candidates.find((value) => typeof value === "string" && value.length > 0);
  return text || `[${String(message?.type || "non-text")} message]`;
}

function igBody(message) {
  if (typeof message?.text === "string" && message.text.length > 0) return message.text;
  const types = Array.isArray(message?.attachments)
    ? message.attachments.map((attachment) => String(attachment?.type || "media")).filter(Boolean)
    : [];
  return types.length ? `[${types.join(", ")} attachment]` : "[Non-text message]";
}

function normalizeMetaWebhookPayload(payload) {
  if (!payload || !Array.isArray(payload.entry)) return null;
  const object = String(payload.object || "");
  const messages = [];
  const statuses = [];

  if (object === "whatsapp_business_account") {
    for (const entry of payload.entry) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        const accountId = value?.metadata?.phone_number_id == null
          ? "" : String(value.metadata.phone_number_id);
        const contacts = new Map();
        for (const item of (Array.isArray(value.contacts) ? value.contacts : [])) {
          if (item?.wa_id != null) contacts.set(String(item.wa_id), String(item?.profile?.name || ""));
        }

        for (const message of (Array.isArray(value.messages) ? value.messages : [])) {
          const from = message?.from == null ? "" : String(message.from);
          const messageId = message?.id == null ? "" : String(message.id);
          if (!accountId || !from || !messageId) continue;
          messages.push({
            external_account_id: accountId,
            external_contact_id: from,
            external_conversation_id: `${accountId}:${from}`,
            provider_message_id: messageId,
            contact_name: contacts.get(from) || "WhatsApp contact",
            handle: /^\d{5,20}$/.test(from) ? `+${from}` : null,
            body: waBody(message),
            occurred_at: isoFromEpoch(message?.timestamp, 1000)
          });
        }

        for (const status of (Array.isArray(value.statuses) ? value.statuses : [])) {
          if (status?.id == null || status?.status == null) continue;
          statuses.push({
            external_account_id: accountId,
            provider_message_id: String(status.id),
            status: String(status.status).toLowerCase(),
            occurred_at: isoFromEpoch(status.timestamp, 1000)
          });
        }
      }
    }
    return { provider: "whatsapp_cloud", messages, statuses };
  }

  if (object === "instagram") {
    for (const entry of payload.entry) {
      const entryId = entry?.id == null ? "" : String(entry.id);
      for (const event of (Array.isArray(entry?.messaging) ? entry.messaging : [])) {
        const sender = event?.sender?.id == null ? "" : String(event.sender.id);
        const accountId = entryId || (event?.recipient?.id == null ? "" : String(event.recipient.id));
        const message = event?.message;
        if (message && !message.is_echo && sender && accountId && message.mid != null) {
          messages.push({
            external_account_id: accountId,
            external_contact_id: sender,
            external_conversation_id: `${accountId}:${sender}`,
            provider_message_id: String(message.mid),
            contact_name: "Instagram contact",
            handle: null,
            body: igBody(message),
            occurred_at: isoFromEpoch(event.timestamp, 1)
          });
        }
        const mids = Array.isArray(event?.delivery?.mids) ? event.delivery.mids : [];
        for (const mid of mids) {
          statuses.push({
            external_account_id: accountId,
            provider_message_id: String(mid),
            status: "delivered",
            occurred_at: isoFromEpoch(event.timestamp, 1)
          });
        }
      }
    }
    return { provider: "instagram_messenger", messages, statuses };
  }
  return null;
}

export { normalizeMetaWebhookPayload };
