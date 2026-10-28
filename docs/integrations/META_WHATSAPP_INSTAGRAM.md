# Meta WhatsApp + Instagram integration

**Status (27 October 2026): local scaffold only — not connected, deployed, or tested against a Meta app.**

The user selected both WhatsApp and Instagram through Meta. The first-release route is **WhatsApp Cloud API via Embedded Signup v4 + Instagram Messaging via Facebook Login for Business for an Instagram Professional account linked to a Facebook Page**. The user selected the Tech Provider post-signup path and said they have/will obtain Meta provider approval; approval has not been verified. This is not the separate Instagram Login API flow.

**Important WhatsApp gate for a multi-tenant SaaS:** customer onboarding requires Meta Tech Provider or Solution Partner status and the current Embedded Signup v4 flow. Meta says v2/v3 were deprecated on 15 October 2026. The local code supports both provider paths; the public runtime config now explicitly selects `tech_provider` at the user's direction, but this does not verify Meta approval. The Supabase server configuration must match.

## What exists locally

- `supabase/migrations/20261027_meta_channel_scaffold.sql` — proposed tenant-scoped connection metadata, distinct WhatsApp phone-number/WABA IDs, server-only encrypted-token storage, short-lived hashed OAuth state with encrypted temporary Instagram token fields, provider IDs on conversations/messages, and an encrypted webhook inbox. **Not applied to Supabase.**
- `supabase/functions/meta-connect/index.ts` — authenticated local onboarding endpoint. It implements WhatsApp Embedded Signup v4 code exchange, WABA/phone validation, webhook subscription, PIN registration, and separate Tech Provider / Solution Partner post-signup actions. The Solution Partner branch requires a preconfigured credit line/system-user token and an explicitly selected business currency. The linked-Page Instagram branch exchanges the login code, briefly stores the user token encrypted while the user selects a Page, retrieves the Page token server-side, subscribes the Page, and encrypts the token. All paths check workspace ownership and default to disabled unless `META_ONBOARDING_ENABLED=true`; new starts best-effort delete expired OAuth states, but a scheduled cleanup is still required.
- `supabase/functions/meta-connect/smoke_test.mjs` — mocked end-to-end tests for the default-off gate, Tech Provider and Solution Partner branch separation, exact currency requirement, Instagram Page selection, encrypted tokens, ownership and CORS; run with `node supabase/functions/meta-connect/smoke_test.mjs`.
- `assets/js/meta-onboarding.js` — lazy-loads Meta's JS SDK only after a configured user action, captures the v4 session event and short-lived code, then sends them directly to the authenticated Edge Function. The code is not written to logs or local storage.
- `assets/js/app.js`, `_pages/app.html`, and `assets/css/style.css` — bilingual dashboard Settings cards for WhatsApp and Instagram connection, PIN/currency selection, linked-Page selection, and a public-ID readiness checklist that reports presence without exposing values. It cannot verify server-side settings or Meta approval. Public Meta IDs/config IDs are blank placeholders in `assets/js/config.js`, so the buttons are disabled.
- `supabase/functions/meta-webhook/index.ts` — verifies Meta's GET challenge and POST HMAC signature, encrypts each raw payload with AES-256-GCM, queues it privately, then synchronously normalizes supported inbound messages/statuses into the existing contacts/conversations/messages tables through restricted SQL RPCs. A database failure returns a retryable error to Meta.
- `supabase/functions/meta-webhook/smoke_test.mjs` — mocked local test for challenge verification, HMAC rejection, encrypted persistence, normalization, and queue completion; run with `node supabase/functions/meta-webhook/smoke_test.mjs`.
- `supabase/functions/_shared/meta-webhook-normalize.ts` — shared provider-safe normalizer used by webhook intake and private replay, so retries follow the same mapping rules.
- `supabase/functions/meta-replay/index.ts` — local private retry worker for expired-lease/pending encrypted inbox rows. Uses atomic DB claims, five-minute leases, payload decryption/hash verification, and bounded exponential retry delays. Not deployed or scheduled.
- `supabase/functions/meta-replay/smoke_test.mjs` — mocked tests for auth/origin gates, successful encrypted replay, hash mismatch deferral, and database failures; run with `node supabase/functions/meta-replay/smoke_test.mjs`.
- `supabase/functions/meta-send/index.ts` — authenticated, owner-scoped plain-text reply endpoint. It decrypts a per-connection token server-side, requires a matching account-specific conversation plus inbound event in the last 24 hours, and uses a client idempotency UUID so uncertain sends are not automatically repeated. `META_SEND_ENABLED` remains off by default.
- `supabase/functions/meta-send/smoke_test.mjs` — mocked local tests for CORS origin gating, authenticated request path, encrypted-token decryption, reply-window rejection, provider request, and idempotent retries; run with `node supabase/functions/meta-send/smoke_test.mjs`.
- `assets/js/meta-send-client.js` and `assets/js/meta-send-client.smoke_test.mjs` — authenticated browser client for the Inbox reply UI. `META_SEND_ENABLED` in public config is only a presentation gate and is false by default; the Supabase Edge Function kill switch remains authoritative. Test with `node assets/js/meta-send-client.smoke_test.mjs`.
- `supabase/functions/meta-retention/index.ts` — local scheduled-cleanup endpoint. It requires a separate server-side bearer secret and deletes only expired OAuth-state and webhook-inbox rows; it is not deployed or scheduled.
- `supabase/functions/meta-retention/smoke_test.mjs` — mocked tests for authorization, origin rejection, expiry-filtered deletes, and database errors; run with `node supabase/functions/meta-retention/smoke_test.mjs`.
- `supabase/config.toml` — webhook is public but HMAC-protected (`verify_jwt = false`); onboarding and send require a Supabase JWT (`verify_jwt = true`); replay and retention are server-to-server only, each protected by a separate cron secret.
- `_tools/meta-preflight.mjs` — offline release checklist for IDs, default-off gates, JWT policies, browser-secret assignments, migration objects, and local tests. Run with `node _tools/meta-preflight.mjs`; it reports missing IDs and exits `2` until they are configured. It performs no network calls and reads no secrets.

