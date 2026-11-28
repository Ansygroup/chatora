-- 20261205_meta_flows.sql
-- Flow keyword triggers, sequences, delayed steps and unsubscribe on the Meta channels.
-- Additive: widens inbound_match with a 'meta' scope and adds two helper functions.
-- Rollback: re-run 20261129_inbound_match.sql and drop meta_flow_conn, meta_unsub.
BEGIN;

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
    'contact', (SELECT jsonb_build_object('name', c.name, 'handle', c.handle, 'channel', c.channel, 'tags', c.tags, 'fields', c.fields)
                FROM public.contacts c WHERE c.id = cid),
    'runs', coalesce(v_runs, '[]'::jsonb));
END $f$;

REVOKE ALL ON FUNCTION public.inbound_match(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.inbound_match(text, text, text, text, text, text) TO anon, authenticated;

-- Connection for a workspace and provider plus the contact's last inbound time (for the 24h window check).
CREATE OR REPLACE FUNCTION public.meta_flow_conn(p_key text, p_ws uuid, p_provider text, p_handle text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_provider NOT IN ('whatsapp', 'instagram', 'messenger') THEN RETURN NULL; END IF;
  RETURN (SELECT jsonb_build_object('id', cc.id, 'provider', cc.provider, 'account', cc.external_account_id, 'token', cc.auth_token,
            'test_mode', cc.test_mode,
            'last_inbound_at', (SELECT max(v.last_inbound_at) FROM public.conversations v JOIN public.contacts t ON t.id = v.contact_id
                                WHERE v.workspace_id = p_ws AND v.channel = p_provider AND t.handle = p_handle))
          FROM public.channel_connections cc
          WHERE cc.workspace_id = p_ws AND cc.provider = p_provider AND cc.status = 'connected' ORDER BY cc.created_at LIMIT 1);
END $f$;
REVOKE ALL ON FUNCTION public.meta_flow_conn(text, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.meta_flow_conn(text, uuid, text, text) TO anon, authenticated;

-- STOP on a Meta channel: tag the contact unsubscribed so broadcasts skip them.
CREATE OR REPLACE FUNCTION public.meta_unsub(p_key text, p_id uuid, p_user text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; prov text; n int;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT workspace_id, provider INTO ws, prov FROM public.channel_connections
    WHERE id = p_id AND provider IN ('whatsapp', 'instagram', 'messenger') AND status = 'connected';
  IF ws IS NULL OR p_user !~ '^[A-Za-z0-9_.:-]{1,64}$' THEN RETURN false; END IF;
  UPDATE public.contacts SET tags = array_append(tags, 'unsubscribed')
    WHERE workspace_id = ws AND handle = CASE prov WHEN 'whatsapp' THEN 'wa:' WHEN 'instagram' THEN 'ig:' ELSE 'ms:' END || p_user
      AND NOT ('unsubscribed' = ANY(coalesce(tags, '{}')));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $f$;
REVOKE ALL ON FUNCTION public.meta_unsub(text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.meta_unsub(text, uuid, text) TO anon, authenticated;

COMMIT;
notify pgrst, 'reload schema';
