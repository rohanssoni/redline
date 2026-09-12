import { describe, expect, it } from 'vitest';
import { loadAdhesionFixture, loadCleanFixture } from '../tests/fixtures';
import {
  normalizeDocumentText,
  readableCharacterCount,
  unreadableReason,
} from './document-text';

describe('normalizeDocumentText', () => {
  it('leaves every source sentence in the fixture findable word for word', () => {
    const { text, sidecar } = loadAdhesionFixture();
    const normalized = normalizeDocumentText(text);
    for (const flag of sidecar.flags) {
      expect(normalized).toContain(flag.sourceSentence);
    }
  });

  it('is settled after one pass, so stored text and checked text are the same', () => {
    const { text } = loadAdhesionFixture();
    const once = normalizeDocumentText(text);
    expect(normalizeDocumentText(once)).toBe(once);
  });

  it('evens out the spacing a parser leaves behind', () => {
    const raw = '5.  TERM  \r\n\r\n\r\n\r\nThis  Agreement\tbegins on the Effective Date.  ';
    expect(normalizeDocumentText(raw)).toBe(
      '5. TERM\n\nThis Agreement begins on the Effective Date.',
    );
  });
});

describe('unreadableReason', () => {
  it('reads both fixtures without complaint', () => {
    for (const load of [loadAdhesionFixture, loadCleanFixture]) {
      const { text } = load();
      expect(unreadableReason(normalizeDocumentText(text), 'pdf')).toBeNull();
    }
  });

  it('refuses a PDF that came back with no text, and says why', () => {
    const scanned = normalizeDocumentText('\f\n \n\f\n');
    const reason = unreadableReason(scanned, 'pdf');
    expect(reason).toMatch(/scans or photographs/);
    expect(reason).not.toMatch(/error|failed/i);
  });

  it('refuses a page of layout characters with no letters in it', () => {
    const reason = unreadableReason('.'.repeat(400), 'docx');
    expect(reason).not.toBeNull();
  });

  it('refuses a scrap of text too short to be an agreement', () => {
    expect(unreadableReason('Please see the attached.', 'pasted')).toMatch(
      /not enough text/,
    );
  });

  it('counts characters that carry meaning, not layout', () => {
    expect(readableCharacterCount(' a b\n\tc ')).toBe(3);
  });
});