This is still **not live**: the SQL migration is unapplied; no Meta App ID, configuration IDs, App Secret, provider approval, or connected customer account has been supplied; and no Edge Function is deployed. The Inbox reply UI is wired to the authenticated `meta-send` client, but both its public UI gate and server kill switch remain off, so it cannot send. Onboarding, replay, retention, and send code have only local/mock validation and have not been tested against a Meta app or account. Replay and retention are not deployed or scheduled. Text replies outside the 24-hour window, templates, broadcasts, media, and automation remain out of scope. Do not apply the migration, deploy, register callbacks, enable onboarding/sends, or use customer data until explicitly authorized.

## Why no live connection was made

The Supabase project currently has no auth users or workspaces, no Edge Functions, and no Meta integration credentials or connected accounts were supplied. A Meta App ID/App Secret and business-account authorization must be created under the owner's Meta Business portfolio; these cannot be guessed or generated by Chatora. Never paste an App Secret, system-user token, Page token, or phone-number token into source code or browser configuration.

## Meta setup checklist

### 1. Create the Meta business app

- Use the business owner's Meta Developer account and business portfolio.
- Create a business app for messaging, add WhatsApp and Messenger/Instagram Messaging products, configure the exact app domain and Valid OAuth Redirect URI(s) used by the dashboard (the Embedded Signup v4 browser callback requires the spawning domain to be allowed), plus privacy policy, terms, and data-deletion instructions.
- Use Facebook Login for Business for the linked-Page Instagram route. Keep the Instagram account professional (Business or Creator), link it to the correct Facebook Page, and enable **Allow access to messages** under Instagram message controls / connected tools.
- Record the App ID as configuration; keep the App Secret server-side only.

### 2. WhatsApp Cloud API

