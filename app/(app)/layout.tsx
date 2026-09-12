import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured, SIGN_IN_UNAVAILABLE } from '@/lib/supabase/config';
import { currentReader } from '@/lib/supabase/server';
import { signOut } from '../(auth)/actions';
import './app.css';

/**
 * The frame a signed-in reader works in. With no Supabase project configured
 * there is nobody to sign in as, so the frame says so plainly rather than
 * bouncing the reader to a sign-in screen that cannot work.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="shell">
        <Header />
        <main className="work">
          <section className="sheet">
            <h1>Accounts aren’t set up yet</h1>
            <div className="sheet-body">
              <p>{SIGN_IN_UNAVAILABLE}</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const reader = await currentReader();
  if (!reader) {
    redirect('/sign-in');
  }

  return (
    <div className="shell">
      <Header email={reader.user.email ?? undefined} />
      <main className="work">{children}</main>
    </div>
  );
}

function Header({ email }: { email?: string }) {
  return (
    <header className="nav shell-nav">
      <Link className="wordmark" href="/">
        <span className="wordmark-bar" aria-hidden="true" />
        Redline
      </Link>
      <nav className="shell-nav-links">
        <Link href="/documents/new">New document</Link>
      </nav>
      {email ? (
        <div className="shell-account">
          <span className="shell-account-name">{email}</span>
          <form action={signOut}>
            <button className="link-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </header>
  );
}
