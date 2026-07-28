import { describe, it, expect } from 'vitest';
import { parseChatExport, detectDateOrder } from '../src/sources/chatExport.js';

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

  // Real exports differ by the phone's locale: a US-locale phone writes M/D/YY.
  // Assuming D/M for those corrupts dates AND silently drops any message whose
  // day is > 12 (month 23 is not a date), which cost ~65% of one real group.
  describe('date order detection', () => {
    it('detects MDY when a second component exceeds 12', () => {
      expect(detectDateOrder('3/31/26, 10:40 AM - Jay: hi')).toBe('MDY');
    });

    it('detects DMY when a first component exceeds 12', () => {
      expect(detectDateOrder('26/05/2025, 23:27 - Rep: hi')).toBe('DMY');
    });

    it('defaults to DMY when every date is ambiguous', () => {
      expect(detectDateOrder('05/06/2025, 11:07 - Rep: hi')).toBe('DMY');
    });

    it('parses an MDY export without dropping days > 12', () => {
      const raw = '3/31/26, 10:40 AM - Jay: CAT ya OS\n7/23/26, 11:08 PM - Fridah: venue imehama';
      const msgs = parseChatExport(raw);
      expect(msgs).toHaveLength(2);
      expect(msgs[0].timestamp.toISOString()).toBe(new Date('2026-03-31T10:40:00+03:00').toISOString());
      expect(msgs[1].timestamp.toISOString()).toBe(new Date('2026-07-23T23:08:00+03:00').toISOString());
    });

    it('an explicit order overrides detection', () => {
      const msgs = parseChatExport('05/06/2025, 11:07 - Rep: hi', 'MDY');
      expect(msgs[0].timestamp.toISOString()).toBe(new Date('2025-05-06T11:07:00+03:00').toISOString());
    });
  });
});
