-- Chatora Meta channel integration scaffold — LOCAL DRAFT ONLY.
-- This migration has NOT been applied to Supabase. Apply only after the
-- OAuth/token vault and webhook processor have been reviewed and tested.

BEGIN;

-- Provider identifiers needed to safely match real Meta contacts/conversations.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_message_id uuid;

-- NULL external IDs remain allowed for manually imported/local records.
CREATE UNIQUE INDEX IF NOT EXISTS contacts_channel_external_id_uq
  ON public.contacts (workspace_id, channel, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_channel_external_id_uq
  ON public.conversations (workspace_id, channel, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS messages_provider_message_id_uq
  ON public.messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS messages_client_message_id_uq
  ON public.messages (conversation_id, client_message_id);
CREATE INDEX IF NOT EXISTS conversations_last_inbound_at_idx
  ON public.conversations (last_inbound_at DESC)
  WHERE last_inbound_at IS NOT NULL;

-- Safe, browser-readable connection metadata only. Never store Meta tokens here.
CREATE TABLE IF NOT EXISTS public.channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('whatsapp_cloud', 'instagram_messenger')),
  external_account_id text NOT NULL,
  external_messaging_account_id text,
  external_business_id text,
  external_page_id text,
  display_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connected', 'reauth_required', 'error', 'disconnected')),
  scopes text[] NOT NULL DEFAULT '{}',
  connection_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, external_account_id)
);
ALTER TABLE public.channel_connections
  ADD COLUMN IF NOT EXISTS external_messaging_account_id text;
COMMENT ON COLUMN public.channel_connections.external_account_id IS
  'WhatsApp phone_number_id for whatsapp_cloud; Instagram Professional account ID for instagram_messenger.';
COMMENT ON COLUMN public.channel_connections.external_messaging_account_id IS
  'WhatsApp Messaging account (WABA) ID. Kept separate from phone_number_id.';
-- An active Meta account must route to exactly one workspace.
CREATE UNIQUE INDEX IF NOT EXISTS channel_connections_active_account_uq
  ON public.channel_connections (provider, external_account_id)
  WHERE status IN ('pending', 'connected', 'reauth_required', 'error');
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.channel_connections FROM anon, authenticated;
GRANT SELECT ON public.channel_connections TO authenticated;
GRANT ALL ON public.channel_connections TO service_role;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'channel_connections'
      AND policyname = 'channel_connections_read_workspace_owner'
  ) THEN
    CREATE POLICY channel_connections_read_workspace_owner
      ON public.channel_connections FOR SELECT TO authenticated
      USING (workspace_id IN (
        SELECT id FROM public.workspaces WHERE owner = auth.uid()
      ));
  END IF;
END $$;

-- App-level encrypted credentials. No policy or client grants: only trusted
-- server-side functions using the service role may access this table.
CREATE TABLE IF NOT EXISTS public.channel_connection_secrets (
  connection_id uuid PRIMARY KEY
    REFERENCES public.channel_connections(id) ON DELETE CASCADE,
  access_token_ciphertext text NOT NULL,
  access_token_iv text NOT NULL,
  token_expires_at timestamptz,
  key_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channel_connection_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.channel_connection_secrets FROM anon, authenticated;
GRANT ALL ON public.channel_connection_secrets TO service_role;

-- Encrypted, short-lived webhook ingress queue. Raw message payloads are never
-- readable by the browser; a later server-side processor decrypts and normalizes
-- them into contacts/conversations/messages, then marks them processed.
CREATE TABLE IF NOT EXISTS public.meta_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('whatsapp_cloud', 'instagram_messenger')),
  external_account_id text,
  payload_sha256 text NOT NULL,
  payload_ciphertext text NOT NULL,
  payload_iv text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  processed_at timestamptz,
  processing_error text,
  processing_attempts integer NOT NULL DEFAULT 0 CHECK (processing_attempts >= 0),
  processing_lease_until timestamptz,
  next_attempt_at timestamptz DEFAULT now(),
  UNIQUE (provider, payload_sha256)
);
ALTER TABLE public.meta_webhook_inbox
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz DEFAULT now();
ALTER TABLE public.meta_webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_webhook_inbox FROM anon, authenticated;
GRANT ALL ON public.meta_webhook_inbox TO service_role;
CREATE INDEX IF NOT EXISTS meta_webhook_inbox_pending_idx
  ON public.meta_webhook_inbox (received_at)
  WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS meta_webhook_inbox_retry_idx
  ON public.meta_webhook_inbox (next_attempt_at, received_at)
  WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS meta_webhook_inbox_expiry_idx
  ON public.meta_webhook_inbox (expires_at);

