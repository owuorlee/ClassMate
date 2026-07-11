import express, { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { Store } from '../store/db.js';

/**
 * The Planner API: read/serve layer on top of the Store the ingestion
 * pipeline writes to. Runs as a separate process from the ingestion service
 * (see apiServer.ts) sharing the same SQLite file — WAL mode makes concurrent
 * reads-while-writing safe.
 *
 * No auth yet: student ids are unguessable UUIDs, which is adequate for a
 * closed pilot but NOT a substitute for real auth before wider rollout.
 */
/** Route params are always single strings for our non-repeating path segments. */
function param(req: Request, name: string): string {
  return req.params[name] as string;
}

export function createApp(store: Store): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // -------------------------------------------------------------------
  // Groups
  // -------------------------------------------------------------------

  app.get('/groups', (_req, res) => {
    res.json(store.listGroups());
  });

  app.get('/groups/:groupId', (req, res) => {
    const group = store.getGroup(param(req, 'groupId'));
    if (!group) return void res.status(404).json({ error: 'group not found' });
    res.json(group);
  });

  const patchGroupBody = z.object({ displayName: z.string().min(1) });

  app.patch('/groups/:groupId', validate(patchGroupBody), (req, res) => {
    store.setGroupDisplayName(param(req, 'groupId'), req.body.displayName);
    res.json(store.getGroup(param(req, 'groupId')));
  });

  app.get('/groups/:groupId/events', (req, res) => {
    if (!store.getGroup(param(req, 'groupId'))) return void res.status(404).json({ error: 'group not found' });
    res.json(store.activeEvents(param(req, 'groupId')));
  });

  // -------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------

  app.get('/events/:id', (req, res) => {
    const event = store.getEvent(param(req, 'id'));
    if (!event) return void res.status(404).json({ error: 'event not found' });
    res.json(event);
  });

  // -------------------------------------------------------------------
  // Students & subscriptions
  // -------------------------------------------------------------------

  const createStudentBody = z.object({ name: z.string().min(1).optional() });

  app.post('/students', validate(createStudentBody), (req, res) => {
    const student = store.createStudent(req.body.name);
    res.status(201).json(student);
  });

  app.get('/students/:id', (req, res) => {
    const student = store.getStudent(param(req, 'id'));
    if (!student) return void res.status(404).json({ error: 'student not found' });
    res.json(student);
  });

  const subscribeBody = z.object({ groupId: z.string().min(1) });

  app.post('/students/:id/subscriptions', validate(subscribeBody), (req, res) => {
    const id = param(req, 'id');
    if (!store.getStudent(id)) return void res.status(404).json({ error: 'student not found' });
    store.subscribe(id, req.body.groupId);
    res.status(201).json(store.listSubscriptions(id));
  });

  app.delete('/students/:id/subscriptions/:groupId', (req, res) => {
    const id = param(req, 'id');
    if (!store.getStudent(id)) return void res.status(404).json({ error: 'student not found' });
    const removed = store.unsubscribe(id, param(req, 'groupId'));
    if (!removed) return void res.status(404).json({ error: 'subscription not found' });
    res.status(204).end();
  });

  app.get('/students/:id/subscriptions', (req, res) => {
    const id = param(req, 'id');
    if (!store.getStudent(id)) return void res.status(404).json({ error: 'student not found' });
    res.json(store.listSubscriptions(id));
  });

  // The core payload the mobile app renders: one merged, sorted planner.
  app.get('/students/:id/planner', (req, res) => {
    const id = param(req, 'id');
    if (!store.getStudent(id)) return void res.status(404).json({ error: 'student not found' });
    res.json(store.eventsForStudent(id));
  });

  app.use((req, res) => {
    res.status(404).json({ error: `no route for ${req.method} ${req.path}` });
  });

  // Express 5 forwards rejected promises from handlers here automatically.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] unhandled error:', err);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}

function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({ error: 'invalid request body', details: result.error.issues });
      return;
    }
    req.body = result.data;
    next();
  };
}
