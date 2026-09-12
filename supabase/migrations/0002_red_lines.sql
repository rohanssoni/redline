-- 0002_red_lines.sql
--
-- A reader's red lines: terms they decided in advance they will not accept,
-- written in their own words. The list belongs to the reader rather than to any
-- document, and every analysis they run reads it.
--
-- Run by hand against the Supabase project. Nothing applies this automatically.

create table if not exists public.red_lines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.red_lines is
  'Terms a reader decided in advance they will not accept, in the reader''s own words. Read by every analysis they run.';

-- The list is read whole, oldest first, on every analysis.
create index if not exists red_lines_owner_created_idx
  on public.red_lines (owner_id, created_at);

-- The same trigger function 0001 installed, so updated_at stays honest here too.
drop trigger if exists red_lines_touch_updated_at on public.red_lines;
create trigger red_lines_touch_updated_at
  before update on public.red_lines
  for each row execute function public.touch_updated_at();

-- Row level security: a reader reaches their own red lines and no others.
alter table public.red_lines enable row level security;

drop policy if exists red_lines_select_own on public.red_lines;
create policy red_lines_select_own
  on public.red_lines for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists red_lines_insert_own on public.red_lines;
create policy red_lines_insert_own
  on public.red_lines for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists red_lines_update_own on public.red_lines;
create policy red_lines_update_own
  on public.red_lines for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists red_lines_delete_own on public.red_lines;
create policy red_lines_delete_own
  on public.red_lines for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- No policy for anon: an unauthenticated visitor reaches no row at all. An
-- analysis run without an account runs with no red lines (PRD, capability 5).
