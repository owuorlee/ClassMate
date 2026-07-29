# ClassMate — Architecture

> Verified against the code on 2026-07-28. Items tagged **[UNVERIFIED]** were not observed running.

---

## 1. System shape

Two **independent Node processes** share one SQLite file. This separation is deliberate: a
Baileys crash or WhatsApp protocol break must not take the student-facing API down.

```
        WhatsApp group (real students, unchanged behaviour)
                 │  messages
                 ▼
  ┌────────────────────────────────────────────────────────────┐
  │ PROCESS 1 — ingestion        `npm run dev`  (src/index.ts) │
  │                                                            │
  │  BaileysSource ──┐                                         │
  │  ChatExportSource├─► MessageSource ─► Store.markSeen (dedup)│
  │  FakeSource ─────┘                          │              │
  │                                             ▼              │
  │                                      MessageBuffer         │
  │                            (per-group; flush on 10 min     │
  │                             OR 25 msgs, whichever first)   │
  │                                             │ batch        │
  │                                             ▼              │
  │                                        Extractor           │
  │                          ┌──────────────────┴───────────┐  │
  │                          │ 1. PRIMARY  (flash-lite)     │  │
  │                          │ 2. zod validate              │  │
  │                          │ 3. if invalid JSON OR any    │  │
  │                          │    confidence < 0.8  ──►     │  │
  │                          │    ESCALATION (flash)        │  │
  │                          └──────────────────┬───────────┘  │
  │                                             ▼              │
  │                                   Store.saveEvent          │
  │                              (reconcile create/update/     │
  │                               cancel) ─► Notifier          │
  └───────────────────────────────┬────────────────────────────┘
                                  │ writes
                          ┌───────▼────────┐
                          │  classmate.db  │  SQLite, WAL mode
                          └───────▲────────┘
                                  │ reads
  ┌───────────────────────────────┴────────────────────────────┐
  │ PROCESS 2 — Planner API      `npm run api` (apiServer.ts)  │
  │  Express 5 · 12 routes · zod body validation               │
  └───────────────────────────────┬────────────────────────────┘
                                  │ HTTP JSON
                                  ▼
                       Mobile app (Expo / React Native)
                   PlannerScreen · GroupsScreen · ProfileScreen
```

**WAL mode** (`PRAGMA journal_mode = WAL`, `store/db.ts:17`) is what makes concurrent
read-while-write safe. Do not remove it.

## 2. Request/data flow

### 2a. Ingestion path (message → stored event)
1. `BaileysSource` receives a `messages.upsert` event with `type === 'notify'` (live messages
   only; history sync is ignored).
2. `toIncoming()` filters: group JIDs only (`@g.us`), not `fromMe`, must have text. Text is
   pulled from `conversation`, `extendedTextMessage.text`, or an image/video/document `caption`
   (captions matter — announcements often ride along with a photo).
3. Emitted as `IncomingMessage` — **the only shape downstream code sees**.
4. `index.ts` calls `store.markSeen(id, groupId)`. Returns `true` if already processed → dropped.
   This is what makes reconnects and replays idempotent.
5. `MessageBuffer.add()` drops messages under 3 characters (free stage-0 noise filter), then
   buffers per group.
6. On flush, `Extractor.extract(messages)` builds one prompt containing the whole batch plus
   each message's timestamp, and calls the LLM.
7. Response is stripped of code fences, `JSON.parse`d, and validated with zod. Failure or low
   confidence → escalate; if escalation also fails, fall back to the primary's events
   (a low-confidence CAT beats a silently dropped one).
8. Each event goes to `store.saveEvent(groupId, event, model)`, then `notifier.eventDetected()`.

### 2b. Read path (app → planner)
```
GET /students/:id/planner
  → Store.eventsForStudent(studentId)
  → SELECT e.* FROM events e
      JOIN subscriptions s ON s.group_id = e.group_id
     WHERE s.student_id = ? AND e.status = 'active'
     ORDER BY e.datetime IS NULL, e.datetime      -- undated events sort last
  → raw snake_case rows as JSON
  → app/src/api/client.ts mapEvent() converts to camelCase PlannerEvent
  → lib/datetime.ts groupIntoSections() buckets into Today / Tomorrow / …
  → PlannerScreen renders
```
**Note the boundary quirk:** the API returns **raw SQLite rows in snake_case**
(`group_id`, `display_name`). There is no serialization layer. The app compensates in
`mapEvent()`. If you add a DB column it appears in the API response automatically — which is
convenient and also how internals leak. See ROADMAP TASK-030.

## 3. Data model

SQLite. Schema is created idempotently in the `Store` constructor (`store/db.ts:16-70`).
**There is no migration tool** — adding a column to an existing DB requires a manual `ALTER TABLE`
or deleting the file. See TASK-031.

### `events` — the core table
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `randomUUID()` |
| `group_id` | TEXT NOT NULL | WhatsApp JID or replay group id |
| `type` | TEXT NOT NULL | `cat` \| `exam` \| `assignment` \| `class_update` \| `material` \| `announcement` |
| `action` | TEXT NOT NULL | `create` \| `update` \| `cancel` |
| `course` | TEXT NULL | as mentioned, e.g. "Soil Mechanics" |
| `title` | TEXT NOT NULL | short human title |
| `datetime` | TEXT NULL | ISO-8601 **with +03:00 offset**; NULL when undated |
| `venue` | TEXT NULL | |
| `notes` | TEXT NULL | |
| `confidence` | REAL NOT NULL | 0..1, model's self-estimate |
| `model` | TEXT NOT NULL | which model produced it (audit trail) |
| `source_message_ids` | TEXT NOT NULL | **JSON array serialized as a string** |
| `status` | TEXT NOT NULL | `active` \| `superseded` \| `cancelled` |
| `superseded_by` | TEXT NULL | id of the event that replaced this one |
| `created_at` | TEXT | `datetime('now')` — **UTC, not Nairobi** |

