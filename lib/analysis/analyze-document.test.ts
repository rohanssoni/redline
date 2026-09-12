import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture, loadCleanFixture } from '../../tests/fixtures';
import {
  createStubModelClient,
  proposedFlagsFor,
  stubModelClientFor,
} from '../../tests/support/stub-model-client';
import type { ArraySchema, ObjectSchema } from '../model/json-schema';
import { ModelCallError, ModelOutputError } from '../model/client';
import { analyzeDocument } from './analyze-document';
import { SEVERITY_THRESHOLD, bandFor, rankFindings } from './ranking';
import { AnalysisError } from './types';

describe('analyzeDocument, summary stage', () => {
  it('returns the summary the model produced for the document it was given', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    const result = await analyzeDocument(text, sidecar.redLines, { model });

    expect(result.summary).toBe(sidecar.summary);
  });

  it('summarises each document from its own text', async () => {
    const adhesion = loadAdhesionFixture();
    const clean = loadCleanFixture();

    const adhesionResult = await analyzeDocument(adhesion.text, [], {
      model: stubModelClientFor(adhesion.sidecar),
    });
    const cleanResult = await analyzeDocument(clean.text, [], {
      model: stubModelClientFor(clean.sidecar),
    });

    expect(adhesionResult.summary).toBe(adhesion.sidecar.summary);
    expect(cleanResult.summary).toBe(clean.sidecar.summary);
    expect(adhesionResult.summary).not.toBe(cleanResult.summary);
  });

  it('sends the document text to the model as structured output', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    await analyzeDocument(text, sidecar.redLines, { model });

    const request = model.calls[0];
    expect(request.name).toBe('document_summary');
    expect(request.schema.required).toContain('summary');
    expect(request.schema.additionalProperties).toBe(false);

    const sent = request.messages.map((message) => message.content).join('\n');
    for (const flag of sidecar.flags) {
      expect(sent).toContain(flag.sourceSentence);
    }
  });

  it('refuses a reply that is not the shape the schema asked for', async () => {
    const { text, sidecar } = loadCleanFixture();
    const model = createStubModelClient({
      document_summary: { summary: 42, severity: 'high' },
      document_flags: { flags: [] },
      document_gaps: { gaps: [] },
    });

    await expect(
      analyzeDocument(text, sidecar.redLines, { model }),
    ).rejects.toBeInstanceOf(ModelOutputError);
  });

  it('refuses a document with nothing in it to read, without calling the model', async () => {
    const model = createStubModelClient({
      document_summary: { summary: 'x' },
      document_flags: { flags: [] },
      document_gaps: { gaps: [] },
    });

    await expect(analyzeDocument('   \n\n  \f ', [], { model })).rejects.toBeInstanceOf(
      AnalysisError,
    );
    expect(model.calls).toHaveLength(0);
  });

  it('lets a failed model call surface rather than returning a clean read', async () => {
    const { text, sidecar } = loadCleanFixture();
    const model = stubModelClientFor(sidecar);
    model.fail('document_summary', 'OpenRouter is unreachable');

    await expect(analyzeDocument(text, [], { model })).rejects.toThrow(
      /unreachable/,
    );
  });
});

