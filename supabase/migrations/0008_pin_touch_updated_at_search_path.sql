-- 0008_pin_touch_updated_at_search_path.sql
--
-- Pins the search_path of the updated_at trigger function from 0001. Without a
-- fixed search_path, a role that can create objects earlier on the path could
-- shadow what the function calls. The Supabase security advisor flags this
-- (lint 0011, function_search_path_mutable).
--
-- The function only calls now(), which lives in pg_catalog and resolves with
-- an empty path, so its behaviour does not change.
--
-- Run by hand against the Supabase project. Nothing applies this automatically.

alter function public.touch_updated_at() set search_path = '';
