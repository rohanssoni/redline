import { describe, expect, it } from 'vitest';
import {
  decoyList,
  loadAdhesionFixture,
  loadCleanFixture,
  type FixtureGap,
  type LoadedFixture,
  type SeverityBand,
} from './index';

function expectedBand(severity: number): SeverityBand {
  if (severity >= 67) return 'high';
  if (severity >= 34) return 'medium';
  return 'low';
}

const fixtures: Array<[string, () => LoadedFixture]> = [
  ['adhesion', loadAdhesionFixture],
  ['clean', loadCleanFixture],
];

describe.each(fixtures)('%s fixture', (_name, load) => {
  it('quotes every flag source sentence verbatim from the text', () => {
    const { text, sidecar } = load();
    for (const flag of sidecar.flags) {
      expect(flag.sourceSentence.length).toBeGreaterThan(0);
      expect(text).toContain(flag.sourceSentence);
    }
  });

  it('quotes every decoy source sentence verbatim from the text', () => {
    const { text, sidecar } = load();
    for (const decoy of decoyList(sidecar.decoys)) {
      expect(decoy.sourceSentence.length).toBeGreaterThan(0);
      expect(text).toContain(decoy.sourceSentence);
    }
  });

  it('gives no gap a source sentence', () => {
    const { sidecar } = load();
    for (const gap of sidecar.gaps) {
      expect(Object.keys(gap)).not.toContain('sourceSentence');
      expect(gap as FixtureGap & { sourceSentence?: unknown }).not.toHaveProperty(
        'sourceSentence',
      );
    }
  });

  it('bands every flag and gap to match its severity', () => {
    const { sidecar } = load();
    for (const item of [...sidecar.flags, ...sidecar.gaps]) {
      expect(item.severity).toBeGreaterThanOrEqual(0);
      expect(item.severity).toBeLessThanOrEqual(100);
      expect(item.band).toBe(expectedBand(item.severity));
    }
  });

  it('gives every flag and gap a distinct severity', () => {
    const { sidecar } = load();
    const severities = [...sidecar.flags, ...sidecar.gaps].map((i) => i.severity);
    expect(new Set(severities).size).toBe(severities.length);
  });

  it('gives every flag and gap a distinct id', () => {
    const { sidecar } = load();
    const ids = [...sidecar.flags, ...sidecar.gaps].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('adhesion fixture', () => {
  it('carries at least four flags', () => {
    const { sidecar } = loadAdhesionFixture();
    expect(sidecar.flags.length).toBeGreaterThanOrEqual(4);
    expect(sidecar.cleanRead).toBe(false);
  });

  it('marks exactly one flag textually ambiguous, and it is the ambiguous decoy', () => {
    const { sidecar } = loadAdhesionFixture();
    const hedged = sidecar.flags.filter((flag) => flag.textualAmbiguity);
    expect(hedged).toHaveLength(1);
    expect(hedged[0].sourceSentence).toBe(
      sidecar.decoys.textuallyAmbiguous?.sourceSentence,
    );
  });

  it('never flags the symmetric unusual decoy', () => {
    const { sidecar } = loadAdhesionFixture();
    const symmetric = sidecar.decoys.symmetricUnusual?.sourceSentence;
    expect(symmetric).toBeDefined();
    expect(sidecar.flags.map((flag) => flag.sourceSentence)).not.toContain(symmetric);
  });

  it('states the plainly-worded low-confidence decoy without hedging it', () => {
    const { sidecar } = loadAdhesionFixture();
    const sentence = sidecar.decoys.nonTextualLowConfidence?.sourceSentence;
    expect(sentence).toBeDefined();
    const flag = sidecar.flags.find((f) => f.sourceSentence === sentence);
    expect(flag).toBeDefined();
    expect(flag?.textualAmbiguity).toBe(false);
  });

  it('flags the red-line-only decoy even though the filter would drop it', () => {
    const { sidecar } = loadAdhesionFixture();
    const redLineOnly = sidecar.decoys.redLineOnly;
    expect(redLineOnly).toBeDefined();
    const flag = sidecar.flags.find(
      (f) => f.sourceSentence === redLineOnly?.sourceSentence,
    );
    expect(flag).toBeDefined();
    expect(flag?.plausible).toBe(false);
    expect(sidecar.redLines).toContain(redLineOnly?.redLine);
  });

  it('flags at least one clause on partial confidence', () => {
    const { sidecar } = loadAdhesionFixture();
    expect(
      sidecar.flags.some((flag) => flag.harmConfidence === 'partial'),
    ).toBe(true);
  });

  it('leaves a real late-payment gap in the text', () => {
    const { text, sidecar } = loadAdhesionFixture();
    const latePaymentWording = [
      /late[ -]payment/i,
      /late fee/i,
      /interest on (any )?(overdue|unpaid|late)/i,
      /overdue/i,
      /past due/i,
      /per month on the unpaid/i,
      /\d\s*%\s*per (month|annum)/i,
    ];
    for (const pattern of latePaymentWording) {
      expect(text).not.toMatch(pattern);
    }
    expect(sidecar.gaps.map((gap) => gap.id)).toContain('no-late-payment-term');
  });

  it('leaves a real liability-cap gap in the text', () => {
    const { text, sidecar } = loadAdhesionFixture();
    for (const pattern of [
      /limitation of liability/i,
      /total liability/i,
      /aggregate liability/i,
      /liability .{0,40}(shall|is) (not exceed|limited)/i,
    ]) {
      expect(text).not.toMatch(pattern);
    }
    expect(sidecar.gaps.map((gap) => gap.id)).toContain('no-liability-cap');
  });
});

describe('clean fixture', () => {
  it('reads clean, with no flags and no gaps', () => {
    const { sidecar } = loadCleanFixture();
    expect(sidecar.flags).toHaveLength(0);
    expect(sidecar.gaps).toHaveLength(0);
    expect(sidecar.cleanRead).toBe(true);
    expect(decoyList(sidecar.decoys)).toHaveLength(0);
  });

  it('carries two red lines the document does not violate', () => {
    const { sidecar } = loadCleanFixture();
    expect(sidecar.redLines).toHaveLength(2);
    for (const redLine of sidecar.redLines) {
      expect(redLine.length).toBeGreaterThan(0);
    }
  });

  it('states a payment deadline and a liability cap in the text', () => {
    const { text } = loadCleanFixture();
    expect(text).toMatch(/within fifteen days of receiving it/);
    expect(text).toMatch(/total liability under this Agreement/);
  });

  it('is a different engagement, not a stripped-down copy of the adhesion one', () => {
    const { text } = loadCleanFixture();
    const { text: adhesionText } = loadAdhesionFixture();
    expect(text).not.toContain('Halverson Brands');
    expect(adhesionText).not.toContain('Pemberton Instruments');
  });
});

describe('both fixtures', () => {
  it('gives each a summary in plain language', () => {
    for (const [, load] of fixtures) {
      const { sidecar } = load();
      expect(sidecar.summary.split('. ').length).toBeGreaterThanOrEqual(3);
    }
  });
});