describe('analyzeDocument, flag stage', () => {
  it('drops a fabricated quote and a tidied-up one, and keeps the copied one', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const real = sidecar.flags[0];
    const tidied = sidecar.flags[1];
    const fabricated =
      'Contractor waives every right to payment for work Client later decides it does not want.';
    const model = stubModelClientFor(sidecar);
    model.reply('document_flags', {
      flags: [
        proposal(real.sourceSentence, { id: 'copied-word-for-word' }),
        proposal(fabricated, { id: 'invented-sentence' }),
        proposal(
          `${tidied.sourceSentence.replace(', in its sole discretion,', ' in its sole discretion').slice(0, -1)}!`,
          { id: 'tidied-up-sentence' },
        ),
      ],
    });

    const result = await analyzeDocument(text, [], { model });

    expect(result.flags.map((flag) => flag.id)).toEqual(['copied-word-for-word']);
    expect(result.flags[0].sourceSentence).toBe(real.sourceSentence);
    for (const flag of result.flags) {
      expect(text).toContain(flag.sourceSentence);
    }
  });

  it('shows the document’s own wording when the quote came back rewrapped', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const planted = sidecar.flags[2];
    const model = stubModelClientFor(sidecar);
    model.reply('document_flags', {
      flags: [proposal(planted.sourceSentence.split(' ').join('\n'), { id: 'rewrapped' })],
    });

    const result = await analyzeDocument(text, [], { model });

    expect(result.flags[0].sourceSentence).toBe(planted.sourceSentence);
  });

  it('leaves out the unusual but even-handed clause rather than ranking it low', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const symmetric = sidecar.decoys.symmetricUnusual;
    expect(symmetric).toBeDefined();

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    expect(text).toContain(symmetric?.sourceSentence);
    expect(
      result.flags.some(
        (flag) => flag.sourceSentence === symmetric?.sourceSentence,
      ),
    ).toBe(false);
  });

  it('still flags a citable clause the reading is only partly confident about', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const partial = sidecar.flags.filter(
      (flag) => flag.harmConfidence === 'partial' && flag.plausible !== false,
    );
    expect(partial.length).toBeGreaterThan(0);

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    for (const flag of partial) {
      const shown = result.flags.find((each) => each.id === flag.id);
      expect(shown?.sourceSentence).toBe(flag.sourceSentence);
      expect(shown?.harmConfidence).toBe('partial');
    }
  });

  it('leaves out the clause that only a red line would catch, when none is set', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const redLineOnly = sidecar.flags.filter((flag) => flag.plausible === false);
    expect(redLineOnly.length).toBeGreaterThan(0);

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    expect(result.flags.map((flag) => flag.id)).toEqual(
      sidecar.flags
        .filter((flag) => flag.plausible !== false)
        .map((flag) => flag.id),
    );
  });

  it('ranks the flags by what they cost the reader, worst first', async () => {
    const { text, sidecar } = loadAdhesionFixture();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    const severities = result.flags.map((flag) => flag.severity);
    expect(severities).toEqual([...severities].sort((a, b) => b - a));
    expect(result.flags[0].id).toBe('uncapped-indemnity');
    expect(result.flags.map((flag) => flag.band)).toEqual(
      result.flags.map((flag) => bandFor(flag.severity)),
    );
  });

  it('gives every flag a sentence, an explanation and a severity', async () => {
    const { text, sidecar } = loadAdhesionFixture();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    expect(result.flags.length).toBeGreaterThan(0);
    for (const flag of result.flags) {
      expect(flag.sourceSentence.trim().length).toBeGreaterThan(0);
      expect(flag.explanation.trim().length).toBeGreaterThan(0);
      expect(flag.severity).toBeGreaterThanOrEqual(0);
      expect(flag.severity).toBeLessThanOrEqual(100);
      expect(['high', 'medium', 'low']).toContain(flag.band);
    }
  });

  it('sends the document to the flag stage as structured output of its own', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    await analyzeDocument(text, sidecar.redLines, { model });

    expect(model.calls.map((call) => call.name)).toEqual([
      'document_summary',
      'document_flags',
      'document_gaps',
      'red_line_matches',
    ]);
    const request = model.calls[1];
    expect(request.schema.required).toContain('flags');
    expect(request.schema.additionalProperties).toBe(false);
    expect(request.messages.map((message) => message.content).join('\n')).toContain(
      sidecar.flags[0].sourceSentence,
    );
  });

  it('finds nothing to flag in an agreement with nothing one-sided in it', async () => {
    const { text, sidecar } = loadCleanFixture();

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    expect(result.flags).toEqual([]);
    expect(result.summary).toBe(sidecar.summary);
  });

  it('lets a failed flag call surface rather than returning a document with no flags', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);
    model.fail('document_flags', 'OpenRouter is unreachable');

    await expect(analyzeDocument(text, [], { model })).rejects.toThrow(/unreachable/);
  });
});