- For a single-business development test, attach a test WhatsApp Business Account and test phone number.
- For Chatora's intended multi-tenant onboarding, obtain Meta Tech Provider or Solution Partner approval, then configure **Embedded Signup v4**. The local endpoint exchanges the returned code server-to-server immediately (Meta says it expires after 30 seconds), validates the WABA/phone-number relationship, and stores the returned business token encrypted. Do not implement against Embedded Signup v2/v3; Meta says they were deprecated on 15 October 2026.
- Explicitly select `META_WHATSAPP_PROVIDER_TYPE`. Tech Provider mode subscribes the customer WABA and registers the phone using the six-digit PIN entered by the workspace owner. Solution Partner mode additionally shares the configured credit line using the system-user token and the selected business currency, then registers the number. Solution Partner mode assumes the system user has already been added to the customer WABA; failure to satisfy that prerequisite stops setup.
- The WABA Messaging account ID and phone-number ID are stored separately. Do not use the WABA ID in the `external_account_id` field; WhatsApp sends use the phone-number ID.
- Configure an HTTPS Webhooks callback for the `whatsapp_business_account` object and subscribe the required `account_update` and `messages` fields before launching Embedded Signup v4; the customer WABA is separately subscribed by the server after signup. Include delivery-status events as applicable.
- Do not use a temporary getting-started token as a production credential. Confirm the account's approved templates and messaging policy before any business-initiated sends.

### 3. Instagram Messaging

- Connect an Instagram Professional account to a Facebook Page and grant the app the relevant Page task.
- The linked-Page Messenger API route uses `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata`, and `pages_show_list` for Page discovery. The local flow lists only Pages with an eligible Page task and a linked Instagram Professional account, then retrieves the Page token server-side and subscribes that Page to message events. The app-level Instagram webhook object/fields must also be enabled in Meta's app dashboard.
- Standard access is limited to app-role/test users. Serving other businesses/customers requires the relevant Advanced Access/App Review approvals. Confirm the current Meta review and business-verification requirements in the dashboard before onboarding external workspaces.

### 4. Browser configuration and server-side secrets (only after explicit release approval)

Public values go in `assets/js/config.js`; the App ID and both Config IDs are still blank. `META_WHATSAPP_PROVIDER_TYPE` is set to `tech_provider` at the user's direction; this is a route choice, not proof of approval.

- `META_APP_ID` — Meta App ID.
- `META_WHATSAPP_CONFIG_ID` — Login for Business configuration ID for Embedded Signup v4.
- `META_INSTAGRAM_CONFIG_ID` — Facebook Login for Business configuration ID with Page/Instagram messaging permissions.
- `META_WHATSAPP_PROVIDER_TYPE` — explicitly set to the same value (`tech_provider` or `solution_partner`) in public config and server secrets. A mismatch blocks the connect flow; the server choice is authoritative. Never infer approval from this value.
- `META_GRAPH_API_VERSION` — set to `v26.0` at this check (Meta’s current Graph API versions table); recheck before release and keep the browser/server values identical.
- `META_SEND_ENABLED` — public UI gate only; currently `false`. Leave false until release review. A public `true` value cannot bypass the separate server-side kill switch.

Set these in the Supabase Edge Function secret store, never in browser code:

- `META_APP_ID` — same public app ID, kept in server configuration.
- `META_APP_SECRET` — Meta App Secret; server-only.
- `META_WHATSAPP_CONFIG_ID`, `META_INSTAGRAM_CONFIG_ID`, `META_WHATSAPP_PROVIDER_TYPE` — server copies of the public configuration; the provider type must be explicitly selected.
- For `solution_partner` only: `META_WHATSAPP_CREDIT_LINE_ID` and `META_SYSTEM_USER_ACCESS_TOKEN`. The system user must already have the required access to the customer WABA. The API requires the customer's actual currency; the UI only allows `AUD`, `EUR`, `GBP`, `IDR`, `INR`, or `USD` per Meta's current credit-sharing documentation. No currency is selected by default.
- `META_ONBOARDING_ENABLED` — must be exactly `true` for connection start/finish actions. It is unset/false by default; leave it off until release approval and Meta test-account validation.
- `META_RETENTION_CRON_SECRET` — at least 32 random characters; only the trusted scheduler and `meta-retention` Edge Function should know it. The function requires it as a Bearer secret and rejects browser-origin requests.
- `META_REPLAY_CRON_SECRET` — a separate secret of at least 32 random characters; only the trusted scheduler and `meta-replay` Edge Function should know it. Never reuse the retention secret.
- Never paste the App Secret or any business/Page/system-user access token into chat, HTML, public config, logs, or source control.
- `META_WEBHOOK_VERIFY_TOKEN` — newly generated random value used only for callback verification.
- `META_WEBHOOK_ENCRYPTION_KEY` — base64 encoding of 32 random bytes for AES-256-GCM webhook-payload encryption.
- `CHANNEL_TOKEN_ENCRYPTION_KEY` — a separate base64 32-byte key for access-token encryption; never reuse the webhook key.
- Supabase platform-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` — the anon key is public by design; the service-role key is server-only and must never be disclosed or copied into client code.
- `META_GRAPH_API_VERSION` — server-side copy of the public version. It must match the browser SDK.
- `META_SEND_ENABLED` — must be exactly `true` to allow outbound sends; leave unset/false until the separate send path is reviewed and explicitly authorized.
- `APP_ALLOWED_ORIGINS` — comma-separated exact browser origins permitted to call Meta Edge Functions (for example `https://chatora.ansygroup.com`; add local/preview origins only when required).

