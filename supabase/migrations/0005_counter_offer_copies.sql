-- 0005_counter_offer_copies.sql
--
-- Counter-offers readers copied. One row per copy, and the primary success
-- metric is counted off these rows.
--
-- The metric it stands in for is "counter-offer sent" (PRD, success metrics).
-- Redline cannot watch a message leave: the reader copies the wording and
-- pastes it into their own email, somewhere the app cannot see. A copy is the
-- proxy, and everything here is named for the copy rather than for the send, so
-- nobody reading the view later quotes it as confirmed sends.
--
-- Split by stance, because a soft ask copied and a firm ask copied say
-- different things about whether the soft default is calibrated (ADR-0009).
--
-- Gaps are not in this table. A copy names a counter-offer, and a gap has none
-- and can have none (ADR-0014).
--
-- Run by hand against the Supabase project. Nothing applies this automatically.

create table if not exists public.counter_offer_copies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  flag_id text not null check (char_length(btrim(flag_id)) > 0),
  stance text not null check (stance in ('soft', 'firm')),
  created_at timestamptz not null default now()
);

-- Deliberately no unique constraint on (document_id, flag_id, stance). A reader
-- who copies one draft four times gets four rows: the repeat is the thing worth
-- seeing, and the view below counts the distinct drafts separately so the
-- repeats never read as four sends.

comment on table public.counter_offer_copies is
  'Counter-offers readers copied. A copy is the proxy for a send: Redline cannot observe a message leaving, so it records the copy and reports copies. A count from here is not a count of confirmed sends.';

comment on column public.counter_offer_copies.stance is
  'The stance of the draft that was copied, soft or firm (ADR-0009). Written from the stored analysis, not from what the page reported.';

-- Counting groups by document, flag and stance, which is the only way this
-- table is read.
create index if not exists counter_offer_copies_draft_idx
  on public.counter_offer_copies (document_id, flag_id, stance);

-- Row level security: a reader records their own copies and reads nothing.
alter table public.counter_offer_copies enable row level security;

drop policy if exists counter_offer_copies_insert_own on public.counter_offer_copies;
create policy counter_offer_copies_insert_own
  on public.counter_offer_copies for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- No select, update or delete policy, and none for anon. A reader is never
-- shown their own copy count and has nothing to do with a copy once it is
-- written; an anonymous visitor's single try is never saved and has no drafted
-- counter-offer to copy. A copy is a fact about something that already
-- happened, so there is nothing about one to edit or withdraw.

-- The counts, where an ordinary signed-in reader cannot reach them.
--
-- Same shape as the dismissal rates in 0004: its own schema with no usage
-- granted to anon or authenticated, so PostgREST will not serve it and a
-- session cannot select from it however the request is shaped. security_invoker
-- stays on underneath as a second lock. Whoever audits runs it with the service
-- role, which row level security does not apply to.
create schema if not exists metrics;
revoke all on schema metrics from public;
revoke all on schema metrics from anon, authenticated;

create or replace view metrics.counter_offer_copies_by_stance
  with (security_invoker = on) as
select
  -- One flag in one stance, however many times it reached the clipboard. This
  -- is the column to read as sends, and it is still copies.
  count(distinct (document_id, flag_id)) filter (where stance = 'soft')
    as soft_unique_counter_offers_copied,
  count(*) filter (where stance = 'soft') as soft_copies,
  count(distinct (document_id, flag_id)) filter (where stance = 'firm')
    as firm_unique_counter_offers_copied,
  count(*) filter (where stance = 'firm') as firm_copies
from public.counter_offer_copies;

comment on view metrics.counter_offer_copies_by_stance is
  'Counter-offers copied, soft and firm apart. Redline records a copy because it cannot see whether the wording reached anyone, so these are copies rather than confirmed sends. The unique flag-and-stance columns are the closer stand-in for sends. The raw copy columns beside them say how often drafts reached the clipboard, and a wide gap usually means one draft was copied several times over.';
