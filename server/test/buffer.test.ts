import { describe, it, expect, vi } from 'vitest';
import { MessageBuffer } from '../src/pipeline/buffer.js';
import type { IncomingMessage } from '../src/types.js';

function msg(id: string, groupId: string, text = 'CAT ya hesabu kesho'): IncomingMessage {
  return { sourceMessageId: id, groupId, senderId: 's1', text, timestamp: new Date() };
}

describe('MessageBuffer', () => {
  it('flushes when maxBatchSize is reached', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const buf = new MessageBuffer({ flushIntervalMs: 60_000, maxBatchSize: 3, onFlush });

    buf.add(msg('1', 'g1'));
    buf.add(msg('2', 'g1'));
    expect(onFlush).not.toHaveBeenCalled();
    buf.add(msg('3', 'g1'));

    await vi.waitFor(() => expect(onFlush).toHaveBeenCalledTimes(1));
    expect(onFlush).toHaveBeenCalledWith('g1', expect.arrayContaining([expect.objectContaining({ sourceMessageId: '1' })]));
    expect(buf.pendingCount('g1')).toBe(0);
  });

  it('flushes on the timer', async () => {
    vi.useFakeTimers();
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const buf = new MessageBuffer({ flushIntervalMs: 5_000, maxBatchSize: 100, onFlush });

    buf.add(msg('1', 'g1'));
    await vi.advanceTimersByTimeAsync(5_100);
    expect(onFlush).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('keeps groups independent', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const buf = new MessageBuffer({ flushIntervalMs: 60_000, maxBatchSize: 2, onFlush });

    buf.add(msg('1', 'g1'));
    buf.add(msg('2', 'g2'));
    expect(onFlush).not.toHaveBeenCalled();
    buf.add(msg('3', 'g1'));
    await vi.waitFor(() => expect(onFlush).toHaveBeenCalledTimes(1));
    expect(onFlush.mock.calls[0][0]).toBe('g1');
    expect(buf.pendingCount('g2')).toBe(1);
  });

  it('drops trivial acknowledgements (stage-0 filter)', () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const buf = new MessageBuffer({ flushIntervalMs: 60_000, maxBatchSize: 100, onFlush });
    buf.add(msg('1', 'g1', 'ok'));
    buf.add(msg('2', 'g1', '👍'));
    expect(buf.pendingCount('g1')).toBe(0);
  });

  it('flushAll drains every group', async () => {
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const buf = new MessageBuffer({ flushIntervalMs: 60_000, maxBatchSize: 100, onFlush });
    buf.add(msg('1', 'g1'));
    buf.add(msg('2', 'g2'));
    await buf.flushAll();
    expect(onFlush).toHaveBeenCalledTimes(2);
  });
});
