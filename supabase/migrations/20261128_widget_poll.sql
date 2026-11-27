-- Human takeover for the website chat widget.
-- widget_poll lets the public widget endpoint (anon key, strict key+visitor
-- scoping) read the conversation status and any pending human replies for one
-- web-chat conversation. Applied after 20261127_widget.sql.

CREATE OR REPLACE FUNCTION public.widget_poll(p_key text, p_visitor text, p_since timestamptz DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; vid uuid; st text;
BEGIN
  IF p_visitor !~ '^[a-z0-9]{8,32}$' THEN RETURN NULL; END IF;
  SELECT workspace_id INTO ws FROM public.widget_keys WHERE key = p_key AND active;
  IF ws IS NULL THEN RETURN NULL; END IF;
  SELECT c.id, c.status INTO vid, st FROM public.conversations c
    JOIN public.contacts t ON t.id = c.contact_id
    WHERE c.workspace_id = ws AND c.channel = 'web' AND t.handle = 'web:' || p_visitor
    ORDER BY c.last_at DESC LIMIT 1;
  IF vid IS NULL THEN RETURN json_build_object('status', 'ai', 'messages', '[]'::json); END IF;
  RETURN json_build_object(
    'status', st,
    'messages', COALESCE((
      SELECT json_agg(json_build_object('body', left(m.body, 1200), 'created_at', m.created_at) ORDER BY m.created_at)
      FROM (SELECT body, created_at FROM public.messages
            WHERE conversation_id = vid AND direction = 'out' AND author = 'human'
              AND created_at > COALESCE(p_since, now() - interval '1 hour')
              AND created_at > now() - interval '24 hours'
            ORDER BY created_at LIMIT 20) m), '[]'::json));
END $f$;

REVOKE ALL ON FUNCTION public.widget_poll(text, text, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.widget_poll(text, text, timestamptz) TO anon, authenticated;
