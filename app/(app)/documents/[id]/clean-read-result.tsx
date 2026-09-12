import type { CleanRead } from '@/lib/analysis/types';

/**
 * The clean read, as its own result on the page (ADR-0008).
 *
 * It takes a `CleanRead` and nothing else. The type cannot be written outside
 * `lib/analysis/clean-read.ts`, and the only thing that makes one is a read where
 * every stage finished, so this component cannot be rendered for an analysis that
 * broke. There is no flag count to check here and no empty array to interpret.
 *
 * The copy says what the read looked for and what it found, and stops. It does
 * not tell the reader to check the document themselves, because a result that
 * takes its own finding back is worth less than no result.
 *
 * The `cleanRead` prop is read by the type checker rather than by the component:
 * holding one is the permission to render this, and nothing here needs to look
 * inside it. The threshold it carries is a number about the analysis, and the
 * reader is owed the finding, not the machinery.
 */
export function CleanReadResult(_permission: { cleanRead: CleanRead }) {
  return (
    <section className="clean-read" aria-labelledby="clean-read-heading">
      <p className="clean-read-label">Clean read</p>
      <h2 id="clean-read-heading">This one reads like a normal agreement</h2>
      <p className="clean-read-body">
        Nothing in it lets the other side change what you earn, owe, own or have
        to do once you have signed.
      </p>
      <p className="clean-read-body">
        Redline also checked for the terms agreements like this leave out: a
        deadline for payment, a ceiling on what you can be made to pay, a limit
        on revisions, a way to end it. None of them is missing.
      </p>
      <p className="clean-read-body">The agreement itself is below.</p>
    </section>
  );
}
