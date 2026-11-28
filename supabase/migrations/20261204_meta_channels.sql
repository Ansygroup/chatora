-- 20261204_meta_channels.sql
-- WhatsApp Cloud, Instagram and Messenger channels (bring-your-own Meta app).
-- Each connection stores its own access token, app secret and webhook verify token
-- (owner-only RLS, same model as the Telegram bot token). Inbound messages arrive at
-- /api/meta/hook/<connection id>. Additive. Rollback: drop the three functions and the
-- three new columns; restore the old provider check if wanted.

ALTER TABLE public.channel_connections ADD COLUMN IF NOT EXISTS auth_token text;
ALTER TABLE public.channel_connections ADD COLUMN IF NOT EXISTS app_secret text;
ALTER TABLE public.channel_connections ADD COLUMN IF NOT EXISTS verify_token text;
ALTER TABLE public.channel_connections ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.channel_connections DROP CONSTRAINT IF EXISTS channel_connections_provider_check;
ALTER TABLE public.channel_connections ADD CONSTRAINT channel_connections_provider_check
  CHECK (provider IN ('whatsapp_cloud', 'instagram_messenger', 'telegram', 'email', 'whatsapp', 'instagram', 'messenger')) NOT VALID;

-- Secret-protected connection lookup for the worker (returns tokens).
CREATE OR REPLACE FUNCTION public.meta_conn(p_key text, p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT jsonb_build_object('id', cc.id, 'workspace_id', cc.workspace_id, 'provider', cc.provider,
            'account', cc.external_account_id, 'token', cc.auth_token, 'app_secret', cc.app_secret,
            'verify_token', cc.verify_token, 'test_mode', cc.test_mode, 'status', cc.status)
          FROM public.channel_connections cc
          WHERE cc.id = p_id AND cc.provider IN ('whatsapp', 'instagram', 'messenger'));
END $f$;

-- Logs an inbound message and returns the AI context (or skip) in one call.
CREATE OR REPLACE FUNCTION public.meta_inbound(p_key text, p_id uuid, p_msg text, p_user text, p_name text, p_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; prov text; ch text; pre text; cid uuid; vid uuid; st text; wname text; know jsonb;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user !~ '^[A-Za-z0-9_.:-]{1,64}$' OR coalesce(p_text, '') = '' THEN RETURN jsonb_build_object('skip', true); END IF;
  SELECT cc.workspace_id, cc.provider INTO ws, prov FROM public.channel_connections cc
    WHERE cc.id = p_id AND cc.provider IN ('whatsapp', 'instagram', 'messenger') AND cc.status = 'connected';
  IF ws IS NULL THEN RETURN jsonb_build_object('skip', true); END IF;
  ch := prov; pre := CASE prov WHEN 'whatsapp' THEN 'wa:' WHEN 'instagram' THEN 'ig:' ELSE 'ms:' END;
  IF coalesce(p_msg, '') <> '' AND EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.workspace_id = ws AND m.provider = ch AND m.provider_message_id = left(p_msg, 200)) THEN
    RETURN jsonb_build_object('skip', true, 'dup', true);
  END IF;
  IF (SELECT count(*) FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.workspace_id = ws AND c.channel = ch AND m.created_at > now() - interval '1 hour') > 400 THEN
    RETURN jsonb_build_object('skip', true);
  END IF;
  SELECT id INTO cid FROM public.contacts WHERE workspace_id = ws AND handle = pre || p_user LIMIT 1;
  IF cid IS NULL THEN
    INSERT INTO public.contacts (workspace_id, name, handle, channel, tags, external_id)
    VALUES (ws, left(coalesce(nullif(p_name, ''), initcap(ch) || ' user'), 80), pre || p_user, ch, ARRAY[ch], p_user) RETURNING id INTO cid;
  ELSE
    UPDATE public.contacts SET last_seen = now() WHERE id = cid;
  END IF;
  SELECT id, status INTO vid, st FROM public.conversations WHERE workspace_id = ws AND contact_id = cid AND channel = ch ORDER BY last_at DESC LIMIT 1;
  IF vid IS NULL THEN
    INSERT INTO public.conversations (workspace_id, contact_id, channel, status, unread) VALUES (ws, cid, ch, 'ai', 0) RETURNING id, status INTO vid, st;
  END IF;
  INSERT INTO public.messages (conversation_id, direction, author, body, provider, provider_message_id)
    VALUES (vid, 'in', 'contact', left(p_text, 4000), ch, nullif(left(p_msg, 200), ''));
  UPDATE public.conversations SET last_at = now(), last_inbound_at = now(), unread = unread + 1 WHERE id = vid;
  IF coalesce(st, 'ai') IN ('human', 'closed') THEN RETURN jsonb_build_object('skip', true, 'logged', true); END IF;
  IF (SELECT count(*) FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.workspace_id = ws AND c.channel = ch AND m.author = 'ai' AND m.created_at > now() - interval '1 hour') > 200 THEN
    RETURN jsonb_build_object('skip', true, 'logged', true);
  END IF;
  SELECT w.name INTO wname FROM public.workspaces w WHERE w.id = ws;
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', left(NULLIF(i.title, ''), 120), 'steps', jsonb_build_array(left(i.body, 1200)))), '[]'::jsonb)
    INTO know FROM (SELECT * FROM public.knowledge_items WHERE workspace_id = ws ORDER BY created_at LIMIT 20) i;
  know := know || coalesce((SELECT jsonb_agg(jsonb_build_object('name', left(f.name, 120), 'steps', (
      SELECT coalesce(jsonb_agg(left(n->>'text', 300)), '[]'::jsonb)
      FROM (SELECT n FROM jsonb_array_elements(f.nodes) n WHERE coalesce(n->>'text','') <> '' LIMIT 12) s)))
    FROM (SELECT * FROM public.flows WHERE workspace_id = ws ORDER BY updated_at DESC LIMIT 10) f), '[]'::jsonb);
  RETURN jsonb_build_object('workspace', wname, 'knowledge', know, 'workspace_id', ws);
END $f$;

-- Stores the bot reply in the conversation.
CREATE OR REPLACE FUNCTION public.meta_log_out(p_key text, p_id uuid, p_user text, p_text text, p_msg text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE ws uuid; prov text; pre text; vid uuid;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(p_text, '') = '' THEN RETURN; END IF;
  SELECT workspace_id, provider INTO ws, prov FROM public.channel_connections
    WHERE id = p_id AND provider IN ('whatsapp', 'instagram', 'messenger') AND status = 'connected';
  IF ws IS NULL THEN RETURN; END IF;
  pre := CASE prov WHEN 'whatsapp' THEN 'wa:' WHEN 'instagram' THEN 'ig:' ELSE 'ms:' END;
  SELECT c.id INTO vid FROM public.conversations c JOIN public.contacts t ON t.id = c.contact_id
    WHERE c.workspace_id = ws AND c.channel = prov AND t.handle = pre || p_user ORDER BY c.last_at DESC LIMIT 1;
  IF vid IS NULL THEN RETURN; END IF;
  INSERT INTO public.messages (conversation_id, direction, author, body, provider, provider_message_id)
    VALUES (vid, 'out', 'ai', left(p_text, 1200), prov, nullif(left(p_msg, 200), ''));
  UPDATE public.conversations SET last_at = now() WHERE id = vid;
END $f$;

REVOKE ALL ON FUNCTION public.meta_conn(text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.meta_inbound(text, uuid, text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.meta_log_out(text, uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.meta_conn(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_inbound(text, uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_log_out(text, uuid, text, text, text) TO anon, authenticated;
