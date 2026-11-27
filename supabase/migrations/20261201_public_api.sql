-- Chatora Phase 2 item 12: public REST API + MCP, scoped keys. Additive and reversible
-- (rollback: drop the api_* functions and public.api_keys).
BEGIN;

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'API key',
  prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['contacts:read','flows:read','conversations:read'],
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT api_keys_len CHECK (char_length(name) <= 80 AND key_hash ~ '^[a-f0-9]{64}$' AND char_length(prefix) <= 16),
  CONSTRAINT api_keys_scopes CHECK (scopes <@ ARRAY['contacts:read','contacts:write','flows:read','conversations:read'] AND cardinality(scopes) >= 1)
);
CREATE INDEX IF NOT EXISTS api_keys_ws_idx ON public.api_keys (workspace_id);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_keys_own ON public.api_keys;
CREATE POLICY api_keys_own ON public.api_keys FOR ALL TO anon, authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')));
CREATE OR REPLACE FUNCTION public.api_keys_limit() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF (SELECT count(*) FROM public.api_keys WHERE workspace_id = new.workspace_id) >= 5 THEN
    RAISE EXCEPTION 'api key limit reached' USING errcode = 'check_violation';
  END IF;
  RETURN new;
END $f$;
DROP TRIGGER IF EXISTS api_keys_limit_trg ON public.api_keys;
CREATE TRIGGER api_keys_limit_trg BEFORE INSERT ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.api_keys_limit();

-- internal: resolve a key hash to a workspace if it holds the scope. Not exposed.
CREATE OR REPLACE FUNCTION public.api_auth(p_hash text, p_scope text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid;
BEGIN
  SELECT workspace_id INTO ws FROM public.api_keys WHERE key_hash = p_hash AND p_scope = ANY(scopes);
  IF ws IS NULL THEN RETURN NULL; END IF;
  UPDATE public.api_keys SET last_used_at = now() WHERE key_hash = p_hash AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute');
  RETURN ws;
END $f$;

CREATE OR REPLACE FUNCTION public.api_contacts_list(p_hash text, p_limit int, p_offset int, p_q text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; lim int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100); off int := GREATEST(COALESCE(p_offset, 0), 0); q text := NULLIF(left(COALESCE(p_q, ''), 80), '');
BEGIN
  ws := public.api_auth(p_hash, 'contacts:read');
  IF ws IS NULL THEN RETURN NULL; END IF;
  RETURN json_build_object(
    'total', (SELECT count(*) FROM public.contacts WHERE workspace_id = ws AND (q IS NULL OR name ILIKE '%' || q || '%' OR handle ILIKE '%' || q || '%')),
    'data', COALESCE((SELECT json_agg(r) FROM (
      SELECT id, name, handle, channel, tags, fields, last_seen, created_at FROM public.contacts
      WHERE workspace_id = ws AND (q IS NULL OR name ILIKE '%' || q || '%' OR handle ILIKE '%' || q || '%')
      ORDER BY created_at DESC LIMIT lim OFFSET off) r), '[]'::json));
END $f$;

CREATE OR REPLACE FUNCTION public.api_contact_create(p_hash text, p_name text, p_handle text, p_channel text, p_tags text[], p_fields jsonb) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; r record; tg text[];
BEGIN
  ws := public.api_auth(p_hash, 'contacts:write');
  IF ws IS NULL THEN RETURN NULL; END IF;
  IF COALESCE(btrim(p_name), '') = '' OR char_length(p_name) > 80 THEN RETURN json_build_object('error', 'invalid_name'); END IF;
  IF p_handle IS NOT NULL AND char_length(p_handle) > 120 THEN RETURN json_build_object('error', 'invalid_handle'); END IF;
  IF p_fields IS NOT NULL AND (jsonb_typeof(p_fields) <> 'object' OR char_length(p_fields::text) > 4000) THEN RETURN json_build_object('error', 'invalid_fields'); END IF;
  IF (SELECT count(*) FROM public.contacts WHERE workspace_id = ws) >= 100 THEN RETURN json_build_object('error', 'contact_limit'); END IF;
  SELECT COALESCE(array_agg(left(t, 30)), '{}') INTO tg FROM (SELECT t FROM unnest(COALESCE(p_tags, '{}')) t LIMIT 10) s;
  IF p_handle IS NOT NULL THEN
    SELECT id INTO r FROM public.contacts WHERE workspace_id = ws AND handle = p_handle LIMIT 1;
    IF FOUND THEN RETURN json_build_object('error', 'duplicate_handle', 'id', r.id); END IF;
  END IF;
  INSERT INTO public.contacts (workspace_id, name, handle, channel, tags, fields)
  VALUES (ws, btrim(p_name), p_handle, COALESCE(NULLIF(left(p_channel, 30), ''), 'api'), tg, COALESCE(p_fields, '{}'::jsonb))
  RETURNING id, name, handle, channel, tags, fields, created_at INTO r;
  RETURN json_build_object('data', row_to_json(r));
END $f$;

CREATE OR REPLACE FUNCTION public.api_flows_list(p_hash text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid;
BEGIN
  ws := public.api_auth(p_hash, 'flows:read');
  IF ws IS NULL THEN RETURN NULL; END IF;
  RETURN json_build_object('data', COALESCE((SELECT json_agg(r) FROM (
    SELECT id, name, channel, status, runs, jsonb_array_length(nodes) AS steps, updated_at FROM public.flows WHERE workspace_id = ws ORDER BY updated_at DESC LIMIT 100) r), '[]'::json));
END $f$;

CREATE OR REPLACE FUNCTION public.api_conversations_list(p_hash text, p_limit int, p_status text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; lim int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  ws := public.api_auth(p_hash, 'conversations:read');
  IF ws IS NULL THEN RETURN NULL; END IF;
  RETURN json_build_object('data', COALESCE((SELECT json_agg(r) FROM (
    SELECT c.id, c.contact_id, k.name AS contact_name, c.channel, c.status, c.unread, c.last_at
    FROM public.conversations c JOIN public.contacts k ON k.id = c.contact_id
    WHERE c.workspace_id = ws AND (p_status IS NULL OR c.status = p_status) ORDER BY c.last_at DESC LIMIT lim) r), '[]'::json));
END $f$;

CREATE OR REPLACE FUNCTION public.api_messages_list(p_hash text, p_conversation uuid, p_limit int) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; lim int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  ws := public.api_auth(p_hash, 'conversations:read');
  IF ws IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = p_conversation AND workspace_id = ws) THEN RETURN json_build_object('error', 'not_found'); END IF;
  RETURN json_build_object('data', COALESCE((SELECT json_agg(r) FROM (
    SELECT id, direction, author, body, created_at FROM public.messages WHERE conversation_id = p_conversation ORDER BY created_at DESC LIMIT lim) r), '[]'::json));
END $f$;

REVOKE ALL ON FUNCTION public.api_auth(text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_contacts_list(text, int, int, text) FROM public;
REVOKE ALL ON FUNCTION public.api_contact_create(text, text, text, text, text[], jsonb) FROM public;
REVOKE ALL ON FUNCTION public.api_flows_list(text) FROM public;
REVOKE ALL ON FUNCTION public.api_conversations_list(text, int, text) FROM public;
REVOKE ALL ON FUNCTION public.api_messages_list(text, uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.api_contacts_list(text, int, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_contact_create(text, text, text, text, text[], jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_flows_list(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_conversations_list(text, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_messages_list(text, uuid, int) TO anon, authenticated;

COMMIT;
