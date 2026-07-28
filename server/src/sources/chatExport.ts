import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { IncomingMessage, MessageHandler, MessageSource, SourceHealth } from '../types.js';

/**
 * Replays a WhatsApp "Export Chat" (without media) text file through the
 * pipeline. Used to backfill history when a bot number joins a group
 * mid-semester, and to build extraction eval sets from real group data.
 *
 * Handles the two common export layouts:
 *   Android: `25/06/2026, 14:23 - Brian Otieno: message text`
 *   iOS:     `[25/06/2026, 14:23:45] Brian Otieno: message text`
 * Lines that don't start a new message are continuations of the previous one.
 */

// date, time, (optional seconds), am/pm variants, then "- Sender: text" or "] Sender: text"
const ANDROID_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\s+-\s+([^:]+):\s(.*)$/;
const IOS_RE = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\]\s+([^:]+):\s(.*)$/;
/** Any line that opens a new export entry, message or system notice. */
const DATE_PREFIX_RE = /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},\s/;

export interface ParsedExportMessage {
  sender: string;
  text: string;
  timestamp: Date;
}

/** Which position holds the day: WhatsApp exports in the phone's locale. */
export type DateOrder = 'DMY' | 'MDY';

/**
 * Detect whether an export is day-first or month-first. Real exports from the
 * same class can differ (a phone set to en-GB vs en-US), and guessing wrong
 * silently corrupts every date — or drops messages outright when the "month"
 * lands above 12. So we scan the whole file for a disambiguating date:
 * a first component > 12 proves DMY, a second component > 12 proves MDY.
 */
export function detectDateOrder(raw: string): DateOrder {
  const re = /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) return 'DMY';
    if (b > 12) return 'MDY';
  }
  // Fully ambiguous (every date has both parts <= 12). Kenyan phones default
  // to day-first, so that is the safer assumption.
  return 'DMY';
}

export function parseChatExport(raw: string, order: DateOrder = detectDateOrder(raw)): ParsedExportMessage[] {
  const messages: ParsedExportMessage[] = [];
  // Strip the left-to-right/invisible marks WhatsApp sprinkles into exports.
  const lines = raw.replace(/[‎‏‪-‮]/g, '').split(/\r?\n/);

  for (const line of lines) {
    const m = ANDROID_RE.exec(line) ?? IOS_RE.exec(line);
    if (m) {
      const [, first, second, yy, hh, min, ss, ampm, sender, text] = m;
      const dd = order === 'DMY' ? first : second;
      const mm = order === 'DMY' ? second : first;
      let hours = Number(hh);
      if (ampm) {
        const pm = ampm.toLowerCase() === 'pm';
        if (pm && hours < 12) hours += 12;
        if (!pm && hours === 12) hours = 0;
      }
      const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
      // WhatsApp exports use the phone's local time; for Kenyan groups that is
      // Africa/Nairobi (UTC+3, no DST).
      const iso = `${year.toString().padStart(4, '0')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hours
        .toString()
        .padStart(2, '0')}:${min}:${(ss ?? '00').padStart(2, '0')}+03:00`;
      const timestamp = new Date(iso);
      if (Number.isNaN(timestamp.getTime())) {
        // Should not happen once the date order is right; loud because a silent
        // skip here means quietly losing real messages.
        console.warn(`[chatExport] unparseable date, skipping line: ${line.slice(0, 60)}`);
        continue;
      }
      messages.push({ sender: sender.trim(), text, timestamp });
    } else if (DATE_PREFIX_RE.test(line)) {
      // Starts a new entry but has no "Sender: text" — a system line
      // ("X removed Y", "X joined using this group's invite link"). Drop it
      // rather than appending, which would splice group admin noise into the
      // previous message's text.
      continue;
    } else if (messages.length > 0 && line.trim() !== '') {
      // Continuation of a multi-line message.
      messages[messages.length - 1].text += '\n' + line;
    }
    // else: blank lines and pre-first-message banners are dropped.
  }

  // Media placeholders carry no extractable text.
  return messages.filter((m) => m.text.trim() !== '<Media omitted>' && m.text.trim() !== 'null');
}

export class ChatExportSource implements MessageSource {
  readonly name = 'chat-export';
  private handlers: MessageHandler[] = [];
  private lastMessageAt?: Date;
  private done = false;

  constructor(
    private readonly filePath: string,
    private readonly groupId: string,
  ) {}

  async start(): Promise<void> {
    const raw = await readFile(this.filePath, 'utf8');
    for (const parsed of parseChatExport(raw)) {
      const msg: IncomingMessage = {
        // Deterministic ID so re-running the same export never duplicates events.
        sourceMessageId: createHash('sha256')
          .update(`${this.groupId}|${parsed.timestamp.toISOString()}|${parsed.sender}|${parsed.text}`)
          .digest('hex')
          .slice(0, 32),
        groupId: this.groupId,
        senderId: parsed.sender,
        senderName: parsed.sender,
        text: parsed.text,
        timestamp: parsed.timestamp,
      };
      this.lastMessageAt = parsed.timestamp;
      for (const h of this.handlers) h(msg);
    }
    this.done = true;
  }

  async stop(): Promise<void> {}

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  health(): SourceHealth {
    return { connected: !this.done, lastMessageAt: this.lastMessageAt, detail: this.done ? 'replay complete' : 'replaying' };
  }
}
