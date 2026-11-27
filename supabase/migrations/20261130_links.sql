-- Chatora Phase 2 item 9: link tracking (short links + click counts).
-- Additive. Rollback:
--   DROP FUNCTION IF EXISTS public.short_link_make(text, uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.short_link_hit(text);
--   DROP TABLE IF EXISTS public.short_links;
BEGIN;

CREATE TABLE IF NOT EXISTS public.short_links (
  code text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  url text NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT short_links_url CHECK (url ~ '^https://' AND char_length(url) <= 300),
  CONSTRAINT short_links_uniq UNIQUE (flow_id, url)
);
CREATE INDEX IF NOT EXISTS short_links_ws_idx ON public.short_links (workspace_id);
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS short_links_own ON public.short_links;
CREATE POLICY short_links_own ON public.short_links FOR SELECT TO anon, authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')));

CREATE OR REPLACE FUNCTION public.short_link_make(p_key text, p_ws uuid, p_flow uuid, p_url text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE c text;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_url IS NULL OR p_url !~ '^https://' OR char_length(p_url) > 300 THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.flows WHERE id = p_flow AND workspace_id = p_ws) THEN RETURN NULL; END IF;
  SELECT code INTO c FROM public.short_links WHERE flow_id = p_flow AND url = p_url;
  IF c IS NOT NULL THEN RETURN c; END IF;
  IF (SELECT count(*) FROM public.short_links WHERE flow_id = p_flow) >= 50 THEN RETURN NULL; END IF;
  c := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  INSERT INTO public.short_links (code, workspace_id, flow_id, url) VALUES (c, p_ws, p_flow, p_url)
    ON CONFLICT (flow_id, url) DO NOTHING;
  SELECT code INTO c FROM public.short_links WHERE flow_id = p_flow AND url = p_url;
  RETURN c;
END
$f$;
REVOKE ALL ON FUNCTION public.short_link_make(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.short_link_make(text, uuid, uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.short_link_hit(p_code text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE u text;
BEGIN
  IF p_code !~ '^[a-z0-9]{6,12}$' THEN RETURN NULL; END IF;
  UPDATE public.short_links SET clicks = clicks + 1 WHERE code = p_code RETURNING url INTO u;
  RETURN u;
END
$f$;
REVOKE ALL ON FUNCTION public.short_link_hit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.short_link_hit(text) TO anon, authenticated;

COMMIT;
