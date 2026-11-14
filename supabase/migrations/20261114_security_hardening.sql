-- Chatora security hardening — applied to the live project on 2026-11-14.
-- Idempotent. Depends on 20261026_base_schema.sql.

BEGIN;

-- 1) lead_counts was a SECURITY DEFINER view readable by every signed-in user,
--    so any self-registered account could read lead volumes that RLS hides.
ALTER VIEW public.lead_counts SET (security_invoker = true);
REVOKE ALL ON public.lead_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.lead_counts TO service_role;

-- 2) Pin the search_path of the SECURITY DEFINER throttle and stop exposing it
--    as an RPC. Triggers fire regardless of EXECUTE privilege.
ALTER FUNCTION public.leads_throttle() SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.leads_throttle() FROM PUBLIC, anon, authenticated;

-- 3) Least-privilege table grants. RLS already blocks these paths; the grants
--    are a second line of defence if a policy is ever loosened by mistake.
REVOKE ALL ON public.workspaces, public.flows, public.contacts, public.conversations,
  public.messages, public.broadcasts FROM anon;
REVOKE ALL ON public.workspaces, public.flows, public.contacts, public.conversations,
  public.messages, public.broadcasts FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces, public.flows, public.contacts,
  public.conversations, public.messages, public.broadcasts TO authenticated;

REVOKE ALL ON public.leads, public.events FROM anon, authenticated;
GRANT INSERT ON public.leads, public.events TO anon;

ALTER POLICY broadcasts_own ON public.broadcasts TO authenticated;

-- 4) A workspace owner could PATCH their own `plan` through the REST API.
--    Only trusted server roles may set it; browser sessions keep the stored
--    value on update and always start on 'free'.
CREATE OR REPLACE FUNCTION public.workspaces_guard_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.plan := 'free';
    ELSE
      NEW.plan := OLD.plan;
      NEW.owner := OLD.owner;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.workspaces_guard_plan() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS workspaces_guard_plan_trg ON public.workspaces;
CREATE TRIGGER workspaces_guard_plan_trg BEFORE INSERT OR UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.workspaces_guard_plan();

-- 5) Bound what an anonymous visitor can write. NOT VALID keeps existing rows
--    untouched while enforcing the rule for every new row.
DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('leads',  'leads_channel_len',    'channel IS NULL OR char_length(channel) <= 80'),
      ('leads',  'leads_topic_len',      'topic IS NULL OR char_length(topic) <= 120'),
      ('leads',  'leads_variant_len',    'variant IS NULL OR char_length(variant) <= 80'),
      ('leads',  'leads_source_len',     'source_page IS NULL OR char_length(source_page) <= 255'),
      ('leads',  'leads_locale_len',     'locale IS NULL OR char_length(locale) <= 16'),
      ('leads',  'leads_referrer_len',   'referrer IS NULL OR char_length(referrer) <= 2048'),
      ('leads',  'leads_user_agent_len', 'user_agent IS NULL OR char_length(user_agent) <= 1024'),
      ('leads',  'leads_client_id_len',  'client_id IS NULL OR char_length(client_id) <= 64'),
      ('leads',  'leads_utm_size',       'utm IS NULL OR pg_column_size(utm) <= 4096'),
      ('events', 'events_name_len',      'char_length(name) <= 80'),
      ('events', 'events_page_len',      'page IS NULL OR char_length(page) <= 255'),
      ('events', 'events_locale_len',    'locale IS NULL OR char_length(locale) <= 16'),
      ('events', 'events_client_id_len', 'client_id IS NULL OR char_length(client_id) <= 64'),
      ('events', 'events_props_size',    'props IS NULL OR pg_column_size(props) <= 8192')
    ) AS t(tbl, con, expr)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = spec.con AND conrelid = format('public.%I', spec.tbl)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID', spec.tbl, spec.con, spec.expr);
    END IF;
  END LOOP;
END $$;

-- 6) Analytics events had no rate limit at all. Cap the table's intake so a
--    script cannot fill the database; analytics is best-effort by design
--    (api.js ignores a failed event).
CREATE INDEX IF NOT EXISTS events_created_at_idx ON public.events (created_at DESC);

CREATE OR REPLACE FUNCTION public.events_throttle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (SELECT count(*) FROM public.events e
      WHERE e.created_at > now() - interval '1 minute') >= 600 THEN
    RAISE EXCEPTION 'event intake is rate limited, try again later' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.events_throttle() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_throttle_trg ON public.events;
CREATE TRIGGER events_throttle_trg BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_throttle();

COMMIT;