-- Atomic retry claiming prevents concurrent replay workers from processing the
-- same row. A crashed worker releases its lease automatically after 5 minutes.
CREATE OR REPLACE FUNCTION public.chatora_claim_meta_webhook_events(
  p_limit integer,
  p_lease_seconds integer
)
RETURNS SETOF public.meta_webhook_inbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 25 THEN
    RAISE EXCEPTION 'Invalid webhook replay batch size';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 900 THEN
    RAISE EXCEPTION 'Invalid webhook replay lease duration';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT inbox.id
    FROM public.meta_webhook_inbox AS inbox
    WHERE inbox.processed_at IS NULL
      AND inbox.expires_at > now()
      AND COALESCE(inbox.next_attempt_at, inbox.received_at) <= now()
      AND (inbox.processing_lease_until IS NULL OR inbox.processing_lease_until < now())
    ORDER BY inbox.received_at, inbox.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.meta_webhook_inbox AS inbox
  SET processing_lease_until = now() + make_interval(secs => p_lease_seconds),
      processing_attempts = inbox.processing_attempts + 1,
      processing_error = NULL
  FROM candidates
  WHERE inbox.id = candidates.id
  RETURNING inbox.*;
END
$function$;
REVOKE ALL ON FUNCTION public.chatora_claim_meta_webhook_events(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chatora_claim_meta_webhook_events(integer, integer) TO service_role;

-- One-time OAuth state is stored hashed, expires quickly, and is server-only.
-- A temporary encrypted Facebook user token is kept only between Instagram page
-- selection steps; it is cleared as soon as the Page token is stored.
CREATE TABLE IF NOT EXISTS public.meta_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('whatsapp_cloud', 'instagram_messenger')),
  state_sha256 text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz,
  code_exchange_started_at timestamptz,
  code_exchanged_at timestamptz,
  access_token_ciphertext text,
  access_token_iv text,
  token_expires_at timestamptz,
  state_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_oauth_states
  ADD COLUMN IF NOT EXISTS code_exchange_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS code_exchanged_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_token_ciphertext text,
  ADD COLUMN IF NOT EXISTS access_token_iv text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS state_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS meta_oauth_states_expiry_idx
  ON public.meta_oauth_states (expires_at);
ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_oauth_states FROM anon, authenticated;
GRANT ALL ON public.meta_oauth_states TO service_role;

