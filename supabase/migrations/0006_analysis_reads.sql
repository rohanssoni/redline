-- 0006_analysis_reads.sql
--
-- One row per finished read, holding whether it came back as a clean read. The
-- zero-flag rate (ADR-0008) is counted off these rows.
--
-- What it is for: a severity filter that starts suppressing too hard produces
-- documents that look fine — a summary, no flags, a clean read — and every one
-- of them tells a reader their agreement is safe. Nothing else in the product
-- shows that. The share of reads coming back clean does.
--
-- It is a health metric, not a target to move. A low rate is not a win and a
-- high one is not automatically a fault: a run of genuinely fair agreements
-- raises it by itself. What is worth reading is the gap between the rate and
-- the baseline in force.
--
-- The row holds nothing about the document. No id, no name, no text, no flags —
-- a boolean and a timestamp, which is the whole of what a share needs.
--
-- Run by hand against the Supabase project. Nothing applies this automatically.

create table if not exists public.analysis_reads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  clean_read boolean not null,
  created_at timestamptz not null default now()
);

comment on table public.analysis_reads is
  'One row per finished read, and whether it came back as a clean read. The denominator of the zero-flag rate is every row here, which is why a flagged read is written as well as a clean one (ADR-0008).';

comment on column public.analysis_reads.clean_read is
  'Whether this read found nothing above the severity threshold. A clean read is a real result, not an empty one, so a true here is not a failure.';

-- Counting reads windows them by time, newest first, which is how both the
-- rolling window and the launch timestamp below are found.
create index if not exists analysis_reads_created_idx
  on public.analysis_reads (created_at desc);

-- Row level security: a run writes its own rows and nobody reads them.
alter table public.analysis_reads enable row level security;

drop policy if exists analysis_reads_insert_own on public.analysis_reads;
create policy analysis_reads_insert_own
  on public.analysis_reads for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- No select, update or delete policy, and none for anon. A reader is never
-- shown this rate: it says something about Redline's severity filter across
-- everybody's documents and nothing about their own agreement. A finished read
-- is also a fact about something that already happened, so there is nothing
-- about a row to edit or withdraw.

-- The rate, where an ordinary signed-in reader cannot reach it.
--
-- Same shape as the dismissal rates in 0004 and the copy counts in 0005: its
-- own schema with no usage granted to anon or authenticated, so PostgREST will
-- not serve it and a session cannot select from it however the request is
-- shaped. security_invoker stays on underneath as a second lock. Whoever audits
-- runs it with the service role, which row level security does not apply to.
create schema if not exists metrics;
revoke all on schema metrics from public;
revoke all on schema metrics from anon, authenticated;

-- The comparison in force is ADR-0016's, and the numbers in it are ADR-0011's
-- and ADR-0016's: a fixed 20% baseline until 500 finished reads or 90 days
-- since launch, whichever comes first, and a rolling window after that. Launch
-- is the first finished read recorded, which is the same definition the
-- application uses (`lib/zero-flag/store.ts`) so the two cannot drift apart.
create or replace view metrics.zero_flag_rate
  with (security_invoker = on) as
with ordered as (
  select
    clean_read,
    row_number() over (order by created_at desc, id desc) as recency
  from public.analysis_reads
),
totals as (
  select count(*) as analyzed, min(created_at) as launched_at
  from public.analysis_reads
),
-- The most recent 500 reads: the rate itself, whichever comparison is in force.
current_window as (
  select
    count(*) as window_reads,
    count(*) filter (where clean_read) as window_clean_reads
  from ordered
  where recency <= 500
),
-- The 500 before those: what the rolling comparison measures against. Equal
-- windows, so it is a recent stretch against the stretch before it rather than
-- a short run against a long average that would absorb it.
preceding_window as (
  select
    count(*) as preceding_reads,
    count(*) filter (where clean_read) as preceding_clean_reads
  from ordered
  where recency > 500 and recency <= 1000
),
measured as (
  select
    totals.analyzed,
    totals.launched_at,
    current_window.window_reads,
    current_window.window_clean_reads,
    case
      when current_window.window_reads = 0 then null
      else current_window.window_clean_reads::numeric / current_window.window_reads
    end as zero_flag_rate,
    case
      when totals.analyzed >= 500
        or (
          totals.launched_at is not null
          and now() - totals.launched_at >= interval '90 days'
        )
      then 'rolling'
      else 'fixed'
    end as comparison,
    case
      when preceding_window.preceding_reads = 0 then null
      else preceding_window.preceding_clean_reads::numeric
             / preceding_window.preceding_reads
    end as preceding_rate
  from totals, current_window, preceding_window
)
select
  analyzed,
  launched_at,
  window_reads,
  window_clean_reads,
  zero_flag_rate,
  comparison,
  -- 20% while the fixed comparison is in force (ADR-0011); the preceding
  -- window's own rate once the rolling one is (ADR-0016). Null rather than zero
  -- where the rolling comparison has taken over with nothing recorded before
  -- the current window: a zero there would read as "nothing used to come back
  -- clean", which the rows do not say.
  case when comparison = 'fixed' then 0.20 else preceding_rate end as baseline,
  case
    when zero_flag_rate is null then null
    when comparison = 'fixed' then zero_flag_rate - 0.20
    when preceding_rate is null then null
    else zero_flag_rate - preceding_rate
  end as drift
from measured;

comment on view metrics.zero_flag_rate is
  'The share of finished reads coming back as a clean read, against the baseline in force: a fixed 20% until 500 reads or 90 days since the first recorded read, then a rolling window of the preceding 500 reads (ADR-0011, ADR-0016). Watch this share; do not try to move it. A clean read is a real result, and the part to read is the gap against the baseline: when the severity filter starts suppressing everything, the documents it breaks come back looking fine, and a climbing share is the only place that shows.';
