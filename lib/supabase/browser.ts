'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './config';

let cached: SupabaseClient | null = null;

/** The browser-side client, or `null` when no project is configured. */
export function browserSupabase(): SupabaseClient | null {
  if (cached) return cached;
  const config = supabaseConfig();
  if (!config) return null;
  cached = createBrowserClient(config.url, config.anonKey);
  return cached;
}
