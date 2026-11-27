-- Chatora Phase 1: Telegram channel connections.
-- Idempotent: safe whether or not 20261027_meta_channel_scaffold.sql was applied.

BEGIN;

-- ------------------------------------------------------------- table
CREATE TABLE IF NOT EXISTS public.channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_account_id text NOT NULL,
  external_messaging_account_id text,
  external_business_id text,
  external_page_id text,
  display_name text,
  status text NOT NULL DEFAULT 'pending',
  scopes text[] NOT NULL DEFAULT '{}',
  connection_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, external_account_id)
);
ALTER TABLE public.channel_connections
  ADD COLUMN IF NOT EXISTS external_messaging_account_id text;
-- Bot token for Telegram connections. Readable only by the workspace owner (RLS below).
ALTER TABLE public.channel_connections
  ADD COLUMN IF NOT EXISTS auth_token text;

ALTER TABLE public.channel_connections DROP CONSTRAINT IF EXISTS channel_connections_provider_check;
ALTER TABLE public.channel_connections
  ADD CONSTRAINT channel_connections_provider_check
  CHECK (provider IN ('whatsapp_cloud', 'instagram_messenger', 'telegram'));
ALTER TABLE public.channel_connections DROP CONSTRAINT IF EXISTS channel_connections_status_check;
ALTER TABLE public.channel_connections
  ADD CONSTRAINT channel_connections_status_check
  CHECK (status IN ('pending', 'connected', 'reauth_required', 'error', 'disconnected'));

-- Columns the webhook writer needs (same shape as the Meta scaffold).
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS provider_status text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS provider_status_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS client_message_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_channel_external_id_uq
  ON public.contacts (workspace_id, channel, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_channel_external_id_uq
  ON public.conversations (workspace_id, channel, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS messages_provider_message_id_uq
  ON public.messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS messages_client_message_id_uq
  ON public.messages (conversation_id, client_message_id);
CREATE INDEX IF NOT EXISTS channel_connections_ws_idx
  ON public.channel_connections (workspace_id);

-- ------------------------------------------------------------- RLS
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_connections_own ON public.channel_connections;
CREATE POLICY channel_connections_own ON public.channel_connections FOR ALL TO anon, authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')));

-- ------------------------------------------------------------- webhook writer
-- Called by the Cloudflare worker with the anon key when Telegram delivers an
-- update to /api/tg/hook/<connection id>. Mirrors widget_log for the web channel.
CREATE OR REPLACE FUNCTION public.tg_log(p_id uuid, p_update text, p_chat text, p_name text, p_text text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; cid uuid; vid uuid;
BEGIN
  IF p_chat !~ '^-?[0-9]{1,20}$' THEN RETURN; END IF;
  SELECT workspace_id INTO ws FROM public.channel_connections
    WHERE id = p_id AND provider = 'telegram' AND status = 'connected';
  IF ws IS NULL THEN RETURN; END IF;
  IF p_update IS NOT NULL AND p_update <> '' AND EXISTS (
    SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
    WHERE c.workspace_id = ws AND m.provider = 'telegram' AND m.provider_message_id = p_update
  ) THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.workspace_id = ws AND c.channel = 'telegram' AND m.created_at > now() - interval '1 hour') > 400 THEN RETURN; END IF;
  SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = 'tg:' || p_chat LIMIT 1;
  IF cid IS NULL THEN
    INSERT INTO public.contacts (workspace_id, name, handle, channel, tags, external_id)
    VALUES (ws, left(coalesce(nullif(p_name, ''), 'Telegram user'), 80), 'tg:' || p_chat, 'telegram', ARRAY['telegram'], p_chat)
    RETURNING id INTO cid;
  ELSE
    UPDATE public.contacts SET last_seen = now() WHERE id = cid;
  END IF;
  SELECT id INTO vid FROM public.conversations
    WHERE workspace_id = ws AND contact_id = cid AND channel = 'telegram' ORDER BY last_at DESC LIMIT 1;
  IF vid IS NULL THEN
    INSERT INTO public.conversations (workspace_id, contact_id, channel, status, unread)
    VALUES (ws, cid, 'telegram', 'ai', 0) RETURNING id INTO vid;
  END IF;
  INSERT INTO public.messages (conversation_id, direction, author, body, provider, provider_message_id)
  VALUES (vid, 'in', 'contact', left(p_text, 4000), 'telegram', left(p_update, 40));
  UPDATE public.conversations SET last_at = now(), last_inbound_at = now(), unread = unread + 1 WHERE id = vid;
END $f$;

REVOKE ALL ON FUNCTION public.tg_log(uuid, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.tg_log(uuid, text, text, text, text) TO anon, authenticated;

COMMIT;
