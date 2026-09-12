import { describe, expect, it } from 'vitest';
import { checkAgainstSchema, type ObjectSchema } from './json-schema';

const flagSchema: ObjectSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string', minLength: 10 },
    flags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceSentence: { type: 'string', minLength: 1 },
          severity: { type: 'integer', minimum: 0, maximum: 100 },
          band: { type: 'string', enum: ['high', 'medium', 'low'] },
          textualAmbiguity: { type: 'boolean' },
        },
        required: ['sourceSentence', 'severity', 'band', 'textualAmbiguity'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'flags'],
  additionalProperties: false,
};

const valid = {
  summary: 'A fixed-fee engagement with payment on acceptance.',
  flags: [
    {
      sourceSentence: 'Client may terminate at any time.',
      severity: 76,
      band: 'high',
      textualAmbiguity: false,
    },
  ],
};

describe('checkAgainstSchema', () => {
  it('accepts a value that matches', () => {
    expect(checkAgainstSchema(valid, flagSchema)).toEqual([]);
  });

  it('reports a missing key by path', () => {
    const { summary, ...rest } = valid;
    void summary;
    expect(checkAgainstSchema(rest, flagSchema)).toEqual([
      { path: 'output.summary', message: 'missing' },
    ]);
  });

  it('reports a key the schema does not have', () => {
    const problems = checkAgainstSchema({ ...valid, advice: 'sue them' }, flagSchema);
    expect(problems).toEqual([
      { path: 'output.advice', message: 'not part of the schema' },
    ]);
  });

  it('reports the wrong type, naming what it got', () => {
    const problems = checkAgainstSchema({ ...valid, summary: 12 }, flagSchema);
    expect(problems).toHaveLength(1);
    expect(problems[0].path).toBe('output.summary');
    expect(problems[0].message).toMatch(/expected a string, got number/);
  });

  it('reaches into array items by index', () => {
    const problems = checkAgainstSchema(
      { ...valid, flags: [{ ...valid.flags[0], severity: 140 }] },
      flagSchema,
    );
    expect(problems).toEqual([
      { path: 'output.flags[0].severity', message: 'expected at most 100, got 140' },
    ]);
  });

  it('holds a string to its enum', () => {
    const problems = checkAgainstSchema(
      { ...valid, flags: [{ ...valid.flags[0], band: 'critical' }] },
      flagSchema,
    );
    expect(problems[0].path).toBe('output.flags[0].band');
    expect(problems[0].message).toMatch(/high, medium, low/);
  });

  it('counts a whitespace-only string as too short', () => {
    const problems = checkAgainstSchema({ ...valid, summary: '        ' }, flagSchema);
    expect(problems[0].message).toMatch(/at least 10 characters/);
  });

  it('reports everything wrong at once', () => {
    const problems = checkAgainstSchema(
      { flags: [{ sourceSentence: '', severity: 'high', band: 'high' }] },
      flagSchema,
    );
    expect(problems.map((problem) => problem.path)).toEqual([
      'output.summary',
      'output.flags[0].textualAmbiguity',
      'output.flags[0].sourceSentence',
      'output.flags[0].severity',
    ]);
  });
});
