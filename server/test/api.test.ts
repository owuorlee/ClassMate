import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/api/app.js';
import { Store } from '../src/store/db.js';
import type { ExtractedEvent } from '../src/types.js';

function event(overrides: Partial<ExtractedEvent> = {}): ExtractedEvent {
  return {
    type: 'cat',
    action: 'create',
    course: 'Calculus',
    title: 'Calculus CAT',
    datetime: '2026-07-03T15:00:00+03:00',
    venue: 'LT5',
    notes: null,
    sourceMessageIds: ['m1'],
    confidence: 0.9,
    ...overrides,
  };
}

describe('Planner API', () => {
  let store: Store;
  let app: Express;

  beforeEach(() => {
    store = new Store(':memory:');
    app = createApp(store);
  });

  it('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('groups are auto-discovered once a message/event touches them, then can be named', async () => {
    store.saveEvent('g1', event(), 'test-model');

    const list = await request(app).get('/groups');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].group_id).toBe('g1');
    expect(list.body[0].display_name).toBeNull();

    const renamed = await request(app).patch('/groups/g1').send({ displayName: 'Calculus 101' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.display_name).toBe('Calculus 101');
  });

  it('PATCH /groups/:id rejects an empty display name', async () => {
    const res = await request(app).patch('/groups/g1').send({ displayName: '' });
    expect(res.status).toBe(400);
  });

  it('GET /groups/:id/events 404s for an unknown group', async () => {
    const res = await request(app).get('/groups/unknown/events');
    expect(res.status).toBe(404);
  });

  it('GET /groups/:id/events returns only that group\'s active events', async () => {
    store.saveEvent('g1', event(), 'test-model');
    store.saveEvent('g2', event({ course: 'Physics', title: 'Physics CAT' }), 'test-model');

    const res = await request(app).get('/groups/g1/events');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].course).toBe('Calculus');
  });

  it('GET /events/:id returns a single event, 404 when missing', async () => {
    const id = store.saveEvent('g1', event(), 'test-model');
    const found = await request(app).get(`/events/${id}`);
    expect(found.status).toBe(200);
    expect(found.body.title).toBe('Calculus CAT');

    const missing = await request(app).get('/events/does-not-exist');
    expect(missing.status).toBe(404);
  });

  it('creates a student and rejects an empty name', async () => {
    const ok = await request(app).post('/students').send({ name: 'Leslie' });
    expect(ok.status).toBe(201);
    expect(ok.body.id).toBeTruthy();
    expect(ok.body.name).toBe('Leslie');

    const anon = await request(app).post('/students').send({});
    expect(anon.status).toBe(201);
    expect(anon.body.name).toBeNull();

    const bad = await request(app).post('/students').send({ name: '' });
    expect(bad.status).toBe(400);
  });

  it('subscription lifecycle: subscribe, list, planner merges across groups, unsubscribe', async () => {
    const student = (await request(app).post('/students').send({ name: 'Leslie' })).body;
    store.saveEvent('g1', event(), 'test-model');
    store.saveEvent('g2', event({ course: 'Physics', title: 'Physics CAT', datetime: '2026-07-01T09:00:00+03:00' }), 'test-model');
    store.saveEvent('g3', event({ course: 'Chem', title: 'Chem CAT' }), 'test-model'); // not subscribed

    const sub1 = await request(app).post(`/students/${student.id}/subscriptions`).send({ groupId: 'g1' });
    expect(sub1.status).toBe(201);
    await request(app).post(`/students/${student.id}/subscriptions`).send({ groupId: 'g2' });

    const subs = await request(app).get(`/students/${student.id}/subscriptions`);
    expect(subs.body).toHaveLength(2);

    const planner = await request(app).get(`/students/${student.id}/planner`);
    expect(planner.status).toBe(200);
    expect(planner.body).toHaveLength(2);
    // sorted by datetime: Physics (07-01) before Calculus (07-03)
    expect(planner.body[0].course).toBe('Physics');
    expect(planner.body[1].course).toBe('Calculus');

    const unsub = await request(app).delete(`/students/${student.id}/subscriptions/g1`);
    expect(unsub.status).toBe(204);
    const plannerAfter = await request(app).get(`/students/${student.id}/planner`);
    expect(plannerAfter.body).toHaveLength(1);
    expect(plannerAfter.body[0].course).toBe('Physics');

    const unsubAgain = await request(app).delete(`/students/${student.id}/subscriptions/g1`);
    expect(unsubAgain.status).toBe(404);
  });

  it('404s student-scoped routes for an unknown student', async () => {
    const a = await request(app).get('/students/nope/planner');
    expect(a.status).toBe(404);
    const b = await request(app).post('/students/nope/subscriptions').send({ groupId: 'g1' });
    expect(b.status).toBe(404);
    const c = await request(app).get('/students/nope/subscriptions');
    expect(c.status).toBe(404);
  });

  it('an update event changes what the planner shows, not adds to it', async () => {
    const student = (await request(app).post('/students').send({})).body;
    store.saveEvent('g1', event(), 'test-model');
    await request(app).post(`/students/${student.id}/subscriptions`).send({ groupId: 'g1' });

    store.saveEvent('g1', event({ action: 'update', venue: 'LT9' }), 'test-model');

    const planner = await request(app).get(`/students/${student.id}/planner`);
    expect(planner.body).toHaveLength(1);
    expect(planner.body[0].venue).toBe('LT9');
  });

  it('unknown routes 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});