describe('analyzeDocument, hedged wording', () => {
  /** Everything of a flag the reader reads, the hedge included. */
  function wordingOf(flag: { explanation: string; ambiguity?: { hedge: string } }) {
    return [flag.explanation, flag.ambiguity?.hedge ?? ''].join(' ');
  }

  it('hedges the clause whose sentence reads two ways, and shows the reader both', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const ambiguous = sidecar.decoys.textuallyAmbiguous;
    expect(ambiguous).toBeDefined();

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    const shown = result.flags.find(
      (flag) => flag.sourceSentence === ambiguous?.sourceSentence,
    );
    expect(shown).toBeDefined();
    expect(wordingOf(shown!)).toMatch(/could be read two ways/i);
    expect(wordingOf(shown!)).toContain(ambiguous?.readingA);
    expect(wordingOf(shown!)).toContain(ambiguous?.readingB);
    expect(shown?.textualAmbiguity).toBe(true);
  });

  it('states the clause nobody is sure a court would allow plainly, and never hedges it', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const uncertain = sidecar.decoys.nonTextualLowConfidence;
    expect(uncertain).toBeDefined();

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    const shown = result.flags.find(
      (flag) => flag.sourceSentence === uncertain?.sourceSentence,
    );
    expect(shown).toBeDefined();
    expect(shown?.harmConfidence).toBe('partial');
    expect(shown?.ambiguity).toBeUndefined();
    expect(shown?.textualAmbiguity).toBe(false);
    expect(wordingOf(shown!)).not.toMatch(
      /\b(could|may|might|possibly|arguably|probably|likely|unclear)\b/i,
    );
  });

  it('hedges nothing else in the document, however unsure the reading is', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const ambiguous = sidecar.decoys.textuallyAmbiguous;

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    const hedged = result.flags.filter((flag) => flag.ambiguity);
    expect(hedged.map((flag) => flag.sourceSentence)).toEqual([
      ambiguous?.sourceSentence,
    ]);
    for (const flag of result.flags) {
      // Every hedge carries the two readings it rests on, so there is no wording
      // the reader is asked to take on trust.
      if (!flag.ambiguity) continue;
      expect(flag.ambiguity.readings).toHaveLength(2);
      for (const reading of flag.ambiguity.readings) {
        expect(flag.ambiguity.hedge).toContain(reading);
      }
    }
  });

  it('words a clause plainly when the model claims ambiguity with no second reading', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const ambiguous = sidecar.decoys.textuallyAmbiguous;
    const model = stubModelClientFor(sidecar);
    model.reply('document_flags', {
      flags: [
        proposal(ambiguous!.sourceSentence, {
          id: 'claims-ambiguity-shows-none',
          textualAmbiguity: true,
          alternativeReadings: [],
        }),
      ],
    });

    const result = await analyzeDocument(text, [], { model });

    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].ambiguity).toBeUndefined();
    expect(result.flags[0].textualAmbiguity).toBe(false);
    expect(result.flags[0].explanation.trim().length).toBeGreaterThan(0);
  });

  it('takes a hedge about enforcement out of the wording and keeps the flag', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const uncertain = sidecar.decoys.nonTextualLowConfidence;
    const planted = sidecar.flags.find(
      (flag) => flag.sourceSentence === uncertain?.sourceSentence,
    );
    const model = stubModelClientFor(sidecar);
    model.reply('document_flags', {
      flags: [
        proposal(uncertain!.sourceSentence, {
          id: 'hedged-about-a-court',
          explanation: `${planted?.explanation} A court might well decline to enforce something this wide.`,
        }),
      ],
    });

    const result = await analyzeDocument(text, [], { model });

    expect(result.flags.map((flag) => flag.id)).toEqual(['hedged-about-a-court']);
    expect(result.flags[0].explanation).toBe(planted?.explanation);
    expect(result.flags[0].explanation).not.toMatch(/court/i);
    expect(result.flags[0].ambiguity).toBeUndefined();
  });

  it('drops a flag that had nothing to say beyond how a court might treat it', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const worst = sidecar.flags[0];
    const model = stubModelClientFor(sidecar);
    model.reply('document_flags', {
      flags: [
        proposal(worst.sourceSentence, {
          id: 'nothing-but-a-hedge',
          explanation:
            'A court would probably not enforce an indemnity this wide. It is unclear whether anyone tries to in practice.',
        }),
        proposal(sidecar.flags[1].sourceSentence, { id: 'says-what-it-does' }),
      ],
    });

    const result = await analyzeDocument(text, [], { model });

    expect(result.flags.map((flag) => flag.id)).toEqual(['says-what-it-does']);
  });

  it('asks the model for ambiguity and harm confidence as two separate answers', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    await analyzeDocument(text, [], { model });

    const item = (model.calls[1].schema.properties.flags as ArraySchema)
      .items as ObjectSchema;
    expect(item.required).toContain('textualAmbiguity');
    expect(item.required).toContain('harmConfidence');
    expect(item.required).toContain('alternativeReadings');
    expect(item.properties.textualAmbiguity.type).toBe('boolean');
    expect(item.properties.harmConfidence.type).toBe('string');
    expect(item.properties.alternativeReadings.type).toBe('array');
  });
});

