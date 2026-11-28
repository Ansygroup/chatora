-- Chatora Phase 3: inbound API events + outbound webhook subscriptions (Zapier/Make/n8n).
-- Additive and reversible (rollback: drop the new functions, public.hook_subscriptions,
-- public.hook_events, and restore the old api_keys_scopes constraint).
BEGIN;

-- 1. API keys gain three scopes: events:write (inbound events), hooks:write (webhook
--    subscriptions + samples), messages:write (send a Telegram message to a known contact).
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_scopes;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_scopes
  CHECK (scopes <@ ARRAY['contacts:read','contacts:write','flows:read','conversations:read','events:write','hooks:write','messages:write'] AND cardinality(scopes) >= 1);

-- 2. Outbound webhook subscriptions. Owner-managed through the dashboard (RLS) and
--    through the REST API with a hooks:write key (Zapier REST Hooks subscribe/unsubscribe).
CREATE TABLE IF NOT EXISTS public.hook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event text NOT NULL,
  target_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz,
  last_status integer,
  CONSTRAINT hook_subs_event CHECK (event = ANY (ARRAY['contact.created','message.received','event.received','flow.finished'])),
  CONSTRAINT hook_subs_url CHECK (target_url LIKE 'https://%' AND char_length(target_url) BETWEEN 12 AND 300 AND target_url !~ '\s')
);
CREATE INDEX IF NOT EXISTS hook_subs_ws_idx ON public.hook_subscriptions (workspace_id);
ALTER TABLE public.hook_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hook_subs_own ON public.hook_subscriptions;
CREATE POLICY hook_subs_own ON public.hook_subscriptions FOR ALL TO anon, authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')));
CREATE OR REPLACE FUNCTION public.hook_subs_limit() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF (SELECT count(*) FROM public.hook_subscriptions WHERE workspace_id = new.workspace_id) >= 10 THEN
    RAISE EXCEPTION 'webhook limit reached' USING errcode = 'check_violation';
  END IF;
  RETURN new;
END $f$;
DROP TRIGGER IF EXISTS hook_subs_limit_trg ON public.hook_subscriptions;
CREATE TRIGGER hook_subs_limit_trg BEFORE INSERT ON public.hook_subscriptions FOR EACH ROW EXECUTE FUNCTION public.hook_subs_limit();

-- 3. Recent deliveries double as Zapier "sample data" for the REST Hook performList.
--    No RLS policies on purpose: reachable only through the security-definer RPCs below.
CREATE TABLE IF NOT EXISTS public.hook_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hook_events_len CHECK (char_length(data::text) <= 4000)
);
CREATE INDEX IF NOT EXISTS hook_events_ws_idx ON public.hook_events (workspace_id, id DESC);
ALTER TABLE public.hook_events ENABLE ROW LEVEL SECURITY;

-- internal: record an event and return its id plus the subscribed targets.
CREATE OR REPLACE FUNCTION public.hook_emit(p_key text, p_ws uuid, p_event text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_id bigint; v_subs jsonb;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_event NOT IN ('contact.created','message.received','event.received','flow.finished') THEN RETURN NULL; END IF;
  p_data := COALESCE(p_data, '{}'::jsonb);
  IF char_length(p_data::text) > 3800 THEN
    p_data := jsonb_build_object('truncated', true, 'preview', left(p_data::text, 3800));
  END IF;
  INSERT INTO public.hook_events (workspace_id, event, data)
    VALUES (p_ws, p_event, p_data) RETURNING id INTO v_id;
  DELETE FROM public.hook_events WHERE workspace_id = p_ws AND id <
    (SELECT COALESCE((SELECT id FROM public.hook_events WHERE workspace_id = p_ws ORDER BY id DESC OFFSET 99 LIMIT 1), 0));
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'url', s.target_url)), '[]'::jsonb)
    INTO v_subs FROM public.hook_subscriptions s WHERE s.workspace_id = p_ws AND s.event = p_event;
  RETURN jsonb_build_object('id', v_id, 'subs', v_subs);
END $f$;

