import { describe, it, expect } from 'vitest';
import { Anonymizer, isRep } from '../src/eval/anonymize.js';

describe('Anonymizer', () => {
  it('scrubs Kenyan phone numbers in several formats', () => {
    const a = new Anonymizer();
    expect(a.text('call +254 741 860868 or 0712345678')).not.toMatch(/\d{6}/);
    expect(a.text('+254741860868')).toBe('[phone]');
  });

  it('scrubs registration numbers regardless of case or run-on prefix', () => {
    const a = new Anonymizer();
    // Real leaks found in the JKUAT corpus.
    for (const reg of ['ENM211-0247/2025', 'Enm211-0042/2025', 'agn221-0061/2025', 'Hdc215-1025/2025']) {
      expect(a.text(`student ${reg} missed it`)).not.toContain(reg);
    }
    expect(a.text('maENM211-0308/2025')).toContain('[regno]');
  });

  it('scrubs emails', () => {
    const a = new Anonymizer();
    expect(a.text('mail me at leslie.owuor@students.jkuat.ac.ke')).toBe('mail me at [email]');
  });

  it('gives each sender a stable pseudonym', () => {
    const a = new Anonymizer();
    const first = a.sender('+254 741 860868');
    expect(a.sender('+254 741 860868')).toBe(first);
    expect(a.sender('Someone Else')).not.toBe(first);
  });

  it('preserves rep status in pseudonyms', () => {
    const a = new Anonymizer();
    expect(a.sender('Mugambi Class Rep Grp C Civil')).toMatch(/^Class Rep/);
    expect(a.sender('Elvo Civil')).toMatch(/^Student/);
  });

  it('detects reps by title', () => {
    expect(isRep('Kiarie Grp C Class Rep')).toBe(true);
    expect(isRep('Victor Civil')).toBe(false);
  });

  it('message ids are deterministic', () => {
    const id = Anonymizer.messageId('g1', '2026-07-01T10:00:00.000Z', 'CAT kesho');
    expect(Anonymizer.messageId('g1', '2026-07-01T10:00:00.000Z', 'CAT kesho')).toBe(id);
    expect(Anonymizer.messageId('g2', '2026-07-01T10:00:00.000Z', 'CAT kesho')).not.toBe(id);
  });
});
