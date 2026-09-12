import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** What a flag or gap costs the reader if it fires (CONTEXT.md: severity). */
export type SeverityBand = 'high' | 'medium' | 'low';

/** How sure the analysis is that the clause actually harms the reader (ADR-0006). */
export type HarmConfidence = 'full' | 'partial';

/** A clause capable of harming the reader, bound to its source sentence (ADR-0001). */
export interface FixtureFlag {
  id: string;
  clauseType: string;
  /** Verbatim from the fixture text. Verified by fixtures.test.ts. */
  sourceSentence: string;
  severity: number;
  band: SeverityBand;
  explanation: string;
  /** True only where the sentence's own wording is open to two readings (ADR-0010). */
  textualAmbiguity: boolean;
  harmConfidence: HarmConfidence;
  /** False where ADR-0004's plausibility filter would drop the clause on its own. */
  plausible: boolean;
}

/** A term the agreement does not contain. Has no source sentence (ADR-0005). */
export interface FixtureGap {
  id: string;
  severity: number;
  band: SeverityBand;
  statement: string;
}

/** A clause planted to check a filtering rule rather than to produce a flag. */
export interface FixtureDecoy {
  sourceSentence: string;
  why: string;
}

export interface AmbiguousDecoy extends FixtureDecoy {
  readingA: string;
  readingB: string;
}

export interface RedLineOnlyDecoy extends FixtureDecoy {
  /** The reader's red line, in the reader's own words (ADR-0015). */
  redLine: string;
}

export interface FixtureDecoys {
  /** Non-standard but symmetric: dropped entirely, never ranked low (ADR-0004). */
  symmetricUnusual?: FixtureDecoy;
  /** The one clause allowed to produce hedged flag wording (ADR-0010). */
  textuallyAmbiguous?: AmbiguousDecoy;
  /** Plainly worded, uncertain for some other reason: never hedged (ADR-0010). */
  nonTextualLowConfidence?: FixtureDecoy;
  /** Flags only because it violates a stated red line (ADR-0013). */
  redLineOnly?: RedLineOnlyDecoy;
}

export interface FixtureSidecar {
  name: string;
  textFile: string;
  summary: string;
  cleanRead: boolean;
  flags: FixtureFlag[];
  gaps: FixtureGap[];
  decoys: FixtureDecoys;
  redLines: string[];
}

export interface LoadedFixture {
  text: string;
  sidecar: FixtureSidecar;
}

const fixturesDir = dirname(fileURLToPath(import.meta.url));

function loadFixture(sidecarFile: string): LoadedFixture {
  const sidecar = JSON.parse(
    readFileSync(join(fixturesDir, sidecarFile), 'utf8'),
  ) as FixtureSidecar;
  const text = readFileSync(join(fixturesDir, sidecar.textFile), 'utf8');
  return { text, sidecar };
}

/** The one-sided agreement: flags, gaps, and every planted decoy. */
export function loadAdhesionFixture(): LoadedFixture {
  return loadFixture('adhesion-agreement.json');
}

/** The balanced agreement: a clean read, no flags, no gaps. */
export function loadCleanFixture(): LoadedFixture {
  return loadFixture('clean-agreement.json');
}

/** Every decoy present on a fixture, as a list. */
export function decoyList(decoys: FixtureDecoys): FixtureDecoy[] {
  return Object.values(decoys).filter(
    (decoy): decoy is FixtureDecoy => decoy !== undefined,
  );
}
