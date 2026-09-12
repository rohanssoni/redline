-- 0007_anonymous_tries.sql
--
-- The tally behind the three reads a visitor gets without an account. One row
-- per try taken: a digest of the caller's address and the UTC day it counted
-- against, and nothing else.
--
-- There is no document text here, no summary, no flag and no column one could
-- be put in. A try without an account is read and not kept, and this table is
-- the only row it writes. What it is for is cost: anonymous reads are real model
-- calls in a product with no payments, so they are counted before they are made.
--
-- The address is hashed on the way in (lib/anonymous/try-allowance.ts). The
-- digest is not a secret — the IPv4 space is small enough to walk — and it is
-- not offered as one. It keeps a table whose whole purpose is counting from
-- becoming a list of who read an agreement.
--
-- Rows are disposable. Nothing reads a row older than today, so whoever runs the
-- project can delete everything before the current day whenever they like.
--
-- Run by hand against the Supabase project. Nothing applies this automatically.

create table if not exists public.anonymous_tries (
  id uuid primary key default gen_random_uuid(),
  caller_key text not null check (char_length(btrim(caller_key)) > 0),
  day date not null,
  created_at timestamptz not null default now()
);

comment on table public.anonymous_tries is
  'One row per read taken without an account, holding a digest of the caller and the UTC day. Never the document, the text, or the result: an anonymous read is not stored.';

comment on column public.anonymous_tries.caller_key is
  'A SHA-256 digest of the caller''s address, or a shared bucket for callers that arrive without one. Callers with no address share the day''s allowance between them, which is the conservative end of that mistake.';

-- The whole of the read this table serves: today's rows for one caller.
create index if not exists anonymous_tries_caller_day_idx
  on public.anonymous_tries (caller_key, day);

-- Row level security. A visitor has no session, so the count runs as `anon`,
-- and `anon` therefore needs both halves of the claim: reading today's rows for
-- one caller and writing the new one.
alter table public.anonymous_tries enable row level security;

drop policy if exists anonymous_tries_select on public.anonymous_tries;
create policy anonymous_tries_select
  on public.anonymous_tries for select
  to anon, authenticated
  using (true);

drop policy if exists anonymous_tries_insert on public.anonymous_tries;
create policy anonymous_tries_insert
  on public.anonymous_tries for insert
  to anon, authenticated
  with check (day = (now() at time zone 'utc')::date);

-- No update policy and no delete policy, for anybody. A try that was taken
-- cannot be taken back, which is the only property this table has to defend: a
-- caller who could delete their own rows would have no limit at all.
--
-- What the select policy costs, said plainly: anyone holding the anon key can
-- read the digests and the daily counts. There is nothing in a row but a hash of
-- an address and a date, and no way back to a document from one. The alternative
-- was a security-definer function, which would move the rule that decides the
-- limit out of the code that can be tested and into SQL that cannot be run in
-- this suite. The rule is worth more under test than the digests are hidden.
--
-- `day` is checked against the server's own clock rather than trusted from the
-- request, so a caller cannot write their tries against tomorrow and read again
-- today.
