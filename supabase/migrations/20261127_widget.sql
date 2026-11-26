CREATE TABLE IF NOT EXISTS public.widget_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE DEFAULT ('ck_' || replace(gen_random_uuid()::text, '-', '')),
  name text NOT NULL DEFAULT 'Website',
  greeting text NOT NULL DEFAULT 'Hi! How can we help?',
  allowed_origin text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT widget_keys_len CHECK (char_length(name) <= 80 AND char_length(greeting) <= 300 AND (allowed_origin IS NULL OR char_length(allowed_origin) <= 200))
);
CREATE INDEX IF NOT EXISTS widget_keys_ws_idx ON public.widget_keys (workspace_id);
ALTER TABLE public.widget_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS widget_keys_own ON public.widget_keys;
CREATE POLICY widget_keys_own ON public.widget_keys FOR ALL TO anon, authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')));
CREATE OR REPLACE FUNCTION public.widget_keys_limit() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF (SELECT count(*) FROM public.widget_keys WHERE workspace_id = new.workspace_id) >= 5 THEN
    RAISE EXCEPTION 'widget key limit reached' USING errcode = 'check_violation';
  END IF;
  RETURN new;
END $f$;
DROP TRIGGER IF EXISTS widget_keys_limit_trg ON public.widget_keys;
CREATE TRIGGER widget_keys_limit_trg BEFORE INSERT ON public.widget_keys FOR EACH ROW EXECUTE FUNCTION public.widget_keys_limit();

CREATE OR REPLACE FUNCTION public.widget_config(p_key text) RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $f$
  SELECT json_build_object(
    'workspace', w.name,
    'greeting', k.greeting,
    'allowed_origin', k.allowed_origin,
    'knowledge', COALESCE((
      SELECT json_agg(json_build_object('name', left(f.name, 120), 'steps', (
        SELECT COALESCE(json_agg(left(n->>'text', 300)), '[]'::json)
        FROM (SELECT n FROM jsonb_array_elements(f.nodes) n WHERE coalesce(n->>'text','') <> '' LIMIT 12) s)))
      FROM (SELECT * FROM public.flows WHERE workspace_id = w.id ORDER BY updated_at DESC LIMIT 10) f), '[]'::json))
  FROM public.widget_keys k JOIN public.workspaces w ON w.id = k.workspace_id
  WHERE k.key = p_key AND k.active
$f$;

CREATE OR REPLACE FUNCTION public.widget_log(p_key text, p_visitor text, p_in text, p_out text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; cid uuid; vid uuid;
BEGIN
  IF p_visitor !~ '^[a-z0-9]{8,32}$' THEN RETURN; END IF;
  SELECT workspace_id INTO ws FROM public.widget_keys WHERE key = p_key AND active;
  IF ws IS NULL THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.workspace_id = ws AND c.channel = 'web' AND m.created_at > now() - interval '1 hour') > 400 THEN RETURN; END IF;
  SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = 'web:' || p_visitor LIMIT 1;
  IF cid IS NULL THEN
    INSERT INTO public.contacts (workspace_id, name, handle, channel, tags)
    VALUES (ws, 'Web visitor ' || left(p_visitor, 4), 'web:' || p_visitor, 'web', ARRAY['web-chat']) RETURNING id INTO cid;
  ELSE
    UPDATE public.contacts SET last_seen = now() WHERE id = cid;
  END IF;
  SELECT id INTO vid FROM public.conversations WHERE workspace_id = ws AND contact_id = cid AND channel = 'web' ORDER BY last_at DESC LIMIT 1;
  IF vid IS NULL THEN
    INSERT INTO public.conversations (workspace_id, contact_id, channel, status, unread) VALUES (ws, cid, 'web', 'ai', 0) RETURNING id INTO vid;
  END IF;
  INSERT INTO public.messages (conversation_id, direction, author, body) VALUES (vid, 'in', 'contact', left(p_in, 800));
  IF p_out IS NOT NULL AND p_out <> '' THEN
    INSERT INTO public.messages (conversation_id, direction, author, body) VALUES (vid, 'out', 'ai', left(p_out, 1200));
  END IF;
  UPDATE public.conversations SET last_at = now(), unread = unread + 1 WHERE id = vid;
END $f$;

REVOKE ALL ON FUNCTION public.widget_config(text) FROM public;
REVOKE ALL ON FUNCTION public.widget_log(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.widget_config(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.widget_log(text, text, text, text) TO anon, authenticated;
