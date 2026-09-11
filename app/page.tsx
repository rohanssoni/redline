import { SampleReview } from "./sample-review";

const TRY_HREF = "/try";

export default function Home() {
  return (
    <>
      <header className="nav">
        <a className="wordmark" href="/">
          <span className="wordmark-bar" aria-hidden="true" />
          Redline
        </a>
        <a className="action action-compact" href={TRY_HREF}>
          Try it on an agreement
        </a>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-heading">
          <h1 id="hero-heading">See which sentences in a client&apos;s agreement could cost you.</h1>
          <p className="lede">
            Redline ranks the clauses that could hurt you, worst first, and quotes the exact sentence
            each one comes from. You can check every flag against your own copy.
          </p>
          <div className="action-row">
            <a className="action" href={TRY_HREF}>
              Try it on an agreement
            </a>
            <div className="action-notes">
              <p>PDF or .docx file. You don&apos;t need an account to try it.</p>
              <p>Redline shows what the document says. It doesn&apos;t give legal advice.</p>
            </div>
          </div>
        </section>

        <SampleReview />

        <section className="checks" aria-labelledby="checks-heading">
          <h2 id="checks-heading">Every flag points at a sentence you can find</h2>
          <div className="checks-list">
            <p>
              Redline quotes each sentence word for word. If it can&apos;t find that sentence in your
              document, the flag isn&apos;t shown.
            </p>
            <p>
              Flags are ranked by what the clause could cost you. The sample&apos;s governing-law line
              is unusual, but it treats both sides the same, so it isn&apos;t flagged.
            </p>
            <p>
              A flag only says &ldquo;could&rdquo; when its sentence can be read more than one way,
              like the undefined &ldquo;reasonable period&rdquo; behind flag 2.
            </p>
          </div>
        </section>

        <section className="limits" aria-labelledby="limits-heading">
          <h2 id="limits-heading">What it doesn&apos;t do</h2>
          <div className="limits-body">
            <p>
              It won&apos;t tell you whether to sign, and it doesn&apos;t give legal advice. If a lawyer
              is going to look at the agreement, you&apos;ll know which sentences to ask about.
            </p>
            <p>
              It reads agreements a client sends a freelancer or independent contractor. Scanned or
              photographed pages won&apos;t work.
            </p>
          </div>
        </section>

        <section className="close" aria-labelledby="close-heading">
          <h2 id="close-heading">Try it on your own agreement</h2>
          <p>
            Without an account you get the summary and the ranked flags. Nothing is saved unless you
            sign up.
          </p>
          <p>
            With an account, Redline also drafts a counter-offer for each flag, answers questions using
            only the document, flags anything that crosses red lines you set, and keeps a library of
            what you&apos;ve read.
          </p>
          <div className="action-row">
            <a className="action" href={TRY_HREF}>
              Try it on an agreement
            </a>
            <div className="action-notes">
              <p>Redline shows what the document says. It doesn&apos;t give legal advice.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span className="wordmark wordmark-quiet">
          <span className="wordmark-bar" aria-hidden="true" />
          Redline
        </span>
        <p>The agreement on this page is a sample written for it.</p>
      </footer>
    </>
  );
}
