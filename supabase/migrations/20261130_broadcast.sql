-- Chatora Phase 2 item 8: STOP / unsubscribe for broadcasts.
-- Additive and reversible: DROP FUNCTION public.inbound_unsub(text,text,text,text);
-- Adds the tag 'unsubscribed' to the contact that sent STOP. Broadcasts skip that tag.
-- Callable only with the AUTOMATION_SECRET (same check as inbound_match).
BEGIN;

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
  ELSIF p_scope = 'web' THEN
    IF p_visitor !~ '^[a-z0-9]{8,32}$' THEN RETURN NULL; END IF;
    SELECT workspace_id INTO ws FROM public.widget_keys WHERE key = p_ref AND active;
    IF ws IS NULL THEN RETURN NULL; END IF;
    SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = 'web:' || p_visitor LIMIT 1;
  ELSE
    RETURN NULL;
  END IF;
  IF cid IS NULL THEN RETURN jsonb_build_object('ok', true, 'tg_token', v_tok); END IF;
  UPDATE public.contacts SET tags = array_append(tags, 'unsubscribed')
    WHERE id = cid AND NOT (lower('unsubscribed') = ANY (SELECT lower(x) FROM unnest(tags) x));
  RETURN jsonb_build_object('ok', true, 'tg_token', v_tok);
END
$f$;
REVOKE ALL ON FUNCTION public.inbound_unsub(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbound_unsub(text,text,text,text) TO anon;

COMMIT;
