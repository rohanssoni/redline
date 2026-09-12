/**
 * Supabase is what holds a reader's own data: their account, their library and
 * their red lines. Redline reads and analyses a document without it, so a
 * missing configuration is a state the product shows, not a crash.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** What a reader is told where an account would otherwise be offered. */
export const SIGN_IN_UNAVAILABLE =
  'Accounts aren’t set up on this copy of Redline yet, so there’s nowhere to sign in and nothing is saved.';

/**
 * The configured project, or `null` when the environment has none. Both
 * variables are read as literals so Next can inline them in the browser.
 */
export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}