Generate values only in the operator's trusted environment, for example `openssl rand -hex 32` for the verify token and `openssl rand -base64 32` separately for each encryption key. Do not reuse keys or place secret values in this workspace.

### 5. Release gates (not authorized yet)

1. Review and test the local migration and onboarding code; apply the migration only with explicit release approval.
2. Create the Meta app and Login for Business configurations. Configure the selected WhatsApp provider mode on both the public runtime config and Supabase secrets; for Solution Partner mode, verify the system-user WABA access, credit line, and customer currency.
3. Configure Meta App Dashboard products/permissions, the HTTPS `whatsapp_business_account` webhook with `account_update` and `messages`, Webhook verify token, app-level Instagram topic/fields, business data-deletion callback, the exact allowed domain, and the valid OAuth redirect URI required by Meta for the JS SDK flow. The code is handled by the Facebook JS SDK callback; there is no custom redirect-URI handler in this implementation.
4. Before release, validate each Graph endpoint and permission with Meta test assets. Local mocks do not prove Meta account eligibility or provider approval.
5. After explicit release approval and migration review, set a distinct `META_REPLAY_CRON_SECRET`, deploy `meta-replay`, and schedule a trusted server-side invocation. Test atomic row claims, expired-lease recovery, backoff retries, payload integrity checks, and idempotent message ingestion.
6. Keep `META_ONBOARDING_ENABLED` and `META_SEND_ENABLED` off until test cases, policy review, and explicit release authorization are complete. The Inbox reply UI is wired but both its public flag and server kill switch are off. The endpoint only allows plain-text replies within the conservative 24-hour window; templates, media, broadcasts, and automation are excluded.
7. After explicit release approval, set `META_RETENTION_CRON_SECRET`, deploy `meta-retention`, and schedule a trusted server-side invocation. Test that expired OAuth states (including abandoned encrypted Instagram user tokens) and 30-day webhook-inbox rows are deleted; neither temporary tokens nor raw payloads should be retained indefinitely.
8. Deploy the Edge Functions and migration only after review, Meta test-account validation, and explicit release approval. Then subscribe the intended webhook fields.
9. Test with Meta's test number and Instagram app-role accounts before requesting production access.

## Official references checked 27 October 2026

- [WhatsApp Cloud API — get started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Embedded Signup v4 implementation and version deprecation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/)
- [Embedded Signup overview and required permissions](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- [Meta Solution Partner / provider requirements](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview)
- [Tech Provider / Tech Partner Embedded Signup post-signup steps](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider/)
- [Solution Partner Embedded Signup post-signup steps and credit sharing](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-solution-partner/)
- [Graph API versions (v26.0 at this check)](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- [WhatsApp webhook overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)
- [Create a WhatsApp webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint)
- [WhatsApp Cloud API Message API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api)
- [WhatsApp service messages and customer-service window](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
- [Get started with Instagram Messaging](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/get-started/)
- [Instagram Messaging changelog — standard 24-hour window and Human Agent exception](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/changelog)
- [Send a message — Instagram Messaging](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/send-message/)
- [Messenger Platform webhooks](https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks)
- [Instagram API with Instagram Login (separate alternative flow)](https://developers.facebook.com/docs/instagram/platform/instagram-api)