describe('analyzeDocument, gap stage', () => {
  it('returns the terms the agreement leaves out, each as a whole-document claim', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    expect(sidecar.gaps.length).toBeGreaterThan(0);

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    expect(result.gaps.map((gap) => gap.id)).toEqual(
      [...sidecar.gaps]
        .sort((a, b) => b.severity - a.severity)
        .map((gap) => gap.id),
    );
    for (const gap of result.gaps) {
      expect(gap.statement.trim().length).toBeGreaterThan(0);
      expect(gap.explanation.trim().length).toBeGreaterThan(0);
      expect(gap.band).toBe(bandFor(gap.severity));
    }
  });

  it('sends the document to the gap stage as structured output with no place for a quote', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    await analyzeDocument(text, sidecar.redLines, { model });

    const request = model.calls[2];
    expect(request.name).toBe('document_gaps');
    expect(request.schema.required).toContain('gaps');
    expect(request.schema.additionalProperties).toBe(false);

    const item = (request.schema.properties.gaps as ArraySchema).items as ObjectSchema;
    expect(Object.keys(item.properties)).not.toContain('sourceSentence');
    expect(item.additionalProperties).toBe(false);
    expect(request.messages.map((message) => message.content).join('\n')).toContain(
      sidecar.flags[0].sourceSentence,
    );
  });

  it('never gives a gap a source sentence, and never puts one in flags[]', async () => {
    const { text, sidecar } = loadAdhesionFixture();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    const gapIds = sidecar.gaps.map((gap) => gap.id);
    expect(gapIds.length).toBeGreaterThan(0);
    for (const gap of result.gaps) {
      expect(gap).not.toHaveProperty('sourceSentence');
      expect(Object.keys(gap)).not.toContain('sourceSentence');
    }
    for (const id of gapIds) {
      expect(result.flags.map((flag) => flag.id)).not.toContain(id);
    }
    for (const statement of sidecar.gaps.map((gap) => gap.statement)) {
      expect(result.flags.map((flag) => flag.sourceSentence)).not.toContain(
        statement,
      );
    }
  });

  it('keeps a gap a gap when it is the worst thing in the document', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const worstFlag = Math.max(...sidecar.flags.map((flag) => flag.severity));
    const model = stubModelClientFor(sidecar);
    model.reply('document_gaps', {
      gaps: [
        {
          id: 'no-late-payment-term',
          statement: sidecar.gaps[0].statement,
          severity: 100,
          explanation: sidecar.gaps[0].explanation,
        },
      ],
    });

    const result = await analyzeDocument(text, sidecar.redLines, { model });

    const findings = rankFindings(result.flags, result.gaps);
    expect(findings[0].kind).toBe('gap');
    expect(findings[0].severity).toBeGreaterThan(worstFlag);
    expect(result.gaps[0]).not.toHaveProperty('sourceSentence');
    expect(result.flags.map((flag) => flag.id)).not.toContain(
      'no-late-payment-term',
    );
    for (const flag of result.flags) {
      expect(text).toContain(flag.sourceSentence);
    }
  });

  it('interleaves flags and gaps in one list, worst first', async () => {
    const { text, sidecar } = loadAdhesionFixture();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    const findings = rankFindings(result.flags, result.gaps);
    const severities = findings.map((finding) => finding.severity);
    expect(severities).toEqual([...severities].sort((a, b) => b - a));
    expect(findings.map((finding) => finding.rank)).toEqual(
      findings.map((_, index) => index + 1),
    );
    // Not grouped: the ranked list has to actually mix the two kinds here, or
    // the ordering claim is untested.
    const kinds = findings.map((finding) => finding.kind);
    expect(kinds).toContain('flag');
    expect(kinds).toContain('gap');
    expect(kinds.lastIndexOf('flag')).toBeGreaterThan(kinds.indexOf('gap'));
  });

  it('drops a gap that quotes the agreement instead of saying what is absent', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);
    model.reply('document_gaps', {
      gaps: [
        {
          id: 'quoting-gap',
          statement: sidecar.flags[0].sourceSentence,
          severity: 90,
          explanation: sidecar.gaps[0].explanation,
        },
        {
          id: 'real-gap',
          statement: sidecar.gaps[0].statement,
          severity: 70,
          explanation: sidecar.gaps[0].explanation,
        },
      ],
    });

    const result = await analyzeDocument(text, sidecar.redLines, { model });

    expect(result.gaps.map((gap) => gap.id)).toEqual(['real-gap']);
  });

  it('finds nothing missing in an agreement that covers its terms', async () => {
    const { text, sidecar } = loadCleanFixture();

    const result = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    expect(result.gaps).toEqual([]);
    expect(result.flags).toEqual([]);
  });

  it('lets a failed gap call surface rather than returning a document with no gaps', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);
    model.fail('document_gaps', 'OpenRouter is unreachable');

    await expect(analyzeDocument(text, [], { model })).rejects.toThrow(/unreachable/);
  });
});