Index: `idx_events_group (group_id, status)`.

### `seen_messages` — dedup ledger
`source_message_id` (PK), `group_id`, `seen_at`. **Message text is never stored here** —
data minimization.

### `groups` — auto-discovered
`group_id` (PK), `display_name` (NULL until an admin names it), `created_at`.
Rows are created by `registerGroup()`, called from both `markSeen()` and `saveEvent()`, so a
group exists the moment it is first seen. No manual registration step (least-friction rule).

### `students`
`id` (PK, `randomUUID()`), `name` (nullable), `created_at`. **No email, no password, no auth.**

### `subscriptions` — join table
`(student_id, group_id)` composite PK, `created_at`. Index `idx_subscriptions_group`.

```
students 1─────< subscriptions >─────1 groups 1─────< events
                                            1─────< seen_messages
```
**No foreign keys are declared.** Subscribing to a nonexistent group silently creates the group
row. Deleting a student leaves orphaned subscriptions. (TASK-032.)

### Event reconciliation — the subtle part
`saveEvent()` (`store/db.ts:93`): when `action` is `update` or `cancel`, it finds the **newest
active event matching `group_id + type + case-insensitive course`**, marks it
`superseded`/`cancelled`, and points `superseded_by` at the new row. The new row is inserted
`active` (or `cancelled` for a cancel).

**Known limitation:** matching ignores date and title, so two distinct CATs for the same course
in one group will incorrectly supersede each other. Real data contains "PDE cat 3", implying
numbered sequences. See TASK-024.

## 4. Auth / permissions

**There is none.** Explicitly:
- No login, no sessions, no tokens, no password.
- Any client that knows a `student_id` (a UUID) can read that student's planner and modify
  their subscriptions.
- Any client can `PATCH /groups/:groupId` and rename any group.
- No rate limiting, no CORS configuration, no security headers.

This is adequate only for a closed pilot where the owner hands out IDs. It is a **launch blocker**
for anything public. See ROADMAP milestone **M3**.

## 5. Frontend state management

Deliberately minimal — **no Redux, no Zustand, no React Query**. Each screen owns its data with
`useState` + `useEffect`, and an `alive` flag guards against setting state after unmount:

```ts
useEffect(() => {
  let alive = true;
  fetchPlanner('demo-student')
    .then((evs) => { if (!alive) return; setEvents(evs); })
    .catch(() => {})          // <-- swallows errors; see TASK-004
    .finally(() => alive && setLoading(false));
  return () => { alive = false; };
}, []);
```
Derived data uses `useMemo` (`nextUp`, `groupIntoSections`). There is **no cache, no refetch, no
pull-to-refresh** — data loads once on mount.

If you introduce a data layer, follow this pattern's spirit: keep it in `src/api/client.ts` and
leave screens declarative.

**Styling:** all visual values come from `src/theme/tokens.ts` (`colors`, `spacing`, `radius`,
`type`, `category`, `shadow`) via `StyleSheet.create`. **Never hardcode a colour or a font size.**

## 6. Key architectural decisions

| Decision | Constraint behind it | Consequence for you |
|---|---|---|
| **`MessageSource` interface isolates Baileys** | Baileys is reverse-engineered and breaks when Meta changes the protocol. | A protocol break is a one-file fix (`sources/baileys.ts`). The whole pipeline is testable with `FakeSource` — **no test needs WhatsApp or a network**. Never `import baileys` outside that file. |
| **Bot is a pure listener** | Ban-risk data: listeners <2%/yr, senders 15–30%. | Never add send capability. Notifications go through the app. |
| **Micro-batching, not per-message calls** | Cost, and context. | One call sees ~25 messages, so "imehamia Friday" can resolve against an earlier message. Real data confirmed events split across messages. |
| **Cheap-first cascade with confidence escalation** | Frontier models are 10–30× the price; most batches are easy. | Keep the cheap model as `PRIMARY`. Escalation should stay <5% of batches. |
| **zod-validate every LLM response** | LLMs emit malformed JSON and hallucinated enums. | Never `JSON.parse` an LLM response without validating. Pattern in `extractor.ts:tryModel`. |
| **`node:sqlite`, no ORM** | Windows dev machine; native modules were a pain. | Requires Node ≥ 22.13. All SQL lives in `store/db.ts` — put new queries there, not in routes. |
| **Two processes, one DB file** | Ingestion stability must not affect the API. | Keep them separate. WAL makes it safe. |
| **Store IDs + events only, never raw chat** | Kenya DPA 2019 + ethics. | Do not add a `messages` table to "make debugging easier". |
| **App ships with demo data (`isMock`)** | Owner had no working device preview; a blank app is undemoable. | Demo data must never reach production. See TASK-003. |

## 7. The extraction prompt

`src/pipeline/prompt.ts` holds `SYSTEM_PROMPT` (rules + Sheng glossary + few-shot examples) and
`buildUserPrompt(messages, now)` which renders the batch with per-message timestamps and the
current datetime, so relative dates ("kesho", "saa nane") resolve correctly.

**This file is the single highest-leverage lever on accuracy.** Real-data patterns it does not
yet handle are listed in HANDOFF.md §10 Landmines (item 10) and are roadmap tasks TASK-014/015.

Improve it by adding few-shot examples from the real labeled corpus — **not** by switching to a
bigger model.
