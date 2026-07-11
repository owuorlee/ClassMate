import type { ExtractedEvent } from '../types.js';

/**
 * Student-facing output channel. IMPORTANT: notifications go through the
 * ClassMate app (push), NEVER back through WhatsApp — the bot never sends.
 */
export interface Notifier {
  eventDetected(groupId: string, event: ExtractedEvent, escalated: boolean): Promise<void>;
}

/** Dev stand-in until the mobile app + push service exist. */
export class ConsoleNotifier implements Notifier {
  async eventDetected(groupId: string, event: ExtractedEvent, escalated: boolean): Promise<void> {
    const flag = escalated ? ' (escalated)' : '';
    console.log(
      `\n📚 [${groupId}] ${event.action.toUpperCase()} ${event.type}: ${event.title}` +
        `\n   course: ${event.course ?? '—'} | when: ${event.datetime ?? '—'} | venue: ${event.venue ?? '—'}` +
        `\n   notes: ${event.notes ?? '—'} | confidence: ${event.confidence}${flag}`,
    );
  }
}
