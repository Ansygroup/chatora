-- 20261203_contact_created_hook.sql
-- QA defect 11: contact.created fired only for API-created contacts. This trigger
-- emits the event for every insert path (UI form, CSV import, API). The worker no
-- longer emits it for API creates (doing both would double-fire).
-- Additive and reversible (rollback: drop trigger contacts_after_insert_hook, drop function public.contacts_emit_hook).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.contacts_emit_hook() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_data jsonb; v_id bigint; v_sub record;
BEGIN
  v_data := jsonb_build_object(
    'id', new.id,
    'workspace_id', new.workspace_id,
    'name', new.name,
    'handle', new.handle,
    'channel', new.channel,
    'tags', COALESCE(to_jsonb(new.tags), '[]'::jsonb),
    'fields', COALESCE(new.fields, '{}'::jsonb),
    'created_at', new.created_at
  );
  IF char_length(v_data::text) > 3800 THEN
    v_data := jsonb_build_object('truncated', true, 'preview', left(v_data::text, 3800));
  END IF;
  INSERT INTO public.hook_events (workspace_id, event, data)
    VALUES (new.workspace_id, 'contact.created', v_data) RETURNING id INTO v_id;
  DELETE FROM public.hook_events WHERE workspace_id = new.workspace_id AND id <
    (SELECT COALESCE((SELECT id FROM public.hook_events WHERE workspace_id = new.workspace_id ORDER BY id DESC OFFSET 99 LIMIT 1), 0));
  FOR v_sub IN SELECT id, target_url FROM public.hook_subscriptions
    WHERE workspace_id = new.workspace_id AND event = 'contact.created'
  LOOP
    PERFORM net.http_post(
      url := v_sub.target_url,
      headers := '{"content-type":"application/json","user-agent":"Chatora-Webhook/1","x-chatora-event":"contact.created"}'::jsonb,
      body := jsonb_build_object('id', v_id, 'event', 'contact.created', 'created_at', now()) || v_data
    );
    UPDATE public.hook_subscriptions SET last_at = now() WHERE id = v_sub.id;
  END LOOP;
  RETURN new;
END $f$;

DROP TRIGGER IF EXISTS contacts_after_insert_hook ON public.contacts;
CREATE TRIGGER contacts_after_insert_hook AFTER INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.contacts_emit_hook();
