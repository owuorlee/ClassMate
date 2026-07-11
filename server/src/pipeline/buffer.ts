import type { IncomingMessage } from '../types.js';

export interface BufferOptions {
  flushIntervalMs: number;
  maxBatchSize: number;
  onFlush: (groupId: string, messages: IncomingMessage[]) => Promise<void>;
}

/**
 * Micro-batching: buffer each group's messages and hand them to the extractor
 * as one batch. Amortizes the system prompt across ~25 messages and gives the
 * model conversational context ("imehamia Friday" refers to earlier messages).
 */
export class MessageBuffer {
  private buffers = new Map<string, IncomingMessage[]>();
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly opts: BufferOptions) {}

  add(msg: IncomingMessage): void {
    // Free stage-0 filter: reactions/acknowledgements carry no schedule info.
    if (msg.text.trim().length < 3) return;

    let buf = this.buffers.get(msg.groupId);
    if (!buf) {
      buf = [];
      this.buffers.set(msg.groupId, buf);
    }
    buf.push(msg);

    if (buf.length >= this.opts.maxBatchSize) {
      void this.flushGroup(msg.groupId);
      return;
    }
    if (!this.timers.has(msg.groupId)) {
      const t = setTimeout(() => void this.flushGroup(msg.groupId), this.opts.flushIntervalMs);
      // Don't keep the process alive just for a pending flush.
      t.unref?.();
      this.timers.set(msg.groupId, t);
    }
  }

  async flushGroup(groupId: string): Promise<void> {
    const timer = this.timers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(groupId);
    }
    const buf = this.buffers.get(groupId);
    if (!buf || buf.length === 0) return;
    this.buffers.delete(groupId);
    await this.opts.onFlush(groupId, buf);
  }

  async flushAll(): Promise<void> {
    const groupIds = [...this.buffers.keys()];
    for (const id of groupIds) {
      await this.flushGroup(id);
    }
  }

  pendingCount(groupId: string): number {
    return this.buffers.get(groupId)?.length ?? 0;
  }
}
