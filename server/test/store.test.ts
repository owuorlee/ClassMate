import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store/db.js';
import type { ExtractedEvent } from '../src/types.js';

function event(overrides: Partial<ExtractedEvent> = {}): ExtractedEvent {
  return {
    type: 'cat',
    action: 'create',
    course: 'Calculus',
    title: 'Calculus CAT',
    datetime: '2026-07-01T15:00:00+03:00',
    venue: 'LT2',
    notes: null,
    sourceMessageIds: ['m1'],
    confidence: 0.9,
    ...overrides,
  };
}

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(':memory:');
  });

  it('deduplicates messages by source id', () => {
    expect(store.markSeen('abc', 'g1')).toBe(false); // first time
    expect(store.markSeen('abc', 'g1')).toBe(true);  // duplicate
  });

  it('an update supersedes the prior active event for the same course+type', () => {
    store.saveEvent('g1', event(), 'test-model');
    store.saveEvent(
      'g1',
      event({ action: 'update', datetime: '2026-07-03T15:00:00+03:00', venue: 'LT5', sourceMessageIds: ['m2'] }),
      'test-model',
    );

    const active = store.activeEvents('g1');
    expect(active).toHaveLength(1);
    expect(active[0].venue).toBe('LT5');
  });

  it('course matching for updates is case-insensitive', () => {
    store.saveEvent('g1', event({ course: 'calculus' }), 'test-model');
    store.saveEvent('g1', event({ action: 'update', course: 'CALCULUS', venue: 'LT5' }), 'test-model');
    const active = store.activeEvents('g1');
    expect(active).toHaveLength(1);
    expect(active[0].venue).toBe('LT5');
  });

  it('a cancel removes the event from the active view', () => {
    store.saveEvent('g1', event(), 'test-model');
    store.saveEvent('g1', event({ action: 'cancel', sourceMessageIds: ['m3'] }), 'test-model');
    expect(store.activeEvents('g1')).toHaveLength(0);
  });

  it('events in different groups never interfere', () => {
    store.saveEvent('g1', event(), 'test-model');
    store.saveEvent('g2', event({ action: 'update', venue: 'LT9' }), 'test-model');
    expect(store.activeEvents('g1')).toHaveLength(1);
    expect(store.activeEvents('g1')[0].venue).toBe('LT2');
  });

  it('registerGroup and markSeen auto-discover a group without overwriting its name', () => {
    store.setGroupDisplayName('g1', 'Calculus 101');
    store.markSeen('m1', 'g1');
    expect(store.getGroup('g1')?.display_name).toBe('Calculus 101');
  });

  it('a student can subscribe, unsubscribe, and their planner merges events across groups sorted by datetime', () => {
    const { id } = store.createStudent('Leslie');
    store.saveEvent('g1', event({ datetime: '2026-07-05T00:00:00+03:00' }), 'test-model');
    store.saveEvent('g2', event({ course: 'Physics', datetime: '2026-07-02T00:00:00+03:00' }), 'test-model');

    store.subscribe(id, 'g1');
    store.subscribe(id, 'g2');
    expect(store.listSubscriptions(id)).toHaveLength(2);

    const planner = store.eventsForStudent(id);
    expect(planner.map((e) => e.course)).toEqual(['Physics', 'Calculus']);

    expect(store.unsubscribe(id, 'g1')).toBe(true);
    expect(store.unsubscribe(id, 'g1')).toBe(false);
    expect(store.eventsForStudent(id)).toHaveLength(1);
  });
});
