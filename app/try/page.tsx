import type { Metadata } from 'next';
import { ANONYMOUS_TRIES_PER_DAY } from '@/lib/anonymous/try-limits';
import { TryPanel } from './try-panel';
import './try.css';

export const metadata: Metadata = {
  title: 'Try it on an agreement — Redline',
  description:
    'Read one agreement without an account. The summary and the clauses that could cost you, each quoting the sentence it came from.',
};

/**
 * The far end of the landing page's one action.
 *
 * A visitor arrives here with a file and leaves with the summary and the ranked
 * flags. There is no sign-in on the way in, nothing is saved on the way out, and
 * the page says both of those before asking for the file rather than after.
 */
export default function TryPage() {
  return (
    <>
      <header className="nav">
        <a className="wordmark" href="/">
          <span className="wordmark-bar" aria-hidden="true" />
          Redline
        </a>
        <a className="action action-compact" href="/sign-in">
          Sign in
        </a>
      </header>

      <main>
        <section className="try-head" aria-labelledby="try-heading">
          <h1 id="try-heading">Read an agreement without an account</h1>
          <p className="lede">
            You get the plain-English summary and the clauses that could cost
            you, worst first, each quoting the sentence it came from. Nothing is
            saved: the words stay in this tab.
          </p>
          <p className="try-terms">
            {ANONYMOUS_TRIES_PER_DAY} reads a day from one connection. Redline
            shows what the document says. It doesn’t give legal advice.
          </p>
        </section>

        <TryPanel />
      </main>

      <footer className="footer">
        <span className="wordmark wordmark-quiet">
          <span className="wordmark-bar" aria-hidden="true" />
          Redline
        </span>
        <p>Your document isn’t stored. Close the tab and it’s gone.</p>
      </footer>
    </>
  );
}
