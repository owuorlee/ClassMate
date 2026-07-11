import { describe, it, expect } from 'vitest';
import { parseChatExport } from '../src/sources/chatExport.js';

const ANDROID_EXPORT = `25/06/2026, 09:12 - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
25/06/2026, 14:23 - Brian Otieno: Wadau CAT ya Calculus imehamia Friday 3PM, venue ni LT5 sio LT2. Mlete calculators
25/06/2026, 14:24 - Kevin: sawa
25/06/2026, 14:30 - Class Rep: Assignment ya OS chapter 4
due wiki ijayo Tuesday midnight
25/06/2026, 14:31 - Faith: <Media omitted>
`;

const IOS_EXPORT = `[25/06/2026, 14:23:10] Brian Otieno: CAT ya Physics ni kesho saa nne
[25/06/2026, 14:25:00] Kevin: noted`;

describe('parseChatExport', () => {
  it('parses android format, skips system lines and media placeholders', () => {
    const msgs = parseChatExport(ANDROID_EXPORT);
    expect(msgs).toHaveLength(3);
    expect(msgs[0].sender).toBe('Brian Otieno');
    expect(msgs[0].text).toContain('CAT ya Calculus');
    expect(msgs[0].timestamp.toISOString()).toBe(new Date('2026-06-25T14:23:00+03:00').toISOString());
  });

  it('joins multi-line messages', () => {
    const msgs = parseChatExport(ANDROID_EXPORT);
    const assignment = msgs.find((m) => m.text.includes('Assignment'));
    expect(assignment?.text).toBe('Assignment ya OS chapter 4\ndue wiki ijayo Tuesday midnight');
  });

  it('parses iOS bracket format with seconds', () => {
    const msgs = parseChatExport(IOS_EXPORT);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].timestamp.toISOString()).toBe(new Date('2026-06-25T14:23:10+03:00').toISOString());
  });

  it('parses 12-hour am/pm times', () => {
    const msgs = parseChatExport('25/06/2026, 2:23 pm - Rep: CAT kesho');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].timestamp.toISOString()).toBe(new Date('2026-06-25T14:23:00+03:00').toISOString());
  });
});
