-- Chatora Phase 2 item 5: knowledge box + AI replies on Telegram.
-- Additive. Roll back with:
--   DROP FUNCTION IF EXISTS public.tg_ai_ctx(text, uuid, text);
--   DROP FUNCTION IF EXISTS public.tg_log_out(text, uuid, text, text);
--   DROP TABLE IF EXISTS public.knowledge_items;
--   and re-run the widget_config definition from 20261127_widget.sql to restore the old function body.
BEGIN;

CREATE TABLE IF NOT EXISTS public.knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_items_len CHECK (char_length(title) <= 120 AND char_length(body) BETWEEN 1 AND 2000)
);
CREATE INDEX IF NOT EXISTS knowledge_items_ws_idx ON public.knowledge_items (workspace_id, created_at);
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_items_own ON public.knowledge_items;
CREATE POLICY knowledge_items_own ON public.knowledge_items FOR ALL TO anon, authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')));

CREATE OR REPLACE FUNCTION public.knowledge_items_limit() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF (SELECT count(*) FROM public.knowledge_items WHERE workspace_id = new.workspace_id) >= 30 THEN
    RAISE EXCEPTION 'knowledge limit reached' USING errcode = 'check_violation';
  END IF;
  RETURN new;
END $f$;
DROP TRIGGER IF EXISTS knowledge_items_limit_trg ON public.knowledge_items;
CREATE TRIGGER knowledge_items_limit_trg BEFORE INSERT ON public.knowledge_items FOR EACH ROW EXECUTE FUNCTION public.knowledge_items_limit();

-- Web widget: knowledge box items first, then the existing flow text.
CREATE OR REPLACE FUNCTION public.widget_config(p_key text) RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $f$
  SELECT json_build_object(
    'workspace', w.name,
    'greeting', k.greeting,
    'allowed_origin', k.allowed_origin,
    'knowledge', (
      COALESCE((SELECT json_agg(json_build_object('name', left(NULLIF(i.title, ''), 120), 'steps', json_build_array(left(i.body, 1200))))
                FROM (SELECT * FROM public.knowledge_items WHERE workspace_id = w.id ORDER BY created_at LIMIT 20) i), '[]'::json)::jsonb
      ||
      COALESCE((SELECT jsonb_agg(json_build_object('name', left(f.name, 120), 'steps', (
        SELECT COALESCE(json_agg(left(n->>'text', 300)), '[]'::json)
        FROM (SELECT n FROM jsonb_array_elements(f.nodes) n WHERE coalesce(n->>'text','') <> '' LIMIT 12) s)))
      FROM (SELECT * FROM public.flows WHERE workspace_id = w.id ORDER BY updated_at DESC LIMIT 10) f), '[]'::jsonb)
    )::json)
  FROM public.widget_keys k JOIN public.workspaces w ON w.id = k.workspace_id
  WHERE k.key = p_key AND k.active
$f$;

-- Telegram AI context for the worker (secret-protected: returns the bot token).
CREATE OR REPLACE FUNCTION public.tg_ai_ctx(p_key text, p_id uuid, p_chat text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; tok text; wname text; st text; know jsonb;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_chat !~ '^-?[0-9]{1,20}$' THEN RETURN NULL; END IF;
  SELECT cc.workspace_id, cc.auth_token INTO ws, tok FROM public.channel_connections cc
    WHERE cc.id = p_id AND cc.provider = 'telegram' AND cc.status = 'connected';
  IF ws IS NULL THEN RETURN NULL; END IF;
  SELECT w.name INTO wname FROM public.workspaces w WHERE w.id = ws;
  SELECT c.status INTO st FROM public.conversations c JOIN public.contacts t ON t.id = c.contact_id
    WHERE c.workspace_id = ws AND c.channel = 'telegram' AND t.handle = 'tg:' || p_chat ORDER BY c.last_at DESC LIMIT 1;
  IF coalesce(st, 'ai') IN ('human', 'closed') THEN RETURN jsonb_build_object('skip', true); END IF;
  IF (SELECT count(*) FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.workspace_id = ws AND c.channel = 'telegram' AND m.author = 'ai' AND m.created_at > now() - interval '1 hour') > 200 THEN
    RETURN jsonb_build_object('skip', true);
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', left(NULLIF(i.title, ''), 120), 'steps', jsonb_build_array(left(i.body, 1200)))), '[]'::jsonb)
    INTO know FROM (SELECT * FROM public.knowledge_items WHERE workspace_id = ws ORDER BY created_at LIMIT 20) i;
  know := know || coalesce((SELECT jsonb_agg(jsonb_build_object('name', left(f.name, 120), 'steps', (
      SELECT coalesce(jsonb_agg(left(n->>'text', 300)), '[]'::jsonb)
      FROM (SELECT n FROM jsonb_array_elements(f.nodes) n WHERE coalesce(n->>'text','') <> '' LIMIT 12) s)))
    FROM (SELECT * FROM public.flows WHERE workspace_id = ws ORDER BY updated_at DESC LIMIT 10) f), '[]'::jsonb);
  RETURN jsonb_build_object('workspace', wname, 'tg_token', tok, 'knowledge', know);
END $f$;

-- Stores the AI reply sent on Telegram in the conversation.
CREATE OR REPLACE FUNCTION public.tg_log_out(p_key text, p_id uuid, p_chat text, p_text text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; vid uuid;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_chat !~ '^-?[0-9]{1,20}$' OR coalesce(p_text, '') = '' THEN RETURN; END IF;
  SELECT workspace_id INTO ws FROM public.channel_connections WHERE id = p_id AND provider = 'telegram' AND status = 'connected';
  IF ws IS NULL THEN RETURN; END IF;
  SELECT c.id INTO vid FROM public.conversations c JOIN public.contacts t ON t.id = c.contact_id
    WHERE c.workspace_id = ws AND c.channel = 'telegram' AND t.handle = 'tg:' || p_chat ORDER BY c.last_at DESC LIMIT 1;
  IF vid IS NULL THEN RETURN; END IF;
  INSERT INTO public.messages (conversation_id, direction, author, body, provider) VALUES (vid, 'out', 'ai', left(p_text, 1200), 'telegram');
  UPDATE public.conversations SET last_at = now() WHERE id = vid;
END $f$;

REVOKE ALL ON FUNCTION public.tg_ai_ctx(text, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.tg_log_out(text, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.tg_ai_ctx(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_log_out(text, uuid, text, text) TO anon, authenticated;

COMMIT;
