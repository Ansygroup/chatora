-- Chatora Phase 2 item 4b: inbound keyword and /start matching.
-- Additive: one new function, no table changes. Roll back with:
--   DROP FUNCTION IF EXISTS public.inbound_match(text, text, text, text, text, text);
-- Called by the Cloudflare worker (anon key + AUTOMATION_SECRET, since it returns the bot token) after an inbound Telegram or web-widget message.
-- Finds live flows whose trigger matches the text, opens one flow_run per match and
-- returns what the worker needs to execute them. Execution results go back through
-- automation_finish (secret-protected), same as the cron path.
--
-- Trigger text rules (case-insensitive, trimmed):
--   "/start"                 matches /start and /start <payload>
--   "keyword: x" / "kw: x" / "contains: x"   message contains x
--   "exact: x"               message equals x
--   anything else (not "event:...")           message equals the trigger text
BEGIN;

CREATE OR REPLACE FUNCTION public.inbound_match(p_key text, p_scope text, p_ref text, p_visitor text, p_update text, p_text text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  ws uuid; cid uuid; t text; v_tok text; v_note text; v_ids uuid[]; v_runs jsonb; cnt integer;
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

COMMIT;
