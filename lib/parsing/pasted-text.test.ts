import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAdhesionFixture } from '../../tests/fixtures';
import { stubModelClientFor } from '../../tests/support/stub-model-client';
import { analyzeDocument } from '../analysis/analyze-document';
import { saveDocument } from '../documents/save-document';
import { documentInput } from './document-input';
import {
  UNNAMED_PASTE,
  pastedDocumentName,
  pastedImageReason,
  readPaste,
} from './pasted-text';

/** The same fixture down each path: parsed out of a file, and pasted in. */
function bothPaths() {
  const { text, sidecar } = loadAdhesionFixture();
  const uploaded = documentInput('Adhesion agreement.pdf', text, 'pdf');
  const paste = readPaste({ name: 'Adhesion agreement.pdf', text });
  if (paste.document === undefined) {
    throw new Error(`the fixture was refused: ${paste.refused}`);
  }
  return { uploaded, pasted: paste.document, sidecar };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pastedImageReason', () => {
  it('turns down a screenshot on the clipboard', () => {
    expect(pastedImageReason(['image/png'])).not.toBeNull();
    expect(pastedImageReason(['text/html', 'image/jpeg'])).not.toBeNull();
  });

  it('tells the reader why in words they use, without naming the machinery', () => {
    const reason = pastedImageReason(['image/png']) ?? '';
    expect(reason).toMatch(/picture/i);
    expect(reason).toMatch(/guess/i);
    expect(reason).not.toMatch(/OCR|optical|recognition|parse/i);
  });

  it('lets a copied passage through however the clipboard dressed it up', () => {
    expect(pastedImageReason([])).toBeNull();
    expect(pastedImageReason(['text/plain', 'text/html', 'text/rtf'])).toBeNull();
  });
});

describe('pastedDocumentName', () => {
  it('keeps what the reader typed', () => {
    expect(pastedDocumentName('  Halverson retainer ', 'MASTER SERVICES AGREEMENT')).toBe(
      'Halverson retainer',
    );
  });

  it('falls back to the first line of what was pasted', () => {
    expect(pastedDocumentName('', '\n\nMASTER SERVICES AGREEMENT\n\n1. Term...')).toBe(
      'MASTER SERVICES AGREEMENT',
    );
  });

  it('shortens a first line that is really a paragraph', () => {
    const long = `${'word '.repeat(60)}end`;
    const name = pastedDocumentName('', long);
    expect(name.length).toBeLessThanOrEqual(121);
    expect(name.endsWith('…')).toBe(true);
  });

  it('names a paste that starts with nothing to name it after', () => {
    expect(pastedDocumentName('', '   \n\n  ')).toBe(UNNAMED_PASTE);
  });
});

describe('readPaste', () => {
  it('stores the pasted text as the document text, word for word', () => {
    const { text, sidecar } = loadAdhesionFixture();
    const paste = readPaste({ name: '', text });

    expect(paste.refused).toBeUndefined();
    for (const flag of sidecar.flags) {
      expect(paste.document?.text).toContain(flag.sourceSentence);
    }
  });

  it('refuses a paste with too little in it to read, and returns no document', () => {
    const paste = readPaste({ name: 'Notes', text: 'Fee: £800. Net 30.' });

    expect(paste.document).toBeUndefined();
    expect(paste.refused).toMatch(/not enough text/i);
  });

  it('refuses a pasted image before anything is stored, however much text came with it', async () => {
    const { text } = loadAdhesionFixture();
    const sent = vi.fn();
    vi.stubGlobal('fetch', sent);

    const paste = readPaste({ name: '', text, fileTypes: ['image/png'] });
    if (paste.document !== undefined) {
      await saveDocument(paste.document);
    }

    expect(paste.refused).toMatch(/picture/i);
    expect(paste.document).toBeUndefined();
    expect(sent).not.toHaveBeenCalled();
  });

  it('never reaches the model with a refused paste', async () => {
    const { sidecar } = loadAdhesionFixture();
    const model = stubModelClientFor(sidecar);

    const paste = readPaste({ name: '', text: 'A screenshot.', fileTypes: ['image/png'] });
    if (paste.document !== undefined) {
      await analyzeDocument(paste.document.text, [], { model });
    }

    expect(model.calls).toHaveLength(0);
  });
});

describe('an uploaded document and a pasted one', () => {
  it('come out in the same shape, with nothing on them naming the path taken', () => {
    const { uploaded, pasted } = bothPaths();

    expect(Object.keys(pasted).sort()).toEqual(Object.keys(uploaded).sort());
    expect(Object.keys(pasted).sort()).toEqual(['name', 'text']);
    expect(pasted.text).toBe(uploaded.text);
  });

  it('are sent to be stored as the same request', async () => {
    const { uploaded, pasted } = bothPaths();
    const sent: string[] = [];
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
      sent.push(String(init.body));
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'doc-1' }), { status: 201 }),
      );
    });

    await saveDocument(uploaded);
    await saveDocument(pasted);

    expect(sent[1]).toBe(sent[0]);
  });

  it('flags on a pasted fixture pass the same verbatim source-sentence check as flags on an uploaded one', async () => {
    const { uploaded, pasted, sidecar } = bothPaths();

    const fromUpload = await analyzeDocument(uploaded.text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });
    const fromPaste = await analyzeDocument(pasted.text, sidecar.redLines, {
      model: stubModelClientFor(sidecar),
    });

    expect(fromPaste.flags.length).toBeGreaterThan(0);
    for (const flag of fromPaste.flags) {
      expect(pasted.text).toContain(flag.sourceSentence);
    }
    expect(fromPaste.flags.map((flag) => flag.sourceSentence)).toEqual(
      fromUpload.flags.map((flag) => flag.sourceSentence),
    );
  });

  it('are read by an analysis that cannot tell them apart', async () => {
    const { uploaded, pasted, sidecar } = bothPaths();

    const uploadModel = stubModelClientFor(sidecar);
    const pasteModel = stubModelClientFor(sidecar);
    const fromUpload = await analyzeDocument(uploaded.text, sidecar.redLines, {
      model: uploadModel,
    });
    const fromPaste = await analyzeDocument(pasted.text, sidecar.redLines, {
      model: pasteModel,
    });

    expect(fromPaste).toEqual(fromUpload);
    expect(pasteModel.calls).toEqual(uploadModel.calls);
  });
});
