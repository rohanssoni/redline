// PROTOTYPE, throw away. Three ways to keep the ranked list and the marked-up
// page in step, on one throwaway route, switchable with ?variant=A|B|C.
// Data is one real read of a fictional test agreement (fixture.json).
// Not linked from anywhere, and refused in production builds.

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import '../../try/try.css';
import './prototype.css';
import { FlagSyncPrototype } from './variants';

export default function FlagSyncPrototypePage() {
  if (process.env.NODE_ENV === 'production') notFound();

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
        <Suspense>
          <FlagSyncPrototype />
        </Suspense>
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
