import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture, loadCleanFixture } from '../../tests/fixtures';
import { verifyGaps } from './gap';
import { verifyFlags, type Flag } from './verified-flag';
import { cleanReadFor } from './clean-read';
import { SEVERITY_THRESHOLD, clearsSeverityThreshold } from './ranking';

/** The flag stage, run for real against a fixture's own sentences. */
function flagStage(sourceSentences: Array<{ sentence: string; severity: number }>, text: string) {
  const proposed: Flag[] = sourceSentences.map(({ sentence, severity }, index) => ({
    id: `flag-${index}`,
    clauseType: 'unilateral change',
    sourceSentence: sentence,
    severity,
    band: 'high',
    explanation: 'This lets the other side move what you are owed after you sign.',
    textualAmbiguity: false,
    harmConfidence: 'full',
  }));
  return verifyFlags(proposed, text);
}

describe('the severity threshold', () => {
  it('is a named bar that lets the low band through', () => {
    expect(clearsSeverityThreshold(SEVERITY_THRESHOLD)).toBe(true);
    expect(clearsSeverityThreshold(SEVERITY_THRESHOLD - 1)).toBe(false);
    expect(clearsSeverityThreshold(0)).toBe(false);
    expect(SEVERITY_THRESHOLD).toBeGreaterThan(0);
    expect(SEVERITY_THRESHOLD).toBeLessThan(35);
  });
});

describe('cleanReadFor', () => {
  it('is a clean read when both stages ran and neither found anything', () => {
    const { text, sidecar } = loadCleanFixture();

    const cleanRead = cleanReadFor({
      summary: sidecar.summary,
      flagCheck: flagStage([], text),
      gapCheck: verifyGaps([], text),
    });

    expect(cleanRead).not.toBeNull();
    expect(cleanRead?.threshold).toBe(SEVERITY_THRESHOLD);
  });

  it('is not a clean read when a flag cleared the threshold', () => {
    const { text, sidecar } = loadAdhesionFixture();
    const worst = sidecar.flags[0];

    const cleanRead = cleanReadFor({
      summary: sidecar.summary,
      flagCheck: flagStage(
        [{ sentence: worst.sourceSentence, severity: worst.severity }],
        text,
      ),
      gapCheck: verifyGaps([], text),
    });

    expect(cleanRead).toBeNull();
  });

  it('is not a clean read when only a gap cleared the threshold', () => {
    const { text, sidecar } = loadAdhesionFixture();
    const gap = sidecar.gaps[0];

    const cleanRead = cleanReadFor({
      summary: sidecar.summary,
      flagCheck: flagStage([], text),
      gapCheck: verifyGaps(
        [
          {
            id: gap.id,
            statement: gap.statement,
            severity: gap.severity,
            band: gap.band,
            explanation: gap.explanation,
          },
        ],
        text,
      ),
    });

    expect(cleanRead).toBeNull();
  });

  it('is a clean read when what came back sat under the threshold', () => {
    const { text, sidecar } = loadAdhesionFixture();
    const worst = sidecar.flags[0];

    const cleanRead = cleanReadFor({
      summary: sidecar.summary,
      flagCheck: flagStage(
        [{ sentence: worst.sourceSentence, severity: SEVERITY_THRESHOLD - 1 }],
        text,
      ),
      gapCheck: verifyGaps([], text),
    });

    expect(cleanRead).not.toBeNull();
  });

  it('refuses a read with no summary, because a clean read still shows one', () => {
    const { text } = loadCleanFixture();

    expect(
      cleanReadFor({
        summary: '   ',
        flagCheck: flagStage([], text),
        gapCheck: verifyGaps([], text),
      }),
    ).toBeNull();
  });

  it('cannot be handed stages that did not run', () => {
    // Both arguments are branded by unexported symbols, so the shapes a caller
    // in a catch block could reach for do not typecheck. The casts below are the
    // test admitting that: without them this file would not compile, which is
    // the guarantee. At runtime the values still behave, so the check is that
    // the type system is the thing standing in the way and not a runtime guess.
    const emptyFlagCheck = { flags: [], dropped: [] };
    const emptyGapCheck = { gaps: [], dropped: [] };

    // @ts-expect-error a VerificationOutcome cannot be written outside verifyFlags
    const flagCheck: Parameters<typeof cleanReadFor>[0]['flagCheck'] = emptyFlagCheck;
    // @ts-expect-error a GapCheckOutcome cannot be written outside verifyGaps
    const gapCheck: Parameters<typeof cleanReadFor>[0]['gapCheck'] = emptyGapCheck;

    expect(flagCheck.flags).toEqual([]);
    expect(gapCheck.gaps).toEqual([]);
  });

  it('cannot be written by hand, only returned', () => {
    const { text, sidecar } = loadCleanFixture();
    const real = cleanReadFor({
      summary: sidecar.summary,
      flagCheck: flagStage([], text),
      gapCheck: verifyGaps([], text),
    });

    // @ts-expect-error a CleanRead is branded; a plain object is not one
    const forged: typeof real = { threshold: SEVERITY_THRESHOLD };

    expect(forged?.threshold).toBe(real?.threshold);
  });
});
