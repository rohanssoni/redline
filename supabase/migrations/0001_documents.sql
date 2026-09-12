-- 0001_documents.sql
--
-- The document store: the text a reader's browser extracted, plus the most
-- recent analysis of it. There is no original file here and no storage bucket:
-- the file never leaves the reader's browser (CLAUDE.md, settled).
--
-- Run by hand against the Supabase project. Nothing applies this automatically.

create extension if not exists "pgcrypto";

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 500),
  extracted_text text not null,
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.documents is
  'Text extracted in the reader''s browser, with its most recent analysis. Never the original file.';

create index if not exists documents_owner_created_idx
  on public.documents (owner_id, created_at desc);

-- Keep updated_at honest whatever writes the row.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_touch_updated_at on public.documents;
create trigger documents_touch_updated_at
  before update on public.documents
  for each row execute function public.touch_updated_at();

-- Row level security: a reader reaches their own rows and no others.
alter table public.documents enable row level security;

drop policy if exists documents_select_own on public.documents;
create policy documents_select_own
  on public.documents for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own
  on public.documents for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists documents_update_own on public.documents;
create policy documents_update_own
  on public.documents for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own
  on public.documents for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- No policy for anon: an unauthenticated visitor reaches no row at all.
