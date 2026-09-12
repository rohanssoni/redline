import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { supabaseConfig } from './config';

/**
 * The server-side client, or `null` when no project is configured. Every caller
 * has to handle the `null`, which is how the app keeps working with the Supabase
 * variables absent.
 */
export async function serverSupabase(): Promise<SupabaseClient | null> {
  const config = supabaseConfig();
  if (!config) return null;

  const store = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(written) {
        try {
          for (const { name, value, options } of written) {
            store.set(name, value, options);
          }
        } catch {
          // A server component cannot write cookies. The session is refreshed
          // by the next server action or route handler instead.
        }
      },
    },
  });
}

export interface SignedInReader {
  supabase: SupabaseClient;
  user: User;
}

/** The signed-in reader, or `null` if there is nobody signed in. */
export async function currentReader(): Promise<SignedInReader | null> {
  const supabase = await serverSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}