describe('analyzeDocument, the clean read', () => {
  it('returns a clean read for an agreement with nothing in it above the threshold', async () => {
    const { text, sidecar } = loadCleanFixture();
    expect(sidecar.cleanRead).toBe(true);

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    expect(result.cleanRead).not.toBeNull();
    expect(result.cleanRead?.threshold).toBe(SEVERITY_THRESHOLD);
    expect(result.flags).toEqual([]);
    expect(result.gaps).toEqual([]);
  });

  it('still shows the plain-English summary on a clean read', async () => {
    const { text, sidecar } = loadCleanFixture();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    expect(result.cleanRead).not.toBeNull();
    expect(result.summary).toBe(sidecar.summary);
    expect(result.summary.trim().length).toBeGreaterThan(0);
  });

  it('does not return a clean read for the one-sided agreement', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    expect(sidecar.cleanRead).toBe(false);

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    expect(result.cleanRead).toBeNull();
    expect(result.flags.length).toBeGreaterThan(0);
  });

  it('leaves out what sits under the severity threshold, and clean-reads what is left', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const worst = sidecar.flags[0];
    const model = stubModelClientFor(sidecar);
    model.reply('document_flags', {
      flags: [
        proposal(worst.sourceSentence, {
          id: 'barely-worth-mentioning',
          severity: SEVERITY_THRESHOLD - 1,
        }),
      ],
    });
    model.reply('document_gaps', {
      gaps: [
        {
          id: 'barely-missing',
          statement: sidecar.gaps[0].statement,
          severity: SEVERITY_THRESHOLD - 1,
          explanation: sidecar.gaps[0].explanation,
        },
      ],
    });

    const result = await analyzeDocument(text, [], { model });

    expect(result.flags).toEqual([]);
    expect(result.gaps).toEqual([]);
    expect(result.cleanRead).not.toBeNull();
  });

  it('keeps a finding that lands exactly on the threshold, and is then not clean', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const worst = sidecar.flags[0];
    const model = stubModelClientFor(sidecar);
    model.reply('document_flags', {
      flags: [
        proposal(worst.sourceSentence, {
          id: 'on-the-line',
          severity: SEVERITY_THRESHOLD,
        }),
      ],
    });
    model.reply('document_gaps', { gaps: [] });

    const result = await analyzeDocument(text, [], { model });

    expect(result.flags.map((flag) => flag.id)).toEqual(['on-the-line']);
    expect(result.cleanRead).toBeNull();
  });

  it('surfaces a model that cannot be reached, at every stage, rather than a clean read', async () => {
    const { text, sidecar } = loadCleanFixture();

    for (const stage of ['document_summary', 'document_flags', 'document_gaps']) {
      const model = stubModelClientFor(sidecar);
      model.fail(stage, 'OpenRouter is unreachable');

      const outcome = await analyzeDocument(text, [], { model }).then(
        (result) => result,
        (error: unknown) => error,
      );

      expect(outcome).toBeInstanceOf(ModelCallError);
      expect(outcome).not.toHaveProperty('cleanRead');
    }
  });

  it('surfaces malformed model output, at every stage, rather than a clean read', async () => {
    const { text, sidecar } = loadCleanFixture();
    // What each stage would have to send back to be a clean read, wrecked one
    // stage at a time: the wrong type, then a required key missing, then an
    // array where an object belongs.
    const malformed: Record<string, unknown> = {
      document_summary: { summary: 17 },
      document_flags: { gaps: [] },
      document_gaps: [],
    };

    for (const [stage, payload] of Object.entries(malformed)) {
      const model = stubModelClientFor(sidecar);
      model.reply(stage, payload);

      const outcome = await analyzeDocument(text, [], { model }).then(
        (result) => result,
        (error: unknown) => error,
      );

      expect(outcome).toBeInstanceOf(ModelOutputError);
      expect(outcome).not.toHaveProperty('cleanRead');
    }
  });

  it('does not call a later stage once an earlier one has failed', async () => {
    const { text, sidecar } = loadCleanFixture();
    const model = stubModelClientFor(sidecar);
    model.fail('document_flags', 'OpenRouter is unreachable');

    await expect(analyzeDocument(text, [], { model })).rejects.toBeInstanceOf(
      ModelCallError,
    );

    expect(model.calls.map((call) => call.name)).toEqual([
      'document_summary',
      'document_flags',
    ]);
  });
});

