import type { IncomingMessage, MessageHandler, MessageSource, SourceHealth } from '../types.js';

/**
 * In-memory source for tests and local development. Emits whatever you feed
 * it through the exact same pipe real WhatsApp messages travel.
 */
export class FakeSource implements MessageSource {
  readonly name = 'fake';
  private handlers: MessageHandler[] = [];
  private started = false;
  private lastMessageAt?: Date;

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  health(): SourceHealth {
    return { connected: this.started, lastMessageAt: this.lastMessageAt };
  }

  /** Test hook: push a message into the pipeline. */
  emit(msg: IncomingMessage): void {
    this.lastMessageAt = msg.timestamp;
    for (const h of this.handlers) h(msg);
  }
}
