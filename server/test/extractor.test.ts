import { describe, it, expect, vi } from 'vitest';
import { Extractor } from '../src/pipeline/extractor.js';
import type { LlmClient } from '../src/pipeline/llm.js';
import type { IncomingMessage } from '../src/types.js';

const BATCH: IncomingMessage[] = [
  {
    sourceMessageId: 'm1',
    groupId: 'g1',
    senderId: 'rep',
    senderName: 'Class Rep',
    text: 'Wadau CAT ya Calculus imehamia Friday 3PM, venue ni LT5 sio LT2. Mlete calculators',
    timestamp: new Date('2026-06-29T10:15:00+03:00'),
  },
];

const GOOD_JSON = JSON.stringify({
  events: [
    {
      type: 'cat',
      action: 'update',
      course: 'Calculus',
      title: 'Calculus CAT',
      datetime: '2026-07-03T15:00:00+03:00',
      venue: 'LT5',
      notes: 'Moved from LT2. Bring calculators.',
      source_message_ids: ['m1'],
      confidence: 0.95,
    },
  ],
});

const LOW_CONFIDENCE_JSON = JSON.stringify({
  events: [
    {
      type: 'cat',
      action: 'update',
      course: 'Calculus',
      title: 'Calculus CAT',
      datetime: null,
      venue: 'LT5',
      notes: null,
      source_message_ids: ['m1'],
      confidence: 0.4,
    },
  ],
});

function mockClient(model: string, response: string | Error): LlmClient & { complete: ReturnType<typeof vi.fn> } {
  return {
    model,
    complete: vi.fn(
      response instanceof Error ? () => Promise.reject(response) : () => Promise.resolve(response),
    ),
  };
}

describe('Extractor cascade', () => {
  it('accepts a confident primary result without escalating', async () => {
    const primary = mockClient('cheap', GOOD_JSON);
    const escalation = mockClient('strong', GOOD_JSON);
    const ex = new Extractor({ primary, escalation, confidenceThreshold: 0.8 });

    const result = await ex.extract(BATCH);
    expect(result.escalated).toBe(false);
    expect(result.model).toBe('cheap');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].venue).toBe('LT5');
    expect(result.events[0].sourceMessageIds).toEqual(['m1']);
    expect(escalation.complete).not.toHaveBeenCalled();
  });

  it('escalates when primary confidence is below threshold', async () => {
    const primary = mockClient('cheap', LOW_CONFIDENCE_JSON);
    const escalation = mockClient('strong', GOOD_JSON);
    const ex = new Extractor({ primary, escalation, confidenceThreshold: 0.8 });

    const result = await ex.extract(BATCH);
    expect(result.escalated).toBe(true);
    expect(result.model).toBe('strong');
    expect(result.events[0].confidence).toBe(0.95);
  });

  it('escalates when primary returns invalid JSON', async () => {
    const primary = mockClient('cheap', 'sorry, here is the answer: CAT moved');
    const escalation = mockClient('strong', GOOD_JSON);
    const ex = new Extractor({ primary, escalation, confidenceThreshold: 0.8 });

    const result = await ex.extract(BATCH);
    expect(result.escalated).toBe(true);
    expect(result.events).toHaveLength(1);
  });

  it('tolerates code-fenced JSON', async () => {
    const primary = mockClient('cheap', '```json\n' + GOOD_JSON + '\n```');
    const ex = new Extractor({ primary, confidenceThreshold: 0.8 });
    const result = await ex.extract(BATCH);
    expect(result.events).toHaveLength(1);
  });

  it('falls back to low-confidence primary events when escalation also fails', async () => {
    const primary = mockClient('cheap', LOW_CONFIDENCE_JSON);
    const escalation = mockClient('strong', new Error('rate limited'));
    const ex = new Extractor({ primary, escalation, confidenceThreshold: 0.8 });

    const result = await ex.extract(BATCH);
    expect(result.escalated).toBe(true);
    expect(result.model).toBe('cheap');
    expect(result.events[0].confidence).toBe(0.4);
  });

  it('throws when both models fail completely', async () => {
    const primary = mockClient('cheap', new Error('down'));
    const escalation = mockClient('strong', new Error('down'));
    const ex = new Extractor({ primary, escalation, confidenceThreshold: 0.8 });
    await expect(ex.extract(BATCH)).rejects.toThrow(/both/i);
  });
});
