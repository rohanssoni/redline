import { describe, expect, it } from 'vitest';
import { parsableKind, unsupportedFileReason } from './file-kind';

describe('parsableKind', () => {
  it('reads a PDF by extension and by media type', () => {
    expect(parsableKind({ name: 'Halverson agreement.PDF', type: '' })).toBe('pdf');
    expect(parsableKind({ name: 'download', type: 'application/pdf' })).toBe('pdf');
  });

  it('reads a .docx whatever the browser calls it', () => {
    expect(parsableKind({ name: 'contract.docx', type: '' })).toBe('docx');
    expect(parsableKind({ name: 'contract.docx', type: 'application/octet-stream' })).toBe(
      'docx',
    );
    expect(
      parsableKind({
        name: 'download',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ).toBe('docx');
  });

  it('turns down anything else', () => {
    expect(parsableKind({ name: 'scan.jpg', type: 'image/jpeg' })).toBeNull();
    expect(parsableKind({ name: 'old-contract.doc', type: '' })).toBeNull();
    expect(parsableKind({ name: 'terms.txt', type: 'text/plain' })).toBeNull();
  });
});

describe('unsupportedFileReason', () => {
  it('tells someone with a .doc how to get a file that works', () => {
    expect(unsupportedFileReason({ name: 'contract.doc' })).toMatch(/save it again as .docx/);
  });

  it('tells someone who picked a photo that Redline reads text', () => {
    expect(unsupportedFileReason({ name: 'IMG_4821.HEIC' })).toMatch(/image/i);
    expect(unsupportedFileReason({ name: 'page1.png' })).toMatch(/image/i);
  });

  it('names the two kinds of file it does read', () => {
    const reason = unsupportedFileReason({ name: 'notes.rtf' });
    expect(reason).toMatch(/PDF/);
    expect(reason).toMatch(/\.docx/);
  });
});
