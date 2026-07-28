import { createHash } from 'node:crypto';

/**
 * PII scrubbing for the eval corpus.
 *
 * Real class-group exports carry other students' phone numbers, registration
 * numbers and names. The extraction task never needs them, so we strip them
 * before anything is stored, labeled or sent to a model (Kenya DPA 2019 data
 * minimization, and plain decency toward the friends who shared these chats).
 *
 * Senders become stable pseudonyms so conversational context survives: the
 * same person is "Student 7" throughout, and reps stay identifiable as reps.
 */

const PHONE_RE = /(?:\+?254|0)[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3,4}\b/g;
/**
 * JKUAT-style registration numbers, e.g. ENM211-0247/2025, SCT121-0999/2024.
 * Case-insensitive and without a leading \b: real messages contain "Enm211-…",
 * "agn221-…" and even run-on forms like "maENM211-0308/2025".
 */
const REGNO_RE = /[A-Za-z]{2,5}\d{2,3}[-–\s]?\d{3,4}\/\d{4}/gi;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g;
/** WhatsApp @-mentions, which embed a number or nickname. */
const MENTION_RE = /@[~⁨⁩]*[\w+\s]{2,20}[⁨⁩]*/g;

/** Is this sender a class rep? Worth preserving — reps post most real events. */
export function isRep(sender: string): boolean {
  return /\b(class\s*rep|rep\b|chairman|chairperson|secretary)\b/i.test(sender);
}

export class Anonymizer {
  private map = new Map<string, string>();
  private next = 1;

  /** Stable pseudonym for a sender, preserving rep status. */
  sender(original: string): string {
    const existing = this.map.get(original);
    if (existing) return existing;
    const label = isRep(original) ? `Class Rep ${this.repCount()}` : `Student ${this.next++}`;
    this.map.set(original, label);
    return label;
  }

  private repCount(): number {
    return [...this.map.values()].filter((v) => v.startsWith('Class Rep')).length + 1;
  }

  /** Scrub identifiers out of message text. */
  text(body: string): string {
    return body
      .replace(EMAIL_RE, '[email]')
      .replace(REGNO_RE, '[regno]')
      .replace(PHONE_RE, '[phone]')
      .replace(MENTION_RE, '@[mention]');
  }

  /** Deterministic short id for a message, so labels survive re-runs. */
  static messageId(groupId: string, iso: string, text: string): string {
    return createHash('sha256').update(`${groupId}|${iso}|${text}`).digest('hex').slice(0, 12);
  }

  /** How many distinct people were pseudonymized (for reporting). */
  get size(): number {
    return this.map.size;
  }
}
