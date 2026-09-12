-- 0003_red_line_match_judgments.sql
--
-- The judge log: what a second, independent model said about each semantic red
-- line match (ADR-0018). It is written during a run and read afterwards by
-- whoever audits the matcher. Nothing a reader sees comes from this table: a
-- red-line-triggered flag looks the same whether the judge agreed or not
-- (ADR-0019), so the flag never consults a row here.
--
-- Agreements are written as well as disagreements. The thing ADR-0018 asks to be
-- watched is a rate, and a rate needs both sides of the ratio.
--
-- Run by hand against the Supabase project. Nothing applies this automatically.

create table if not exists public.red_line_match_judgments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  red_line text not null check (char_length(btrim(red_line)) between 1 and 300),
  source_sentence text not null check (char_length(btrim(source_sentence)) > 0),
  fits boolean not null,
  reasoning text not null check (char_length(btrim(reasoning)) > 0),
  created_at timestamptz not null default now()
);

comment on table public.red_line_match_judgments is
  'What a second model said about each red line match: a review-priority signal about the matcher, not proof that a flag is right or wrong. It shares the blind spots of the model it checks (ADR-0018). No reader-facing screen reads it (ADR-0019).';

comment on column public.red_line_match_judgments.fits is
  'The judge''s opinion that this sentence does break this red line. False changes nothing about the flag the reader was shown.';

-- The audit reads the log by time, and reads disagreements first.
create index if not exists red_line_match_judgments_fits_created_idx
  on public.red_line_match_judgments (fits, created_at desc);

-- Row level security: a run writes its own rows and nobody reads them.
alter table public.red_line_match_judgments enable row level security;

drop policy if exists red_line_match_judgments_insert_own
  on public.red_line_match_judgments;
create policy red_line_match_judgments_insert_own
  on public.red_line_match_judgments for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- No select, update or delete policy, and none for anon. A signed-in session
-- cannot read this table, so there is no query behind which a screen could put
-- the judge's verdict in front of the reader (ADR-0019). The audit runs with the
-- service role, which row level security does not apply to.

-- The rate ADR-0018 names, queryable as one row. security_invoker keeps it
-- behind the same policies as the table: a reader selecting from this view gets
-- zeroes, because they reach no row of the table underneath it.
create or replace view public.red_line_judge_agreement_rate
  with (security_invoker = on) as
select
  count(*) as reviewed,
  count(*) filter (where fits) as agreed,
  count(*) filter (where not fits) as disagreed,
  case when count(*) = 0 then null
       else (count(*) filter (where fits))::numeric / count(*) end as agreement_rate,
  case when count(*) = 0 then null
       else (count(*) filter (where not fits))::numeric / count(*) end as disagreement_rate
from public.red_line_match_judgments;

comment on view public.red_line_judge_agreement_rate is
  'How often the judge agreed with the matcher. A second model checking the first: it shows where to look, and both models can miss the same thing, so neither agreement nor disagreement settles whether a match was right (ADR-0018).';