-- internal: store the delivery result for one subscription.
CREATE OR REPLACE FUNCTION public.hook_report(p_key text, p_id uuid, p_status integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.hook_subscriptions SET last_at = now(), last_status = p_status WHERE id = p_id;
END $f$;

-- internal: resolve a workspace from a channel reference, for hook emission from
-- the Telegram webhook ('telegram' + connection id) and the site widget ('web' + widget key).
CREATE OR REPLACE FUNCTION public.hook_ws_lookup(p_key text, p_scope text, p_ref text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_scope = 'telegram' AND p_ref ~ '^[0-9a-f-]{36}$' THEN
    SELECT workspace_id INTO ws FROM public.channel_connections WHERE id = p_ref::uuid AND provider = 'telegram';
  ELSIF p_scope = 'web' AND p_ref ~ '^ck_[a-f0-9]{32}$' THEN
    SELECT workspace_id INTO ws FROM public.widget_keys WHERE key = p_ref;
  END IF;
  RETURN ws;
END $f$;

-- Zapier/Make/n8n management API (scope: hooks:write). Null means the key is invalid
-- or lacks the scope, same convention as the other api_* functions.
CREATE OR REPLACE FUNCTION public.api_hooks_list(p_hash text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid;
BEGIN
  ws := public.api_auth(p_hash, 'hooks:write');
  IF ws IS NULL THEN RETURN NULL; END IF;
  RETURN json_build_object('data', COALESCE((SELECT json_agg(r) FROM (
    SELECT id, event, target_url, last_status, last_at, created_at FROM public.hook_subscriptions
    WHERE workspace_id = ws ORDER BY created_at ASC LIMIT 20) r), '[]'::json));
END $f$;

CREATE OR REPLACE FUNCTION public.api_hook_create(p_hash text, p_event text, p_url text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; r record;
BEGIN
  ws := public.api_auth(p_hash, 'hooks:write');
  IF ws IS NULL THEN RETURN NULL; END IF;
  IF p_event NOT IN ('contact.created','message.received','event.received','flow.finished') THEN
    RETURN json_build_object('error', 'bad_event'); END IF;
  IF p_url IS NULL OR p_url !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/\S*)?$' OR char_length(p_url) > 300 THEN
    RETURN json_build_object('error', 'bad_url'); END IF;
  IF (SELECT count(*) FROM public.hook_subscriptions WHERE workspace_id = ws) >= 10 THEN
    RETURN json_build_object('error', 'hook_limit'); END IF;
  INSERT INTO public.hook_subscriptions (workspace_id, event, target_url)
    VALUES (ws, p_event, p_url) RETURNING id, event, target_url, created_at INTO r;
  RETURN json_build_object('data', row_to_json(r));
END $f$;

CREATE OR REPLACE FUNCTION public.api_hook_delete(p_hash text, p_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid;
BEGIN
  ws := public.api_auth(p_hash, 'hooks:write');
  IF ws IS NULL THEN RETURN NULL; END IF;
  DELETE FROM public.hook_subscriptions WHERE id = p_id AND workspace_id = ws;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;
  RETURN json_build_object('ok', true);
END $f$;

-- Zapier REST Hook "perform list": bare array, newest first, each item carries id.
CREATE OR REPLACE FUNCTION public.api_hook_samples(p_hash text, p_event text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid;
BEGIN
  ws := public.api_auth(p_hash, 'hooks:write');
  IF ws IS NULL THEN RETURN NULL; END IF;
  RETURN COALESCE((SELECT json_agg(r) FROM (
    SELECT id, event, data, created_at FROM public.hook_events
    WHERE workspace_id = ws AND (p_event IS NULL OR event = p_event)
    ORDER BY id DESC LIMIT 20) r), '[]'::json);
END $f$;

-- Inbound event API (scope: events:write). Finds or creates the contact by handle,
-- applies the side effect (tag / unenroll), opens flow runs for matching live flows,
-- and returns everything the worker needs to execute them (same shape as inbound_match).
CREATE OR REPLACE FUNCTION public.api_event_start(
  p_hash text, p_kind text, p_handle text, p_name text, p_channel text, p_key text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  ws uuid; cid uuid; v_ids uuid[]; v_runs json; v_tok text; v_conn uuid;
  cnt integer; v_stopped integer; v_tag text; v_channel text; v_trigger text;
BEGIN
  ws := public.api_auth(p_hash, 'events:write');
  IF ws IS NULL THEN RETURN NULL; END IF;
  IF p_kind NOT IN ('tag-applied','tag-removed','field-changed','enroll','unenroll') THEN
    RETURN json_build_object('error', 'bad_kind'); END IF;
  IF p_handle IS NULL OR char_length(p_handle) > 120 OR btrim(p_handle) = '' THEN
    RETURN json_build_object('error', 'bad_handle'); END IF;
  p_handle := btrim(p_handle);
  IF p_kind IN ('enroll','unenroll') AND (p_key IS NULL OR p_key !~ '^[0-9a-fA-F-]{36}$') THEN
    RETURN json_build_object('error', 'bad_flow'); END IF;
  IF p_kind IN ('tag-applied','tag-removed') AND (p_key IS NULL OR char_length(btrim(p_key)) NOT BETWEEN 1 AND 40) THEN
    RETURN json_build_object('error', 'bad_tag'); END IF;
  IF p_kind = 'field-changed' AND (p_key IS NULL OR p_key !~ '^[\w.\-]{1,30}$') THEN
    RETURN json_build_object('error', 'bad_field'); END IF;

  SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = p_handle LIMIT 1;
  IF cid IS NULL THEN
    IF p_kind = 'unenroll' THEN RETURN json_build_object('error', 'contact_not_found'); END IF;
    IF (SELECT count(*) FROM public.contacts WHERE workspace_id = ws) >= 100 THEN
      RETURN json_build_object('error', 'contact_limit'); END IF;
    v_channel := COALESCE(NULLIF(left(btrim(COALESCE(p_channel, '')), 30), ''),
      CASE WHEN p_handle LIKE 'tg:%' THEN 'telegram' WHEN p_handle LIKE 'web:%' THEN 'web' ELSE 'api' END);
    INSERT INTO public.contacts (workspace_id, name, handle, channel, tags)
    VALUES (ws, left(COALESCE(NULLIF(btrim(COALESCE(p_name, '')), ''), 'API contact'), 80), p_handle, v_channel, ARRAY['api'])
    RETURNING id INTO cid;
  END IF;

  IF p_kind = 'unenroll' THEN
    UPDATE public.flow_runs SET status = 'failed', note = 'unenrolled'
      WHERE flow_id = p_key::uuid AND contact_id = cid AND workspace_id = ws AND status IN ('pending','running');
    GET DIAGNOSTICS v_stopped = ROW_COUNT;
    RETURN json_build_object('ok', true, 'stopped', v_stopped, 'contact_id', cid, 'workspace_id', ws, 'fired', 0);
  END IF;

  v_tag := left(btrim(COALESCE(p_key, '')), 40);
  IF p_kind = 'tag-applied' THEN
    UPDATE public.contacts
      SET tags = (SELECT array_agg(DISTINCT t) FROM unnest(COALESCE(tags, '{}') || ARRAY[v_tag]) AS t)
      WHERE id = cid AND NOT (COALESCE(tags, '{}') @> ARRAY[v_tag]);
  ELSIF p_kind = 'tag-removed' THEN
    UPDATE public.contacts
      SET tags = COALESCE((SELECT array_agg(t) FROM unnest(COALESCE(tags, '{}')) AS t WHERE lower(t) <> lower(v_tag)), '{}')
      WHERE id = cid;
  END IF;

  SELECT count(*) INTO cnt FROM public.flow_runs
    WHERE contact_id = cid AND created_at > now() - interval '1 hour' AND note LIKE 'api-event%';
  IF cnt >= 60 THEN RETURN json_build_object('error', 'rate_limited'); END IF;

  IF p_kind = 'enroll' THEN
    IF EXISTS (SELECT 1 FROM public.flow_runs WHERE flow_id = p_key::uuid AND contact_id = cid AND status IN ('pending','running')) THEN
      RETURN json_build_object('ok', true, 'fired', 0, 'already', true, 'contact_id', cid, 'workspace_id', ws);
    END IF;
    SELECT array_agg(x.id) INTO v_ids FROM (
      SELECT f.id FROM public.flows f
      WHERE f.workspace_id = ws AND f.id = p_key::uuid AND f.status = 'live'
        AND f.nodes -> 0 ->> 't' = 'trigger' LIMIT 1) x;
  ELSE
    v_trigger := lower('event:' || p_kind || ' ' || v_tag);
    SELECT array_agg(x.id) INTO v_ids FROM (
      SELECT f.id FROM public.flows f
      WHERE f.workspace_id = ws AND f.status = 'live'
        AND f.nodes -> 0 ->> 't' = 'trigger'
        AND lower(btrim(regexp_replace(COALESCE(f.nodes -> 0 ->> 'text', ''), '\s+', ' ', 'g'))) = v_trigger
      ORDER BY f.updated_at DESC LIMIT 5) x;
  END IF;

  IF v_ids IS NULL THEN
    RETURN json_build_object('ok', true, 'fired', 0, 'contact_id', cid, 'workspace_id', ws);
  END IF;

  WITH ins AS (
    INSERT INTO public.flow_runs (workspace_id, flow_id, contact_id, next_step, run_at, status, note)
    SELECT ws, id, cid, 1, now(), 'running', 'api-event:' || p_kind FROM unnest(v_ids) AS id
    RETURNING id, flow_id
  )
  SELECT json_agg(json_build_object('run_id', ins.id, 'flow_id', ins.flow_id, 'name', f.name, 'nodes', f.nodes))
    INTO v_runs FROM ins JOIN public.flows f ON f.id = ins.flow_id;

  SELECT id, auth_token INTO v_conn, v_tok FROM public.channel_connections
    WHERE workspace_id = ws AND provider = 'telegram' AND status = 'connected' LIMIT 1;

  RETURN json_build_object(
    'ok', true, 'fired', json_array_length(v_runs),
    'workspace_id', ws, 'contact_id', cid, 'connection_id', v_conn, 'tg_token', v_tok,
    'contact', (SELECT json_build_object('name', c.name, 'handle', c.handle, 'channel', c.channel, 'tags', c.tags, 'fields', c.fields)
                FROM public.contacts c WHERE c.id = cid),
    'runs', COALESCE(v_runs, '[]'::json));
END $f$;

-- Send a Telegram message through the workspace bot to a known contact (scope: messages:write).
-- Returns what the worker needs to deliver and log; the worker performs the send.
CREATE OR REPLACE FUNCTION public.api_message_send(p_hash text, p_handle text, p_text text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; cid uuid; v_conn uuid; v_tok text;
BEGIN
  ws := public.api_auth(p_hash, 'messages:write');
  IF ws IS NULL THEN RETURN NULL; END IF;
  IF p_handle IS NULL OR p_handle !~ '^tg:-?[0-9]{1,20}$' THEN
    RETURN json_build_object('error', 'bad_handle'); END IF;
  IF p_text IS NULL OR char_length(p_text) > 1000 OR btrim(p_text) = '' THEN
    RETURN json_build_object('error', 'bad_text'); END IF;
  SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = p_handle LIMIT 1;
  IF cid IS NULL THEN RETURN json_build_object('error', 'contact_not_found'); END IF;
  SELECT id, auth_token INTO v_conn, v_tok FROM public.channel_connections
    WHERE workspace_id = ws AND provider = 'telegram' AND status = 'connected' LIMIT 1;
  IF v_tok IS NULL THEN RETURN json_build_object('error', 'not_connected'); END IF;
  RETURN json_build_object('connection_id', v_conn, 'chat_id', substring(p_handle from 4), 'tg_token', v_tok, 'workspace_id', ws);
END $f$;

-- Same behavior as 20261201_public_api.sql, but the created contact carries
-- workspace_id so the worker can emit the contact.created webhook.
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
  RETURNING id, workspace_id, name, handle, channel, tags, fields, created_at INTO r;
  RETURN json_build_object('data', row_to_json(r));
END $f$;

REVOKE ALL ON FUNCTION public.hook_emit(text, uuid, text, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.hook_report(text, uuid, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.hook_ws_lookup(text, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_hooks_list(text) FROM public;
REVOKE ALL ON FUNCTION public.api_hook_create(text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.api_hook_delete(text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.api_hook_samples(text, text) FROM public;
REVOKE ALL ON FUNCTION public.api_event_start(text, text, text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.api_message_send(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.hook_emit(text, uuid, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_report(text, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_ws_lookup(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_hooks_list(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_hook_create(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_hook_delete(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_hook_samples(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_event_start(text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_message_send(text, text, text) TO anon, authenticated;

COMMIT;
