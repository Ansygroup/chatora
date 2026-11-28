-- Chatora: WhatsApp channel through a self-hosted OpenWA gateway (unofficial,
-- reverse-engineered WhatsApp Web clients; NOT Meta's Cloud API).
-- Additive and reversible. Roll back with:
--   ALTER TABLE public.channel_connections DROP CONSTRAINT IF EXISTS channel_connections_provider_check;
--   ALTER TABLE public.channel_connections ADD CONSTRAINT channel_connections_provider_check
--     CHECK (provider IN ('whatsapp_cloud', 'instagram_messenger', 'telegram', 'email', 'whatsapp', 'instagram', 'messenger'));
--   DROP FUNCTION IF EXISTS public.wa_conn_json(uuid);
--   DROP FUNCTION IF EXISTS public.wa_hook_ctx(text, uuid);
--   DROP FUNCTION IF EXISTS public.wa_log(uuid, text, text, text, text);
--   DROP FUNCTION IF EXISTS public.wa_log_out(text, uuid, text, text);
--   DROP FUNCTION IF EXISTS public.wa_ai_ctx(text, uuid, text);
--   (and re-apply the 20261127/20261129/20261130/20261202 versions of the replaced functions)
--
-- Model: the user runs OpenWA (github.com/rmyndharis/OpenWA, MIT) on their own host,
-- reachable over HTTPS. The worker validates the gateway, stores URL + API key +
-- session on channel_connections (provider 'whatsapp_openwa'), registers an
-- HMAC-signed OpenWA webhook pointing at /api/openwa/hook/<connection id>, and
-- verifies X-OpenWA-Signature on every delivery. Inbound texts become contacts
-- with handle 'wa:<digits>' on channel 'whatsapp_openwa' and flow through the same
-- inbound_match / automation_tick / broadcast machinery as Telegram; outbound
-- sends go to the gateway's send-text endpoint from the worker.

BEGIN;

-- 1. Allow the OpenWA provider on channel_connections.
ALTER TABLE public.channel_connections DROP CONSTRAINT IF EXISTS channel_connections_provider_check;
ALTER TABLE public.channel_connections
  ADD CONSTRAINT channel_connections_provider_check
  CHECK (provider IN ('whatsapp_cloud', 'instagram_messenger', 'telegram', 'email', 'whatsapp', 'instagram', 'messenger', 'whatsapp_openwa'));

-- 2. Shared lookup of the workspace's connected OpenWA gateway. Internal only:
-- EXECUTE is revoked below; security-definer callers run as the owner and keep
-- access. Returns NULL unless a connected connection with a stored HTTPS base
-- URL and API key exists.
CREATE OR REPLACE FUNCTION public.wa_conn_json(p_ws uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE r record;
BEGIN
  SELECT cc.id, cc.external_account_id, cc.auth_token, cc.connection_metadata ->> 'base_url' AS base_url
    INTO r FROM public.channel_connections cc
   WHERE cc.workspace_id = p_ws AND cc.provider = 'whatsapp_openwa' AND cc.status = 'connected'
   ORDER BY cc.created_at LIMIT 1;
  IF r.id IS NULL OR r.auth_token IS NULL OR r.base_url IS NULL OR r.base_url !~ '^https://[A-Za-z0-9.-]+' THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('conn_id', r.id, 'base', rtrim(r.base_url, '/'), 'key', r.auth_token, 'session', r.external_account_id);
END $f$;

-- 3. Webhook handler context (AUTOMATION_SECRET-gated): the HMAC signing secret
-- plus send credentials for one connection.
CREATE OR REPLACE FUNCTION public.wa_hook_ctx(p_key text, p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE r record;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT cc.workspace_id,
         cc.connection_metadata ->> 'webhook_secret' AS secret
    INTO r FROM public.channel_connections cc
   WHERE cc.id = p_id AND cc.provider = 'whatsapp_openwa' AND cc.status = 'connected';
  IF r.workspace_id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('workspace_id', r.workspace_id, 'secret', r.secret);
END $f$;

-- 4. Inbound message writer (mirrors tg_log for the web channel).
CREATE OR REPLACE FUNCTION public.wa_log(p_id uuid, p_msg text, p_chat text, p_name text, p_text text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; cid uuid; vid uuid;
BEGIN
  IF p_chat !~ '^[0-9]{5,20}$' THEN RETURN; END IF;
  SELECT workspace_id INTO ws FROM public.channel_connections
    WHERE id = p_id AND provider = 'whatsapp_openwa' AND status = 'connected';
  IF ws IS NULL THEN RETURN; END IF;
  -- The provider columns are nulled by chatora_guard_provider_columns for
  -- anon/authenticated writes (only service_role may set them), so dedupe cannot
  -- rely on provider_message_id. OpenWA redelivers only after a receiver failure,
  -- so a short body+conversation window is the practical idempotency guard.
  IF p_msg IS NOT NULL AND p_msg <> '' AND EXISTS (
    SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
    WHERE c.workspace_id = ws AND c.channel = 'whatsapp_openwa' AND m.direction = 'in'
      AND m.body = left(p_text, 4000) AND m.created_at > now() - interval '2 minutes'
  ) THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.workspace_id = ws AND c.channel = 'whatsapp_openwa' AND m.created_at > now() - interval '1 hour') > 400 THEN RETURN; END IF;
  SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = 'wa:' || p_chat LIMIT 1;
  IF cid IS NULL THEN
    INSERT INTO public.contacts (workspace_id, name, handle, channel, tags, external_id)
    VALUES (ws, left(coalesce(nullif(p_name, ''), 'WhatsApp user'), 80), 'wa:' || p_chat, 'whatsapp_openwa', ARRAY['whatsapp'], p_chat)
    RETURNING id INTO cid;
  ELSE
    UPDATE public.contacts SET last_seen = now() WHERE id = cid;
  END IF;
  SELECT id INTO vid FROM public.conversations
    WHERE workspace_id = ws AND contact_id = cid AND channel = 'whatsapp_openwa' ORDER BY last_at DESC LIMIT 1;
  IF vid IS NULL THEN
    INSERT INTO public.conversations (workspace_id, contact_id, channel, status, unread)
    VALUES (ws, cid, 'whatsapp_openwa', 'ai', 0) RETURNING id INTO vid;
  END IF;
  INSERT INTO public.messages (conversation_id, direction, author, body, provider, provider_message_id)
  VALUES (vid, 'in', 'contact', left(p_text, 4000), 'whatsapp', left(p_msg, 40));
  UPDATE public.conversations SET last_at = now(), last_inbound_at = now(), unread = unread + 1 WHERE id = vid;
END $f$;
-- 5. Outbound message log (mirrors tg_log_out).
CREATE OR REPLACE FUNCTION public.wa_log_out(p_key text, p_id uuid, p_chat text, p_text text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; vid uuid;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_chat !~ '^[0-9]{5,20}$' OR coalesce(p_text, '') = '' THEN RETURN; END IF;
  SELECT workspace_id INTO ws FROM public.channel_connections WHERE id = p_id AND provider = 'whatsapp_openwa' AND status = 'connected';
  IF ws IS NULL THEN RETURN; END IF;
  SELECT c.id INTO vid FROM public.conversations c JOIN public.contacts t ON t.id = c.contact_id
    WHERE c.workspace_id = ws AND c.channel = 'whatsapp_openwa' AND t.handle = 'wa:' || p_chat ORDER BY c.last_at DESC LIMIT 1;
  IF vid IS NULL THEN RETURN; END IF;
  INSERT INTO public.messages (conversation_id, direction, author, body, provider) VALUES (vid, 'out', 'ai', left(p_text, 1200), 'whatsapp');
  UPDATE public.conversations SET last_at = now() WHERE id = vid;
END $f$;
-- 6. AI reply context (mirrors tg_ai_ctx).
CREATE OR REPLACE FUNCTION public.wa_ai_ctx(p_key text, p_id uuid, p_chat text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; wname text; st text; know jsonb;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_chat !~ '^[0-9]{5,20}$' THEN RETURN NULL; END IF;
  SELECT cc.workspace_id INTO ws FROM public.channel_connections cc
    WHERE cc.id = p_id AND cc.provider = 'whatsapp_openwa' AND cc.status = 'connected';
  IF ws IS NULL THEN RETURN NULL; END IF;
  SELECT w.name INTO wname FROM public.workspaces w WHERE w.id = ws;
  SELECT c.status INTO st FROM public.conversations c JOIN public.contacts t ON t.id = c.contact_id
    WHERE c.workspace_id = ws AND c.channel = 'whatsapp_openwa' AND t.handle = 'wa:' || p_chat ORDER BY c.last_at DESC LIMIT 1;
  IF coalesce(st, 'ai') IN ('human', 'closed') THEN RETURN jsonb_build_object('skip', true); END IF;
  IF (SELECT count(*) FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.workspace_id = ws AND c.channel = 'whatsapp_openwa' AND m.author = 'ai' AND m.created_at > now() - interval '1 hour') > 200 THEN
    RETURN jsonb_build_object('skip', true);
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', left(NULLIF(i.title, ''), 120), 'steps', jsonb_build_array(left(i.body, 1200)))), '[]'::jsonb)
    INTO know FROM (SELECT * FROM public.knowledge_items WHERE workspace_id = ws ORDER BY created_at LIMIT 20) i;
  know := know || coalesce((SELECT jsonb_agg(jsonb_build_object('name', left(f.name, 120), 'steps', (
      SELECT coalesce(jsonb_agg(left(n->>'text', 300)), '[]'::jsonb)
      FROM (SELECT n FROM jsonb_array_elements(f.nodes) n WHERE coalesce(n->>'text','') <> '' LIMIT 12) s)))
    FROM (SELECT * FROM public.flows WHERE workspace_id = ws ORDER BY updated_at DESC LIMIT 10) f), '[]'::jsonb);
  RETURN jsonb_build_object('workspace', wname, 'wa_conn', public.wa_conn_json(ws), 'knowledge', know);
END $f$;
-- 7. automation_tick: due runs now also carry the OpenWA credentials.
CREATE OR REPLACE FUNCTION public.automation_tick(p_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_runs jsonb;
  v_sched jsonb;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- reset runs stuck in running for over 10 minutes so they retry once
  UPDATE public.flow_runs SET status = 'pending'
  WHERE status = 'running' AND run_at < now() - interval '10 minutes';

  WITH due AS (
    SELECT id FROM public.flow_runs
    WHERE status = 'pending' AND run_at <= now()
    ORDER BY run_at LIMIT 20 FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.flow_runs r SET status = 'running' FROM due WHERE r.id = due.id
    RETURNING r.id, r.flow_id, r.contact_id, r.next_step, r.workspace_id, r.note
  )
  SELECT jsonb_agg(jsonb_build_object(
    'run_id', u.id, 'flow_id', u.flow_id, 'contact_id', u.contact_id,
    'next_step', u.next_step, 'workspace_id', u.workspace_id, 'note', u.note,
    'nodes', f.nodes,
    'contact', jsonb_build_object('name', c.name, 'handle', c.handle, 'channel', c.channel, 'tags', c.tags, 'fields', c.fields),
    'tg_token', (SELECT cc.auth_token FROM public.channel_connections cc
                 WHERE cc.workspace_id = u.workspace_id AND cc.provider = 'telegram' AND cc.status = 'connected' LIMIT 1),
    'wa_conn', public.wa_conn_json(u.workspace_id)
  )) INTO v_runs
  FROM upd u
  JOIN public.flows f ON f.id = u.flow_id
  JOIN public.contacts c ON c.id = u.contact_id;

  -- schedule triggers: live flows whose trigger is "event:schedule field:KEY"
  WITH sf AS (
    SELECT f.id AS flow_id, f.workspace_id, f.nodes,
           substring(f.nodes -> 0 ->> 'text' from 'field:([A-Za-z0-9_.-]+)$') AS field_key
    FROM public.flows f
    WHERE f.status = 'live'
      AND f.nodes -> 0 ->> 't' = 'trigger'
      AND f.nodes -> 0 ->> 'text' ~ '^event:schedule\s+field:[A-Za-z0-9_.-]{1,30}$'
  ), due_contacts AS (
    SELECT sf.flow_id, sf.workspace_id, c.id AS contact_id
    FROM sf
    JOIN public.contacts c ON c.workspace_id = sf.workspace_id
    WHERE (c.fields ->> sf.field_key) ~ '^\d{4}-\d{2}-\d{2}'
      AND (c.fields ->> sf.field_key)::timestamptz <= now()
      AND NOT EXISTS (
        SELECT 1 FROM public.flow_runs r
        WHERE r.flow_id = sf.flow_id AND r.contact_id = c.id AND r.note = 'schedule'
          AND r.status IN ('pending','running','done')
      )
    LIMIT 20
  ), ins AS (
    INSERT INTO public.flow_runs (workspace_id, flow_id, contact_id, next_step, run_at, status, note)
    SELECT workspace_id, flow_id, contact_id, 1, now(), 'running', 'schedule' FROM due_contacts
    RETURNING id, flow_id, contact_id, workspace_id
  )
  SELECT jsonb_agg(jsonb_build_object(
    'run_id', i.id, 'flow_id', i.flow_id, 'contact_id', i.contact_id,
    'next_step', 1, 'workspace_id', i.workspace_id, 'note', 'schedule',
    'nodes', f.nodes,
    'contact', jsonb_build_object('name', c.name, 'handle', c.handle, 'channel', c.channel, 'tags', c.tags, 'fields', c.fields),
    'tg_token', (SELECT cc.auth_token FROM public.channel_connections cc
                 WHERE cc.workspace_id = i.workspace_id AND cc.provider = 'telegram' AND cc.status = 'connected' LIMIT 1),
    'wa_conn', public.wa_conn_json(i.workspace_id)
  )) INTO v_sched
  FROM ins i
  JOIN public.flows f ON f.id = i.flow_id
  JOIN public.contacts c ON c.id = i.contact_id;

  RETURN jsonb_build_object('runs', COALESCE(v_runs, '[]'::jsonb), 'scheduled', COALESCE(v_sched, '[]'::jsonb));
END;
$$;
-- 8. inbound_match: new whatsapp scope (connection id + phone digits).
CREATE OR REPLACE FUNCTION public.inbound_match(p_key text, p_scope text, p_ref text, p_visitor text, p_update text, p_text text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  ws uuid; cid uuid; v_prov text; t text; v_tok text; v_note text; v_ids uuid[]; v_runs jsonb; cnt integer;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  t := lower(btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')));
  IF t = '' OR length(t) > 300 THEN RETURN NULL; END IF;
  IF p_scope = 'telegram' THEN
    IF p_ref !~ '^[0-9a-f-]{36}$' OR p_visitor !~ '^-?[0-9]{1,20}$' THEN RETURN NULL; END IF;
    SELECT workspace_id, auth_token INTO ws, v_tok FROM public.channel_connections
      WHERE id = p_ref::uuid AND provider = 'telegram' AND status = 'connected';
    IF ws IS NULL THEN RETURN NULL; END IF;
    SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = 'tg:' || p_visitor LIMIT 1;
  ELSIF p_scope = 'meta' THEN
    IF p_ref !~ '^[0-9a-f-]{36}$' OR p_visitor !~ '^[A-Za-z0-9_.:-]{1,64}$' THEN RETURN NULL; END IF;
    SELECT workspace_id, provider INTO ws, v_prov FROM public.channel_connections
      WHERE id = p_ref::uuid AND provider IN ('whatsapp', 'instagram', 'messenger') AND status = 'connected';
    IF ws IS NULL THEN RETURN NULL; END IF;
    SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws
      AND handle = CASE v_prov WHEN 'whatsapp' THEN 'wa:' WHEN 'instagram' THEN 'ig:' ELSE 'ms:' END || p_visitor LIMIT 1;
  ELSIF p_scope = 'whatsapp' THEN
    IF p_ref !~ '^[0-9a-f-]{36}$' OR p_visitor !~ '^[0-9]{5,20}$' THEN RETURN NULL; END IF;
    SELECT workspace_id INTO ws FROM public.channel_connections
      WHERE id = p_ref::uuid AND provider = 'whatsapp_openwa' AND status = 'connected';
    IF ws IS NULL THEN RETURN NULL; END IF;
    SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = 'wa:' || p_visitor LIMIT 1;
  ELSIF p_scope = 'web' THEN
    IF p_visitor !~ '^[a-z0-9]{8,32}$' THEN RETURN NULL; END IF;
    SELECT workspace_id INTO ws FROM public.widget_keys WHERE key = p_ref AND active;
    IF ws IS NULL THEN RETURN NULL; END IF;
    SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = 'web:' || p_visitor LIMIT 1;
  ELSE
    RETURN NULL;
  END IF;

  v_note := 'inbound' || CASE WHEN coalesce(p_update, '') <> '' THEN ':' || left(p_update, 30) ELSE '' END;
  IF cid IS NOT NULL THEN
    SELECT count(*) INTO cnt FROM public.flow_runs
      WHERE contact_id = cid AND created_at > now() - interval '1 hour' AND note LIKE 'inbound%';
    IF cnt >= 20 THEN RETURN NULL; END IF;
  END IF;

  SELECT array_agg(x.id) INTO v_ids FROM (
    SELECT f.id FROM public.flows f
    WHERE f.workspace_id = ws AND f.status = 'live' AND f.nodes -> 0 ->> 't' = 'trigger'
      AND lower(btrim(coalesce(f.nodes -> 0 ->> 'text', ''))) <> ''
      AND lower(btrim(f.nodes -> 0 ->> 'text')) !~ '^event:'
      AND (
        t = lower(btrim(f.nodes -> 0 ->> 'text'))
        OR (lower(btrim(f.nodes -> 0 ->> 'text')) = '/start' AND t ~ '^/start(@[a-z0-9_]+)?( |$)')
        OR (lower(btrim(f.nodes -> 0 ->> 'text')) ~ '^(keyword|kw|contains):\s*\S'
            AND position(btrim(substr(lower(btrim(f.nodes -> 0 ->> 'text')), position(':' in lower(btrim(f.nodes -> 0 ->> 'text'))) + 1)) in t) > 0)
        OR (lower(btrim(f.nodes -> 0 ->> 'text')) ~ '^exact:\s*\S'
            AND t = btrim(substr(lower(btrim(f.nodes -> 0 ->> 'text')), 7)))
      )
      AND NOT (cid IS NOT NULL AND coalesce(p_update, '') <> '' AND EXISTS (
        SELECT 1 FROM public.flow_runs r WHERE r.flow_id = f.id AND r.contact_id = cid AND r.note = v_note))
    ORDER BY f.updated_at DESC LIMIT 3
  ) x;
  IF v_ids IS NULL THEN RETURN NULL; END IF;

  IF cid IS NULL THEN
    IF p_scope = 'web' THEN
      INSERT INTO public.contacts (workspace_id, name, handle, channel, tags)
      VALUES (ws, 'Web visitor ' || left(p_visitor, 4), 'web:' || p_visitor, 'web', ARRAY['web-chat']) RETURNING id INTO cid;
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  WITH ins AS (
    INSERT INTO public.flow_runs (workspace_id, flow_id, contact_id, next_step, run_at, status, note)
    SELECT ws, id, cid, 1, now(), 'running', v_note FROM unnest(v_ids) AS id
    RETURNING id, flow_id
  )
  SELECT jsonb_agg(jsonb_build_object('run_id', ins.id, 'flow_id', ins.flow_id, 'nodes', f.nodes))
    INTO v_runs FROM ins JOIN public.flows f ON f.id = ins.flow_id;

  RETURN jsonb_build_object(
    'workspace_id', ws, 'contact_id', cid,
    'tg_token', CASE WHEN p_scope = 'telegram' THEN v_tok ELSE NULL END,
    'wa_conn', CASE WHEN p_scope = 'whatsapp' THEN public.wa_conn_json(ws) ELSE NULL END,
    'contact', (SELECT jsonb_build_object('name', c.name, 'handle', c.handle, 'channel', c.channel, 'tags', c.tags, 'fields', c.fields)
                FROM public.contacts c WHERE c.id = cid),
    'runs', coalesce(v_runs, '[]'::jsonb));
END $f$;
-- 9. inbound_unsub: new whatsapp scope.
CREATE OR REPLACE FUNCTION public.inbound_unsub(p_key text, p_scope text, p_ref text, p_visitor text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  ws uuid; cid uuid; v_tok text;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_scope = 'telegram' THEN
    IF p_ref !~ '^[0-9a-f-]{36}$' OR p_visitor !~ '^-?[0-9]{1,20}$' THEN RETURN NULL; END IF;
    SELECT workspace_id, auth_token INTO ws, v_tok FROM public.channel_connections
      WHERE id = p_ref::uuid AND provider = 'telegram' AND status = 'connected';
    IF ws IS NULL THEN RETURN NULL; END IF;
    SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = 'tg:' || p_visitor LIMIT 1;
  ELSIF p_scope = 'whatsapp' THEN
    IF p_ref !~ '^[0-9a-f-]{36}$' OR p_visitor !~ '^[0-9]{5,20}$' THEN RETURN NULL; END IF;
    SELECT workspace_id INTO ws FROM public.channel_connections
      WHERE id = p_ref::uuid AND provider = 'whatsapp_openwa' AND status = 'connected';
    IF ws IS NULL THEN RETURN NULL; END IF;
    SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = 'wa:' || p_visitor LIMIT 1;
  ELSIF p_scope = 'web' THEN
    IF p_visitor !~ '^[a-z0-9]{8,32}$' THEN RETURN NULL; END IF;
    SELECT workspace_id INTO ws FROM public.widget_keys WHERE key = p_ref AND active;
    IF ws IS NULL THEN RETURN NULL; END IF;
    SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = 'web:' || p_visitor LIMIT 1;
  ELSE
    RETURN NULL;
  END IF;
  IF cid IS NULL THEN RETURN jsonb_build_object('ok', true, 'tg_token', v_tok, 'wa_conn', CASE WHEN p_scope = 'whatsapp' THEN public.wa_conn_json(ws) ELSE NULL END); END IF;
  UPDATE public.contacts SET tags = array_append(tags, 'unsubscribed')
    WHERE id = cid AND NOT (lower('unsubscribed') = ANY (SELECT lower(x) FROM unnest(tags) x));
  RETURN jsonb_build_object('ok', true, 'tg_token', v_tok, 'wa_conn', CASE WHEN p_scope = 'whatsapp' THEN public.wa_conn_json(ws) ELSE NULL END);
END
$f$;
-- 10. api_event_start: results now also carry the OpenWA credentials.
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
    'workspace_id', ws, 'contact_id', cid, 'connection_id', v_conn, 'tg_token', v_tok, 'wa_conn', public.wa_conn_json(ws),
    'contact', (SELECT json_build_object('name', c.name, 'handle', c.handle, 'channel', c.channel, 'tags', c.tags, 'fields', c.fields)
                FROM public.contacts c WHERE c.id = cid),
    'runs', COALESCE(v_runs, '[]'::json));
END $f$;
-- 11. hook_ws_lookup: new whatsapp scope.
CREATE OR REPLACE FUNCTION public.hook_ws_lookup(p_key text, p_scope text, p_ref text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_scope = 'telegram' AND p_ref ~ '^[0-9a-f-]{36}$' THEN
    SELECT workspace_id INTO ws FROM public.channel_connections WHERE id = p_ref::uuid AND provider = 'telegram';
  ELSIF p_scope = 'whatsapp' AND p_ref ~ '^[0-9a-f-]{36}$' THEN
    SELECT workspace_id INTO ws FROM public.channel_connections WHERE id = p_ref::uuid AND provider = 'whatsapp_openwa';
  ELSIF p_scope = 'web' AND p_ref ~ '^ck_[a-f0-9]{32}$' THEN
    SELECT workspace_id INTO ws FROM public.widget_keys WHERE key = p_ref;
  END IF;
  RETURN ws;
END $f$;
-- 12. api_message_send: wa: handles send through the OpenWA gateway.
-- Message send now also covers WhatsApp contacts (wa:<digits> handles) through the
-- workspace's connected OpenWA gateway. Telegram behavior is unchanged.
CREATE OR REPLACE FUNCTION public.api_message_send(p_hash text, p_handle text, p_text text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; cid uuid; v_conn uuid; v_tok text; v_wa jsonb;
BEGIN
  ws := public.api_auth(p_hash, 'messages:write');
  IF ws IS NULL THEN RETURN NULL; END IF;
  IF p_text IS NULL OR char_length(p_text) > 1000 OR btrim(p_text) = '' THEN
    RETURN json_build_object('error', 'bad_text'); END IF;
  IF p_handle IS NULL OR (p_handle !~ '^tg:-?[0-9]{1,20}$' AND p_handle !~ '^wa:[0-9]{5,20}$') THEN
    RETURN json_build_object('error', 'bad_handle'); END IF;
  SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = p_handle LIMIT 1;
  IF cid IS NULL THEN RETURN json_build_object('error', 'contact_not_found'); END IF;
  IF p_handle LIKE 'wa:%' THEN
    v_wa := public.wa_conn_json(ws);
    IF v_wa IS NULL THEN RETURN json_build_object('error', 'not_connected'); END IF;
    RETURN json_build_object('channel', 'whatsapp_openwa', 'connection_id', (v_wa ->> 'conn_id')::uuid,
      'chat_id', substring(p_handle from 4), 'wa_conn', v_wa, 'workspace_id', ws);
  END IF;
  SELECT id, auth_token INTO v_conn, v_tok FROM public.channel_connections
    WHERE workspace_id = ws AND provider = 'telegram' AND status = 'connected' LIMIT 1;
  IF v_tok IS NULL THEN RETURN json_build_object('error', 'not_connected'); END IF;
  RETURN json_build_object('channel', 'telegram', 'connection_id', v_conn, 'chat_id', substring(p_handle from 4), 'tg_token', v_tok, 'workspace_id', ws);
END $f$;

REVOKE ALL ON FUNCTION public.wa_conn_json(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wa_hook_ctx(text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.wa_log(uuid, text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.wa_log_out(text, uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.wa_ai_ctx(text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.wa_hook_ctx(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_log(uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_log_out(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_ai_ctx(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_tick(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbound_match(text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbound_unsub(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_event_start(text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_message_send(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_ws_lookup(text, text, text) TO anon, authenticated;

COMMIT;
