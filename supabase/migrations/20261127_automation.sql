-- Chatora Phase 2 item 2: contact-event triggers + automation runs.
-- flow_runs tracks each flow execution (immediate, delayed, scheduled).
-- automation_config holds a server-only key so the worker cron can claim work
-- through security-definer RPCs without any user JWT.

BEGIN;

CREATE TABLE IF NOT EXISTS public.flow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  next_step integer NOT NULL DEFAULT 1,
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT flow_runs_status_check CHECK (status = ANY (ARRAY['pending','running','done','failed'])),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flow_runs_due_idx ON public.flow_runs (status, run_at);
CREATE INDEX IF NOT EXISTS flow_runs_ws_idx ON public.flow_runs (workspace_id);

ALTER TABLE public.flow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flow_runs_own ON public.flow_runs;
CREATE POLICY flow_runs_own ON public.flow_runs FOR ALL TO anon, authenticated
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner = (auth.jwt() ->> 'sub')));

CREATE TABLE IF NOT EXISTS public.automation_config (
  id integer PRIMARY KEY DEFAULT 1,
  secret text NOT NULL,
  CONSTRAINT automation_config_single CHECK (id = 1)
);
ALTER TABLE public.automation_config ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only security-definer functions below may read it.

-- Claims due runs and fires due schedule triggers. Returns work items with
-- everything the worker needs to execute them (nodes, contact, bot token).
CREATE OR REPLACE FUNCTION public.automation_tick(p_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_runs jsonb;
  v_sched jsonb;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- reset runs stuck in running for over 10 minutes so they retry once
  UPDATE public.flow_runs SET status = 'pending'
  WHERE status = 'running' AND run_at < now() - interval '10 minutes';

  WITH due AS (
    SELECT id FROM public.flow_runs
    WHERE status = 'pending' AND run_at <= now()
    ORDER BY run_at LIMIT 20 FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.flow_runs r SET status = 'running' FROM due WHERE r.id = due.id
    RETURNING r.id, r.flow_id, r.contact_id, r.next_step, r.workspace_id, r.note
  )
  SELECT jsonb_agg(jsonb_build_object(
    'run_id', u.id, 'flow_id', u.flow_id, 'contact_id', u.contact_id,
    'next_step', u.next_step, 'workspace_id', u.workspace_id, 'note', u.note,
    'nodes', f.nodes,
    'contact', jsonb_build_object('name', c.name, 'handle', c.handle, 'channel', c.channel, 'tags', c.tags, 'fields', c.fields),
    'tg_token', (SELECT cc.auth_token FROM public.channel_connections cc
                 WHERE cc.workspace_id = u.workspace_id AND cc.provider = 'telegram' AND cc.status = 'connected' LIMIT 1)
  )) INTO v_runs
  FROM upd u
  JOIN public.flows f ON f.id = u.flow_id
  JOIN public.contacts c ON c.id = u.contact_id;

  -- schedule triggers: live flows whose trigger is "event:schedule field:KEY"
  WITH sf AS (
    SELECT f.id AS flow_id, f.workspace_id, f.nodes,
           substring(f.nodes -> 0 ->> 'text' from 'field:([A-Za-z0-9_.-]+)$') AS field_key
    FROM public.flows f
    WHERE f.status = 'live'
      AND f.nodes -> 0 ->> 't' = 'trigger'
      AND f.nodes -> 0 ->> 'text' ~ '^event:schedule\s+field:[A-Za-z0-9_.-]{1,30}$'
  ), due_contacts AS (
    SELECT sf.flow_id, sf.workspace_id, c.id AS contact_id
    FROM sf
    JOIN public.contacts c ON c.workspace_id = sf.workspace_id
    WHERE (c.fields ->> sf.field_key) ~ '^\d{4}-\d{2}-\d{2}'
      AND (c.fields ->> sf.field_key)::timestamptz <= now()
      AND NOT EXISTS (
        SELECT 1 FROM public.flow_runs r
        WHERE r.flow_id = sf.flow_id AND r.contact_id = c.id AND r.note = 'schedule'
          AND r.status IN ('pending','running','done')
      )
    LIMIT 20
  ), ins AS (
    INSERT INTO public.flow_runs (workspace_id, flow_id, contact_id, next_step, run_at, status, note)
    SELECT workspace_id, flow_id, contact_id, 1, now(), 'running', 'schedule' FROM due_contacts
    RETURNING id, flow_id, contact_id, workspace_id
  )
  SELECT jsonb_agg(jsonb_build_object(
    'run_id', i.id, 'flow_id', i.flow_id, 'contact_id', i.contact_id,
    'next_step', 1, 'workspace_id', i.workspace_id, 'note', 'schedule',
    'nodes', f.nodes,
    'contact', jsonb_build_object('name', c.name, 'handle', c.handle, 'channel', c.channel, 'tags', c.tags, 'fields', c.fields),
    'tg_token', (SELECT cc.auth_token FROM public.channel_connections cc
                 WHERE cc.workspace_id = i.workspace_id AND cc.provider = 'telegram' AND cc.status = 'connected' LIMIT 1)
  )) INTO v_sched
  FROM ins i
  JOIN public.flows f ON f.id = i.flow_id
  JOIN public.contacts c ON c.id = i.contact_id;

  RETURN jsonb_build_object('runs', COALESCE(v_runs, '[]'::jsonb), 'scheduled', COALESCE(v_sched, '[]'::jsonb));
END;
$$;

-- Applies the effects of an executed run and stores its final state.
-- p_effects: [ {"type":"web_msg","contact_id":..,"workspace_id":..,"body":..},
--              {"type":"add_tag","contact_id":..,"tag":..} ]
CREATE OR REPLACE FUNCTION public.automation_finish(
  p_key text, p_run_id uuid, p_status text, p_next_step integer,
  p_run_at timestamptz, p_note text, p_effects jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_eff jsonb;
  v_conv uuid;
  v_flow uuid;
BEGIN
  IF p_key IS NULL OR p_key <> (SELECT secret FROM public.automation_config WHERE id = 1) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_status NOT IN ('pending','done','failed') THEN
    RAISE EXCEPTION 'bad status';
  END IF;

  FOR v_eff IN SELECT * FROM jsonb_array_elements(COALESCE(p_effects, '[]'::jsonb)) LOOP
    IF v_eff ->> 'type' = 'web_msg' THEN
      SELECT id INTO v_conv FROM public.conversations
      WHERE contact_id = (v_eff ->> 'contact_id')::uuid AND channel = 'web' AND status <> 'closed'
      ORDER BY last_at DESC LIMIT 1;
      IF v_conv IS NULL THEN
        INSERT INTO public.conversations (workspace_id, contact_id, channel, status, last_at)
        VALUES ((v_eff ->> 'workspace_id')::uuid, (v_eff ->> 'contact_id')::uuid, 'web', 'ai', now())
        RETURNING id INTO v_conv;
      END IF;
      INSERT INTO public.messages (conversation_id, direction, author, body)
      VALUES (v_conv, 'out', 'ai', left(v_eff ->> 'body', 1200));
      UPDATE public.conversations SET last_at = now() WHERE id = v_conv;
    ELSIF v_eff ->> 'type' = 'add_tag' THEN
      UPDATE public.contacts
      SET tags = (SELECT array_agg(DISTINCT t) FROM unnest(tags || ARRAY[left(v_eff ->> 'tag', 40)]) AS t)
      WHERE id = (v_eff ->> 'contact_id')::uuid
        AND NOT (COALESCE(tags, '{}') @> ARRAY[left(v_eff ->> 'tag', 40)]);
    END IF;
  END LOOP;

  UPDATE public.flow_runs
  SET status = p_status, next_step = p_next_step, run_at = COALESCE(p_run_at, run_at), note = left(COALESCE(p_note, ''), 200)
  WHERE id = p_run_id;

  IF p_status = 'done' THEN
    SELECT flow_id INTO v_flow FROM public.flow_runs WHERE id = p_run_id;
    UPDATE public.flows SET runs = runs + 1 WHERE id = v_flow;
  END IF;
END;
$$;

COMMIT;
