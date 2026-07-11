import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { ExtractedEvent } from '../types.js';

/**
 * SQLite store (node:sqlite, built into Node >= 22.13 — no native deps).
 *
 * Data minimization (Kenya DPA 2019): raw message text is NOT stored. We keep
 * only message IDs for deduplication and the extracted academic events.
 */
export class Store {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS seen_messages (
        source_message_id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        seen_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        type TEXT NOT NULL,
        action TEXT NOT NULL,
        course TEXT,
        title TEXT NOT NULL,
        datetime TEXT,
        venue TEXT,
        notes TEXT,
        confidence REAL NOT NULL,
        model TEXT NOT NULL,
        source_message_ids TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',   -- active | superseded | cancelled
        superseded_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id, status);

      -- Groups are discovered automatically (see registerGroup) the first time
      -- the bot sees a message from them — no manual registration required to
      -- start ingesting. display_name is set later by an admin/rep so the app
      -- shows "Calculus 101" instead of a raw WhatsApp group id.
      CREATE TABLE IF NOT EXISTS groups (
        group_id TEXT PRIMARY KEY,
        display_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- A student's personal planner = the union of active events across
      -- their subscribed groups. One-time setup per student, per our
      -- least-friction principle.
      CREATE TABLE IF NOT EXISTS subscriptions (
        student_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (student_id, group_id)
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_group ON subscriptions(group_id);
    `);
  }

  /** Idempotent: creates a placeholder group row on first sight, never overwrites display_name. */
  registerGroup(groupId: string): void {
    this.db.prepare('INSERT OR IGNORE INTO groups (group_id) VALUES (?)').run(groupId);
  }

  /** Returns true if this message was already processed (dedup across reconnects/replays). */
  markSeen(sourceMessageId: string, groupId: string): boolean {
    this.registerGroup(groupId);
    const res = this.db
      .prepare('INSERT OR IGNORE INTO seen_messages (source_message_id, group_id) VALUES (?, ?)')
      .run(sourceMessageId, groupId);
    return res.changes === 0; // 0 changes => already existed
  }

  /**
   * Persist an extracted event, reconciling updates/cancellations against the
   * newest active event for the same group + course + type.
   * Returns the stored event id, or null if the action was a cancel with no
   * target (nothing to cancel — record it as a cancelled event for visibility).
   */
  saveEvent(groupId: string, event: ExtractedEvent, model: string): string {
    this.registerGroup(groupId);
    const id = randomUUID();

    if (event.action === 'update' || event.action === 'cancel') {
      const prior = this.db
        .prepare(
          `SELECT id FROM events
           WHERE group_id = ? AND status = 'active' AND type = ?
             AND (course = ? OR (course IS NULL AND ? IS NULL) OR LOWER(course) = LOWER(?))
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get(groupId, event.type, event.course, event.course, event.course ?? '') as { id: string } | undefined;

      if (prior) {
        this.db
          .prepare(`UPDATE events SET status = ?, superseded_by = ? WHERE id = ?`)
          .run(event.action === 'cancel' ? 'cancelled' : 'superseded', id, prior.id);
      }
    }

    this.db
      .prepare(
        `INSERT INTO events (id, group_id, type, action, course, title, datetime, venue, notes, confidence, model, source_message_ids, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        groupId,
        event.type,
        event.action,
        event.course,
        event.title,
        event.datetime,
        event.venue,
        event.notes,
        event.confidence,
        model,
        JSON.stringify(event.sourceMessageIds),
        event.action === 'cancel' ? 'cancelled' : 'active',
      );
    return id;
  }

  activeEvents(groupId?: string): Array<Record<string, unknown>> {
    if (groupId) {
      return this.db
        .prepare(`SELECT * FROM events WHERE status = 'active' AND group_id = ? ORDER BY datetime`)
        .all(groupId) as Array<Record<string, unknown>>;
    }
    return this.db.prepare(`SELECT * FROM events WHERE status = 'active' ORDER BY datetime`).all() as Array<
      Record<string, unknown>
    >;
  }

  getEvent(id: string): Record<string, unknown> | null {
    const row = this.db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ?? null;
  }

  // ---------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------

  listGroups(): Array<Record<string, unknown>> {
    return this.db.prepare('SELECT * FROM groups ORDER BY display_name IS NULL, display_name, group_id').all() as Array<
      Record<string, unknown>
    >;
  }

  getGroup(groupId: string): Record<string, unknown> | null {
    const row = this.db.prepare('SELECT * FROM groups WHERE group_id = ?').get(groupId) as
      | Record<string, unknown>
      | undefined;
    return row ?? null;
  }

  /** Admin/rep-facing: name a group so the app shows "Calculus 101" instead of a raw group id. */
  setGroupDisplayName(groupId: string, displayName: string): void {
    this.db
      .prepare(
        `INSERT INTO groups (group_id, display_name) VALUES (?, ?)
         ON CONFLICT(group_id) DO UPDATE SET display_name = excluded.display_name`,
      )
      .run(groupId, displayName);
  }

  // ---------------------------------------------------------------------
  // Students & subscriptions
  // ---------------------------------------------------------------------

  createStudent(name?: string | null): { id: string; name: string | null } {
    const id = randomUUID();
    this.db.prepare('INSERT INTO students (id, name) VALUES (?, ?)').run(id, name ?? null);
    return { id, name: name ?? null };
  }

  getStudent(id: string): Record<string, unknown> | null {
    const row = this.db.prepare('SELECT * FROM students WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ?? null;
  }

  /** One-time setup: a student subscribes to a class group's planner feed. */
  subscribe(studentId: string, groupId: string): void {
    this.registerGroup(groupId);
    this.db
      .prepare('INSERT OR IGNORE INTO subscriptions (student_id, group_id) VALUES (?, ?)')
      .run(studentId, groupId);
  }

  /** Returns true if a subscription existed and was removed. */
  unsubscribe(studentId: string, groupId: string): boolean {
    const res = this.db
      .prepare('DELETE FROM subscriptions WHERE student_id = ? AND group_id = ?')
      .run(studentId, groupId);
    return res.changes > 0;
  }

  listSubscriptions(studentId: string): Array<Record<string, unknown>> {
    return this.db
      .prepare(
        `SELECT g.* FROM subscriptions s JOIN groups g ON g.group_id = s.group_id
         WHERE s.student_id = ? ORDER BY g.display_name IS NULL, g.display_name`,
      )
      .all(studentId) as Array<Record<string, unknown>>;
  }

  /** The personal planner: active events across every group the student subscribes to. */
  eventsForStudent(studentId: string): Array<Record<string, unknown>> {
    return this.db
      .prepare(
        `SELECT e.* FROM events e
         JOIN subscriptions s ON s.group_id = e.group_id
         WHERE s.student_id = ? AND e.status = 'active'
         ORDER BY e.datetime IS NULL, e.datetime`,
      )
      .all(studentId) as Array<Record<string, unknown>>;
  }

  close(): void {
    this.db.close();
  }
}
