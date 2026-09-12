-- 0004_flag_dismissals.sql
--
-- Flags a reader read and set aside. One row per flag one reader waved off, and
-- no row at all once they bring it back: undo is a delete, because a reader who
-- changed their mind did not dismiss anything and should not be counted as
-- having done so.
--
-- Redline raises a clause whenever it might cost the reader something, knowing
-- some of what it raises will be waved off (ADR-0006). So a nonzero rate here is
-- the design working. What the rate is for is telling whether the severity
-- threshold or the red line matcher needs retuning, and those are two different
-- questions: `red_line_triggered` is what keeps them apart (ADR-0013).
--
-- Gaps are not in this table. A gap has no source sentence and is not in the
-- analysis's `flags` list, and the only ids written here come from that list.
--
-- Run by hand against the Supabase project. Nothing applies this automatically.

create table if not exists public.flag_dismissals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  flag_id text not null check (char_length(btrim(flag_id)) > 0),
  red_line_triggered boolean not null,
  created_at timestamptz not null default now(),
  unique (document_id, flag_id)
);

comment on table public.flag_dismissals is
  'Flags a reader read and set aside. Expected to be nonzero: Redline favours showing a clause over withholding it (ADR-0006), so some of what it shows gets waved off. A row is not a defect report.';

comment on column public.flag_dismissals.red_line_triggered is
  'Whether one of the reader''s own red lines is what put this flag in front of them (ADR-0013). Waving off your own red line is a different signal from waving off a clause Redline raised by itself, so the two are never averaged.';

-- The reader's own set-aside flags for one document, which is the read behind
-- every view of a document they have worked through.
create index if not exists flag_dismissals_owner_document_idx
  on public.flag_dismissals (owner_id, document_id);

-- Row level security: a reader writes, reads and deletes their own rows, and
-- reaches nobody else's.
alter table public.flag_dismissals enable row level security;

drop policy if exists flag_dismissals_insert_own on public.flag_dismissals;
create policy flag_dismissals_insert_own
  on public.flag_dismissals for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists flag_dismissals_select_own on public.flag_dismissals;
create policy flag_dismissals_select_own
  on public.flag_dismissals for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists flag_dismissals_delete_own on public.flag_dismissals;
create policy flag_dismissals_delete_own
  on public.flag_dismissals for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- No update policy and none for anon. A dismissal is written once and deleted;
-- there is nothing about one to edit, and an anonymous visitor's single try is
-- never saved, so it has no flag to set aside.

-- The rate, where an ordinary signed-in reader cannot reach it.
--
-- It lives in its own schema with no usage granted to anon or authenticated, so
-- PostgREST will not serve it and a session cannot select from it however the
-- request is shaped. security_invoker stays on underneath as a second lock: the
-- view reads the same rows the caller could have read itself. Whoever audits
-- runs it with the service role, which row level security does not apply to.
create schema if not exists metrics;
revoke all on schema metrics from public;
revoke all on schema metrics from anon, authenticated;

create or replace view metrics.flag_dismissal_rates
  with (security_invoker = on) as
with shown as (
  select
    d.id as document_id,
    flag.value ->> 'id' as flag_id,
    exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(d.analysis -> 'redLineMatches') = 'array'
            then d.analysis -> 'redLineMatches'
          else '[]'::jsonb
        end
      ) as match
      where match.value ->> 'flagId' = flag.value ->> 'id'
    ) as red_line_triggered
  from public.documents d
  -- `flags` only. `gaps` is a different key of the same column and is never
  -- read here: a gap has no source sentence and is not part of this metric.
  cross join lateral jsonb_array_elements(d.analysis -> 'flags') as flag
  where jsonb_typeof(d.analysis -> 'flags') = 'array'
)
select
  count(*) filter (where not shown.red_line_triggered) as ordinary_shown,
  count(*) filter (
    where not shown.red_line_triggered and dismissal.id is not null
  ) as ordinary_dismissed,
  case
    when count(*) filter (where not shown.red_line_triggered) = 0 then null
    else (
      count(*) filter (
        where not shown.red_line_triggered and dismissal.id is not null
      )
    )::numeric / count(*) filter (where not shown.red_line_triggered)
  end as ordinary_dismissal_rate,
  count(*) filter (where shown.red_line_triggered) as red_line_shown,
  count(*) filter (
    where shown.red_line_triggered and dismissal.id is not null
  ) as red_line_dismissed,
  case
    when count(*) filter (where shown.red_line_triggered) = 0 then null
    else (
      count(*) filter (
        where shown.red_line_triggered and dismissal.id is not null
      )
    )::numeric / count(*) filter (where shown.red_line_triggered)
  end as red_line_dismissal_rate
from shown
left join public.flag_dismissals as dismissal
  on dismissal.document_id = shown.document_id
 and dismissal.flag_id = shown.flag_id;

comment on view metrics.flag_dismissal_rates is
  'How often a flag gets set aside, ordinary flags and red-line-triggered flags counted apart. There is deliberately no combined figure: a reader waving off their own red line says something about the matcher, a reader waving off a borderline clause says something about the threshold, and one number answers neither (ADR-0006, ADR-0013).';