-- Atomic, idempotent inbound message normalization. Called only by trusted
-- server-side code after Meta's webhook signature has been verified.
CREATE OR REPLACE FUNCTION public.chatora_ingest_meta_messages(p_provider text, p_events jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_event jsonb;
  v_account_id text;
  v_external_contact_id text;
  v_external_conversation_id text;
  v_provider_message_id text;
  v_body text;
  v_name text;
  v_handle text;
  v_occurred_at timestamptz;
  v_channel text;
  v_workspace_id uuid;
  v_contact_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_processed integer := 0;
BEGIN
  IF p_provider IS NULL OR p_provider NOT IN ('whatsapp_cloud', 'instagram_messenger') THEN
    RAISE EXCEPTION 'Unsupported Meta provider';
  END IF;
  IF jsonb_typeof(p_events) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Events must be a JSON array';
  END IF;

  v_channel := CASE p_provider
    WHEN 'whatsapp_cloud' THEN 'whatsapp'
    ELSE 'instagram'
  END;

  FOR v_event IN SELECT value FROM jsonb_array_elements(p_events) AS items(value)
  LOOP
    v_account_id := NULLIF(v_event->>'external_account_id', '');
    v_external_contact_id := NULLIF(v_event->>'external_contact_id', '');
    v_external_conversation_id := NULLIF(v_event->>'external_conversation_id', '');
    v_provider_message_id := NULLIF(v_event->>'provider_message_id', '');
    v_body := COALESCE(v_event->>'body', '');
    v_name := COALESCE(NULLIF(v_event->>'contact_name', ''),
      CASE WHEN p_provider = 'whatsapp_cloud' THEN 'WhatsApp contact' ELSE 'Instagram contact' END);
    v_handle := NULLIF(v_event->>'handle', '');
    v_occurred_at := COALESCE(NULLIF(v_event->>'occurred_at', '')::timestamptz, now());

    IF v_account_id IS NULL OR v_external_contact_id IS NULL OR v_provider_message_id IS NULL THEN
      RAISE EXCEPTION 'Meta inbound message is missing an account, contact, or message ID';
    END IF;
    IF length(v_body) > 5000 THEN
      RAISE EXCEPTION 'Meta message text is too long';
    END IF;
    IF v_external_conversation_id IS NULL THEN
      v_external_conversation_id := v_account_id || ':' || v_external_contact_id;
    END IF;
    -- Avoid any workspace/contact/conversation side effects on a normal retry.
    IF EXISTS (
      SELECT 1 FROM public.messages
      WHERE provider = p_provider AND provider_message_id = v_provider_message_id
    ) THEN
      CONTINUE;
    END IF;

    SELECT cc.workspace_id INTO v_workspace_id
      FROM public.channel_connections AS cc
      WHERE cc.provider = p_provider
        AND cc.external_account_id = v_account_id
        AND cc.status = 'connected'
      LIMIT 1;
    IF v_workspace_id IS NULL THEN
      RAISE EXCEPTION 'No active Chatora connection matches this Meta account';
    END IF;

    INSERT INTO public.contacts
      (workspace_id, name, handle, channel, tags, last_seen, external_id)
    VALUES
      (v_workspace_id, v_name, v_handle, v_channel, ARRAY[]::text[], v_occurred_at, v_external_contact_id)
    ON CONFLICT (workspace_id, channel, external_id) DO UPDATE
      SET last_seen = GREATEST(public.contacts.last_seen, EXCLUDED.last_seen),
          name = CASE
            WHEN public.contacts.name IN ('WhatsApp contact', 'Instagram contact')
              AND EXCLUDED.name NOT IN ('WhatsApp contact', 'Instagram contact')
            THEN EXCLUDED.name ELSE public.contacts.name END,
          handle = COALESCE(public.contacts.handle, EXCLUDED.handle)
    RETURNING id INTO v_contact_id;

    INSERT INTO public.conversations
      (workspace_id, contact_id, channel, status, unread, last_at, external_id, last_inbound_at)
    VALUES
      (v_workspace_id, v_contact_id, v_channel, 'open', 0, v_occurred_at,
       v_external_conversation_id, v_occurred_at)
    ON CONFLICT (workspace_id, channel, external_id) DO UPDATE
      SET contact_id = EXCLUDED.contact_id
    RETURNING id INTO v_conversation_id;

    v_message_id := NULL;
    INSERT INTO public.messages
      (conversation_id, direction, author, body, created_at, provider, provider_message_id, provider_status, provider_status_at)
    VALUES
      (v_conversation_id, 'in', 'contact', COALESCE(NULLIF(v_body, ''), '[Message received]'),
       v_occurred_at, p_provider, v_provider_message_id, 'received', v_occurred_at)
    ON CONFLICT (provider, provider_message_id)
      WHERE (provider_message_id IS NOT NULL) DO NOTHING
    RETURNING id INTO v_message_id;

    IF v_message_id IS NOT NULL THEN
      UPDATE public.conversations
        SET unread = unread + 1,
            status = CASE WHEN status = 'closed' THEN 'open' ELSE status END,
            last_at = GREATEST(last_at, v_occurred_at),
            last_inbound_at = GREATEST(
              COALESCE(last_inbound_at, '-infinity'::timestamptz), v_occurred_at
            )
        WHERE id = v_conversation_id;
      v_processed := v_processed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed);
END
$function$;
REVOKE ALL ON FUNCTION public.chatora_ingest_meta_messages(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chatora_ingest_meta_messages(text, jsonb) TO service_role;

-- Apply provider delivery receipts without allowing older/out-of-order updates
-- to overwrite a newer status.
CREATE OR REPLACE FUNCTION public.chatora_update_meta_statuses(p_provider text, p_events jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_event jsonb;
  v_message_id text;
  v_status text;
  v_status_at timestamptz;
  v_updated integer := 0;
  v_rows integer;
BEGIN
  IF p_provider IS NULL OR p_provider NOT IN ('whatsapp_cloud', 'instagram_messenger') THEN
    RAISE EXCEPTION 'Unsupported Meta provider';
  END IF;
  IF jsonb_typeof(p_events) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Status events must be a JSON array';
  END IF;

  FOR v_event IN SELECT value FROM jsonb_array_elements(p_events) AS items(value)
  LOOP
    v_message_id := NULLIF(v_event->>'provider_message_id', '');
    v_status := lower(COALESCE(v_event->>'status', ''));
    v_status_at := COALESCE(NULLIF(v_event->>'occurred_at', '')::timestamptz, now());
    IF v_message_id IS NULL OR v_status NOT IN ('sent', 'delivered', 'read', 'failed') THEN
      CONTINUE;
    END IF;

    UPDATE public.messages
      SET provider_status = v_status,
          provider_status_at = v_status_at
      WHERE provider = p_provider
        AND provider_message_id = v_message_id
        AND (provider_status_at IS NULL OR provider_status_at <= v_status_at);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_updated := v_updated + v_rows;
  END LOOP;

  RETURN jsonb_build_object('updated', v_updated);
END
$function$;
REVOKE ALL ON FUNCTION public.chatora_update_meta_statuses(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chatora_update_meta_statuses(text, jsonb) TO service_role;

COMMIT;