describe('analyzeDocument, the red line override', () => {
  /** The clause this fixture plants for the override, and the red line for it. */
  function redLineOnly() {
    const { text, sidecar } = loadAdhesionFixture();
    const caught = sidecar.decoys.redLineOnly;
    expect(caught).toBeDefined();
    const planted = sidecar.flags.find(
      (flag) => flag.sourceSentence === caught?.sourceSentence,
    );
    expect(planted?.plausible).toBe(false);
    return { text, sidecar, caught: caught!, planted: planted! };
  }

  it('flags the clause the plausibility filter drops, once the reader has written the red line', async () => {
    const { text, sidecar, caught } = redLineOnly();

    const withoutRedLines = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });
    const withRedLines = await analyzeDocument(text, [caught.redLine], {
      model: stubModelClientFor(sidecar),
    });

    expect(
      withoutRedLines.flags.map((flag) => flag.sourceSentence),
    ).not.toContain(caught.sourceSentence);
    expect(withRedLines.flags.map((flag) => flag.sourceSentence)).toContain(
      caught.sourceSentence,
    );
  });

  it('flags a red line match that falls under the severity threshold', async () => {
    const { text, sidecar, caught, planted } = redLineOnly();
    const model = stubModelClientFor(sidecar);
    model.reply('red_line_matches', {
      matches: [
        redLineProposal(caught, planted, { severity: SEVERITY_THRESHOLD - 1 }),
      ],
    });

    const result = await analyzeDocument(text, [caught.redLine], { model });

    const shown = result.flags.find(
      (flag) => flag.sourceSentence === caught.sourceSentence,
    );
    expect(shown).toBeDefined();
    expect(shown?.severity).toBe(SEVERITY_THRESHOLD - 1);
    expect(result.cleanRead).toBeNull();
  });

  it('leaves out a red line match whose sentence is not in the document, and marks nothing', async () => {
    const { text, sidecar, caught, planted } = redLineOnly();
    const fabricated =
      'Contractor shall never show, describe, or refer to this work anywhere, in any medium, for any reason.';
    expect(text).not.toContain(fabricated);
    const model = stubModelClientFor(sidecar);
    model.reply('red_line_matches', {
      matches: [
        redLineProposal(caught, planted, {
          id: 'quote-the-document-does-not-have',
          sourceSentence: fabricated,
        }),
      ],
    });

    const result = await analyzeDocument(text, [caught.redLine], { model });

    expect(result.flags.map((flag) => flag.sourceSentence)).not.toContain(
      fabricated,
    );
    expect(result.flags.map((flag) => flag.id)).not.toContain(
      'quote-the-document-does-not-have',
    );
    expect(result.redLineMatches).toEqual([]);
    for (const flag of result.flags) {
      expect(text).toContain(flag.sourceSentence);
    }
  });

  it('matches a clause that is worded nothing like the red line', async () => {
    const { text, sidecar, caught } = redLineOnly();

    const result = await analyzeDocument(text, [caught.redLine], {
      model: stubModelClientFor(sidecar),
    });

    const shown = result.flags.find(
      (flag) => flag.sourceSentence === caught.sourceSentence,
    );
    expect(shown).toBeDefined();
    // Nothing a string match could have found: the reader's wording and the
    // clause's wording have no word of substance in common (ADR-0015).
    expect(sharedWords(caught.redLine, caught.sourceSentence)).toEqual([]);
  });

  it('records which red line caught the flag, and shows the reader an ordinary flag', async () => {
    const { text, sidecar, caught } = redLineOnly();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    const shown = result.flags.find(
      (flag) => flag.sourceSentence === caught.sourceSentence,
    );
    expect(result.redLineMatches).toEqual([
      {
        flagId: shown?.id,
        redLine: caught.redLine,
        sourceSentence: caught.sourceSentence,
      },
    ]);

    // The reader is given no way to tell it apart: same keys as the flags the
    // document's own reading produced, no badge, no note about the match.
    const ordinary = result.flags.find((flag) => flag.id !== shown?.id);
    expect(Object.keys(shown!).sort()).toEqual(Object.keys(ordinary!).sort());
    for (const wording of [shown!.explanation, shown!.clauseType]) {
      expect(wording).not.toContain(caught.redLine);
      expect(wording.toLowerCase()).not.toContain('red line');
    }
  });

  it('carries everything a soft counter-offer is drafted from, like any other flag', async () => {
    const { text, sidecar, caught } = redLineOnly();

    const result = await analyzeDocument(text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    const shown = result.flags.find(
      (flag) => flag.sourceSentence === caught.sourceSentence,
    );
    expect(shown).toBeDefined();
    expect(text).toContain(shown?.sourceSentence);
    expect(shown?.clauseType.trim().length).toBeGreaterThan(0);
    expect(shown?.explanation.trim().length).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(shown?.band);
    expect(shown?.band).toBe(bandFor(shown!.severity));
  });

  it('fires on nothing when the document breaks none of the reader’s red lines', async () => {
    const { text, sidecar, caught } = redLineOnly();
    const unbroken = sidecar.redLines.filter(
      (redLine) => redLine !== caught.redLine,
    );
    expect(unbroken.length).toBeGreaterThan(0);

    const result = await analyzeDocument(text, unbroken, {
      model: stubModelClientFor(sidecar),
    });
    const withoutRedLines = await analyzeDocument(text, [], {
      model: stubModelClientFor(sidecar),
    });

    expect(result.redLineMatches).toEqual([]);
    expect(result.flags.map((flag) => flag.id)).toEqual(
      withoutRedLines.flags.map((flag) => flag.id),
    );
  });

  it('asks nothing of the model about red lines when the reader has written none', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    const result = await analyzeDocument(text, ['   '], { model });

    expect(model.calls.map((call) => call.name)).not.toContain('red_line_matches');
    expect(result.redLineMatches).toEqual([]);
  });

  it('sends the reader’s own words to the red line stage', async () => {
    const { text, sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    await analyzeDocument(text, sidecar.redLines, { model });

    const request = model.calls.find((call) => call.name === 'red_line_matches');
    expect(request).toBeDefined();
    const sent = request!.messages.map((message) => message.content).join('\n');
    for (const redLine of sidecar.redLines) {
      expect(sent).toContain(redLine);
    }
    expect(sent).toContain(sidecar.flags[0].sourceSentence);
  });

  it('drops a match naming a red line the reader never wrote', async () => {
    const { text, sidecar, caught, planted } = redLineOnly();
    const model = stubModelClientFor(sidecar);
    model.reply('red_line_matches', {
      matches: [
        redLineProposal(caught, planted, {
          redLine: 'I will not sign anything printed in a serif typeface.',
        }),
      ],
    });

    const result = await analyzeDocument(text, [caught.redLine], { model });

    expect(result.redLineMatches).toEqual([]);
    expect(result.flags.map((flag) => flag.sourceSentence)).not.toContain(
      caught.sourceSentence,
    );
  });
});

/** One red line match as a model would propose it, from what the fixture says. */
function redLineProposal(
  caught: { redLine: string; sourceSentence: string },
  planted: { id: string; clauseType: string; severity: number; explanation: string },
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: planted.id,
    redLine: caught.redLine,
    clauseType: planted.clauseType,
    sourceSentence: caught.sourceSentence,
    severity: planted.severity,
    explanation: planted.explanation,
    textualAmbiguity: false,
    alternativeReadings: [],
    harmConfidence: 'full',
    ...overrides,
  };
}

/** The words of substance two pieces of wording have in common. */
function sharedWords(one: string, other: string): string[] {
  const wordsOf = (wording: string) =>
    new Set(
      wording
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => word.length > 3),
    );
  const first = wordsOf(one);
  return [...wordsOf(other)].filter((word) => first.has(word));
}

/** One flag as a model would propose it: dangerous, citable, plainly worded. */
function proposal(
  sourceSentence: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const { sidecar } = loadAdhesionFixture();
  const [shape] = proposedFlagsFor(sidecar) as Record<string, unknown>[];
  return { ...shape, sourceSentence, ...overrides };
}
