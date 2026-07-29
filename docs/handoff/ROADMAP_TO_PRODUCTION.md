# ClassMate — Roadmap to Production

> Every remaining piece of work from 2026-07-28 to launch, in dependency order.
> Each task is sized for **one short agent session**. Do not batch tasks.

## Assumptions — CONFIRM WITH THE OWNER BEFORE M5

The owner did not answer these before handoff. Everything below assumes:
- **A1: Pilot first.** Goal is 1–2 real class groups working end-to-end, then widen. P0 = the
  pilot; public-scale hardening is P1.
- **A2: Deploy to a small always-on Linux VPS** (~$5/mo). **Constraint:** Baileys needs a
  persistent WebSocket; serverless and sleeping free tiers will drop the session repeatedly.
- **A3: Android first** (dominant on Kenyan campuses).

If any assumption is wrong, M5 changes. Ask before starting M5.

## Priorities
- **P0** — blocks launch. Do these.
- **P1** — should have. Do if capacity allows.
- **P2** — post-launch. Cut first.

## Milestones
| | Milestone | Theme |
|---|---|---|
| M1 | Prove the AI works | Measure and fix extraction accuracy on real data |
| M2 | Prove ingestion works | Get a real WhatsApp connection running reliably |
| M3 | Make it real & safe | Auth, real data in the app, security |
| M4 | Robustness | Errors, validation, tests, resilience |
| M5 | Ship it | Deploy, CI, monitoring, backups |
| M6 | Launch | Pilot, legal, checklist |

---

# M1 — Prove the AI works

> **Nothing else matters if extraction is inaccurate.** This is the highest-risk unknown.
> TASK-001 requires a human and blocks M1.

### TASK-001: Human-label the 268-message gold set
- Milestone: M1 · **P0** · Depends on: none · **REQUIRES THE HUMAN OWNER**
- Why: Nothing about accuracy can be measured without an answer key.
- Files to touch: none (produces `server/eval-data/labeled.jsonl`)
- Approach:
  1. `cd server && npx tsx src/eval/buildCorpus.ts "../TXT Files" 260` (only if `tolabel.jsonl` is missing — **it overwrites**).
  2. Open `server/src/eval/labeler.html` in a browser; load `server/eval-data/tolabel.jsonl`.
  3. Label all 268. Keys: `Y`/`N` academic, `1-6` type, `C/U/X` action, `→` next.
  4. Rule: **yes** only for actionable academic info. **no** for questions ("kuna class leo?"),
     chatter, acknowledgements — even if a course is mentioned.
  5. Click **Save labels** → save as `server/eval-data/labeled.jsonl`.
- Acceptance criteria: `labeled.jsonl` exists; every row has `label.academic` non-null; ≥25 rows have `academic: true`.
- How to verify:
  ```bash
  node -e "const r=require('fs').readFileSync('eval-data/labeled.jsonl','utf8').trim().split('\n').map(JSON.parse); console.log('total',r.length,'unlabeled',r.filter(x=>!x.label||x.label.academic===null).length,'positive',r.filter(x=>x.label&&x.label.academic).length)"
  ```
  Passing: `unlabeled 0`, `positive >= 25`.
- Out of scope: changing the prompt, the sampler, or any code.

### TASK-002: Build the eval harness
- Milestone: M1 · **P0** · Depends on: TASK-001
- Why: Turns labels into a repeatable accuracy score so prompt changes can be judged.
- Files to touch: create `server/src/eval/runEval.ts`; create `server/test/runEval.test.ts`
- Approach:
  - CLI: `npx tsx src/eval/runEval.ts eval-data/labeled.jsonl [--model X] [--limit N]`.
  - Group labeled rows by `group`, order by timestamp, chunk into batches of `MAX_BATCH_SIZE`,
    map to `IncomingMessage` (see `src/types.ts`), and call `Extractor.extract()`.
  - Reuse the real `Extractor` and `GeminiClient` — do not reimplement the pipeline.
  - Match predictions to labels by `sourceMessageIds` overlap.
  - Print: **classification recall** (primary metric), precision, F1, per-type counts,
    a confusion summary, and a list of every miss (false negative) with its text.
  - Print estimated LLM calls **before** running and require `--yes` to proceed past 50 calls.
  - Write results to `eval-data/results-<ISO>.json` for comparison across runs.
- Acceptance criteria: runs end-to-end on `labeled.jsonl`; prints recall/precision/F1; lists false negatives; a unit test covers the metric maths with synthetic in/out (no network).
- How to verify: `npm test` passes; then `npx tsx src/eval/runEval.ts eval-data/labeled.jsonl --limit 40 --yes` prints a recall figure.
- Out of scope: changing the prompt (that's TASK-014/015); the app.

### TASK-014: Teach the prompt multi-event and split-event messages
- Milestone: M1 · **P0** · Depends on: TASK-002
- Why: Real reps post 3–4 CATs in one message, and often put the course in the *next* message. Current prompt handles neither well.
- Files to touch: `server/src/pipeline/prompt.ts`
- Approach:
  - Record the baseline recall from TASK-002 first.
  - Add 2–3 few-shot examples drawn from the **real** corpus (anonymized), e.g. the pattern
    "Cats...... Survey cat on monday from 4pm / PhE on Tuesday from 10am / Hydraulics 1 on Tuesday from 1pm"
    → three separate events; and "Let's have class tomorrow at 8am" + "Soil mechanics" → one event with the course from the following message.
  - **Hold these examples out of the eval set** or note the contamination in `PROGRESS_LOG.md`.
  - Keep the existing prompt structure and tone; append, don't rewrite.
- Acceptance criteria: recall on the gold set is **not lower** than baseline; multi-event messages now yield multiple events.
- How to verify: rerun TASK-002 harness; paste before/after numbers into `PROGRESS_LOG.md`.
- Out of scope: model changes, schema changes.

### TASK-015: Teach the prompt to reject questions and handle abbreviations
- Milestone: M1 · **P1** · Depends on: TASK-014
- Why: "Sasa mcomfirm kama kesho kuna exams" is a student asking, not an announcement — a prime false positive. Terse forms ("Tos from 11 venue will be ctc Lh", "PhE", "PDE cat 3") are missed.
- Files to touch: `server/src/pipeline/prompt.ts`
- Approach: add an explicit negative rule + 2 few-shot negatives (a question, an acknowledgement); extend the glossary with observed abbreviations. Append only.
- Acceptance criteria: precision improves or holds; recall does not drop more than 1 point.
- How to verify: rerun the harness; record before/after.
- Out of scope: rewriting existing examples.

### TASK-016: Model bake-off
- Milestone: M1 · **P1** · Depends on: TASK-015
- Why: Pick the cheapest model that clears the recall bar.
- Files to touch: none (config only); record findings in `PROGRESS_LOG.md`
- Approach: run the harness with `PRIMARY_MODEL` set to `gemini-2.5-flash-lite`, then `gemini-2.5-flash`. Compare recall, precision, and estimated cost (see `docs/AI_EXTRACTION_RESEARCH.md`).
- Acceptance criteria: a table of model × recall × precision × est. cost in `PROGRESS_LOG.md`, and a recommended default.
- How to verify: the table exists with real numbers from real runs.
- Out of scope: adding a new provider.

### TASK-017: Add LLM retry, timeout, and cost logging
- Milestone: M1 · **P0** · Depends on: TASK-002
- Why: `GeminiClient` has no timeout, no retry, and no usage logging. A transient 503 currently loses a whole batch.
- Files to touch: `server/src/pipeline/llm.ts`; `server/test/llm.test.ts` (new)
- Approach: wrap the call with an `AbortSignal` timeout (30s) and up to 2 retries with exponential backoff on 429/5xx only (never on 400). Log model, token usage if the SDK exposes it, and duration. Keep the `LlmClient` interface unchanged.
- Acceptance criteria: transient failure retries then succeeds; a 400 does not retry; timeout rejects cleanly; unit tests with a fake client cover all three.
- How to verify: `npm test`.
- Out of scope: changing the cascade logic in `extractor.ts`.

### TASK-018: Grow the gold set to ~600 labeled messages
- Milestone: M1 · **P2** · Depends on: TASK-016
- Why: 268 labels is thin for per-type accuracy on rarer types (`exam`, `material`).
- Files to touch: none (data only)
- Approach: rerun `buildCorpus.ts` with a larger sample — **download existing `labeled.jsonl` first, it overwrites**. Labels persist in browser localStorage by message-id hash. Label the new rows.
- Acceptance criteria: ≥600 labeled rows; ≥20 positives per event type or a note explaining why not.
- How to verify: the counting one-liner from TASK-001.
- Out of scope: prompt changes.

---

# M2 — Prove ingestion works

### TASK-019: First live Baileys connection (spike)
- Milestone: M2 · **P0** · Depends on: none · **REQUIRES THE HUMAN** (a dedicated SIM + phone)
- Why: The riskiest untested code in the repo. Nothing about the product works until this does.
- Files to touch: likely `server/src/sources/baileys.ts` (fixes only as needed)
- Approach:
  1. Read `docs/WHATSAPP_INGESTION_RISK.md` §4 first — number strategy is not optional.
  2. Use a **dedicated prepaid SIM**, never a personal number. Warm it (profile photo, name "ClassMate 📚", a few days of light use) before joining groups.
  3. `cd server && npm run dev` → scan the QR in the terminal.
  4. Have someone post a test message in a small test group. Confirm it reaches `onMessage`.
  5. Fix whatever breaks; keep the file's passive posture (`markOnlineOnConnect: false`, no read receipts, **never send**).
- Acceptance criteria: a real WhatsApp group message appears in the ingestion log and lands in `seen_messages`.
- How to verify: `npm run dev`, post a message, observe the log; then
  `node -e "const {DatabaseSync}=require('node:sqlite'); console.log(new DatabaseSync('./classmate.db').prepare('SELECT COUNT(*) c FROM seen_messages').get())"`
- Out of scope: multi-number support; the extractor.

### TASK-020: Baileys reconnect + logout handling verified
- Milestone: M2 · **P0** · Depends on: TASK-019
- Why: Sessions drop. Untested reconnect means silent, indefinite data loss.
- Files to touch: `server/src/sources/baileys.ts`
- Approach: kill the network mid-session and confirm exponential backoff reconnects and resumes. Confirm a `loggedOut` disconnect stops retrying and logs a clear "re-link required" message (that path already exists — verify it).
- Acceptance criteria: reconnects automatically after a network drop; does not hot-loop on logout; messages missed during the outage are handled (documented if lost).
- How to verify: disable the network, watch logs, re-enable, post a message, confirm it arrives.
- Out of scope: multi-number supervisor.

### TASK-021: Ingestion gap detection + alerting
- Milestone: M2 · **P1** · Depends on: TASK-020
- Why: A dead session looks identical to a quiet group. Silent staleness destroys the product's core trust promise.
- Files to touch: `server/src/index.ts`; `server/src/store/db.ts` (add `lastMessageAt` per group)
- Approach: extend the existing 60s heartbeat — if a group has had no message for N hours (configurable, default 24) OR the source reports disconnected, log a WARN with the group id. Store `last_message_at` on the `groups` row.
- Acceptance criteria: a stale group produces a warning; a healthy group does not; `last_message_at` updates on each message.
- How to verify: `npm test` (add a store test for `last_message_at`), plus a manual run with a short threshold.
- Out of scope: emailing/paging (M5).

### TASK-022: Replay cost guard
- Milestone: M2 · **P1** · Depends on: none
- Why: `npm run replay` on the largest export is ~210 unprompted LLM calls.
- Files to touch: `server/src/index.ts`
- Approach: in replay mode, count buffered batches before flushing; print the estimated call count and require `--yes` (or an interactive confirm) above a threshold (default 20). Add `--limit N` to cap batches.
- Acceptance criteria: replay above threshold without `--yes` exits without calling the LLM and explains why; with `--yes` it proceeds.
- How to verify: `npx tsx src/index.ts --replay "../TXT Files/WhatsApp Chat with Mechanical Engineering(social group).txt" g1` → refuses; adding `--yes` proceeds.
- Out of scope: changing batching logic.

### TASK-023: Multi-number session supervisor
- Milestone: M2 · **P2** · Depends on: TASK-020
- Why: One number should carry ~10–20 groups; more needs several numbers so one ban has a small blast radius.
- Files to touch: create `server/src/sources/supervisor.ts`; `server/src/index.ts`
- Approach: a `MessageSource` that owns N `BaileysSource` instances (one auth dir each), fans their `onMessage` into one stream, and aggregates `health()`. Config: a JSON list of auth dirs.
- Acceptance criteria: two sources run concurrently; both feed one pipeline; `health()` reports per-session state; one failing session doesn't stop the other.
- How to verify: unit test with two `FakeSource`s; `npm test`.
- Out of scope: automatic re-linking.

### TASK-024: Fix event reconciliation collisions
- Milestone: M2 · **P1** · Depends on: none
- Why: `saveEvent` matches on `group+type+course` only, so "PDE cat 3" and "PDE cat 4" supersede each other.
- Files to touch: `server/src/store/db.ts`; `server/test/store.test.ts`
- Approach: tighten matching — also require the prior event's `datetime` to be within a window (e.g. ±14 days) of the new one, or the titles to be similar. Prefer an explicit, readable rule over cleverness. Follow the existing prepared-statement style.
- Acceptance criteria: two distinct CATs for one course coexist as `active`; a genuine reschedule still supersedes; existing store tests still pass.
- How to verify: `npm test` with new cases for both.
- Out of scope: schema redesign.

---

# M3 — Make it real & safe

### TASK-003: Remove demo-data fallback from production builds
- Milestone: M3 · **P0** · Depends on: none
- Why: A misconfigured production build silently shows **fake CATs** to real students. This is the most dangerous stub in the repo.
- Files to touch: `app/src/api/client.ts`
- Approach: keep the mock path for development only — gate it on `__DEV__` (React Native global). In production with no `EXPO_PUBLIC_API_URL`, throw a clear configuration error rather than serving `mock.ts`.
- Acceptance criteria: dev with no URL → demo data (unchanged); production build with no URL → explicit error, never fake data.
- How to verify: `npx tsc --noEmit`; `npx expo export --platform web` exits 0; inspect that the production path cannot reach `MOCK_EVENTS`.
- Out of scope: deleting `mock.ts` (still used for dev/demo).

### TASK-004: Real error and retry states in the app
- Milestone: M3 · **P0** · Depends on: none
- Why: Three `.catch(() => {})` blocks mean a failed fetch renders a blank screen with no explanation.
- Files to touch: `app/src/screens/PlannerScreen.tsx`, `GroupsScreen.tsx`, `ProfileScreen.tsx`; create `app/src/components/ErrorState.tsx`
- Approach: add an `error` state alongside `loading`. Build `ErrorState` imitating `EmptyState.tsx` exactly (same tokens, same layout) with a message and a "Try again" button that refetches. Never swallow the error — log it and show it.
- Acceptance criteria: with the API unreachable, each screen shows a readable error and a working retry; no empty catch blocks remain in `app/src`.
- How to verify: `npx tsc --noEmit`; run `npx expo start --web` with `EXPO_PUBLIC_API_URL=http://localhost:9999` and confirm the error UI on all three tabs.
- Out of scope: offline caching.

### TASK-005: Student onboarding flow (replace `demo-student`)
- Milestone: M3 · **P0** · Depends on: TASK-004
- Why: `'demo-student'` is hardcoded in two screens; there is no way for a real student to exist.
- Files to touch: `app/src/screens/OnboardingScreen.tsx` (new); `app/App.tsx`; `app/src/api/client.ts`; `app/src/lib/session.ts` (new)
- Approach: on first launch, if no stored student id, show onboarding: enter name → `POST /students` → persist the returned id with `expo-secure-store` (add the dep; justify it in `PROGRESS_LOG.md`). Replace hardcoded ids with the stored one. Match the existing dark visual language via `theme/tokens.ts`.
- Acceptance criteria: fresh install → onboarding → planner loads for the created student; relaunch skips onboarding; no `'demo-student'` literal remains in `app/src`.
- How to verify: `grep -rn "demo-student" app/src` returns only `mock.ts`; `npx tsc --noEmit`; manual run against a live API.
- Out of scope: passwords, email verification (TASK-006).

### TASK-006: API authentication
- Milestone: M3 · **P0** · Depends on: TASK-005
- Why: Any caller with a UUID can read any planner and rename any group. Unacceptable beyond a closed pilot.
- Files to touch: `server/src/api/app.ts`; `server/src/store/db.ts`; `server/test/api.test.ts`; `app/src/api/client.ts`
- Approach: simplest defensible scheme — issue an opaque bearer token on `POST /students`, store its hash on the student row, require `Authorization: Bearer` on all `/students/:id/*` routes, and reject when the token's student ≠ `:id`. Put group-admin routes (`PATCH /groups/:id`) behind a separate admin token from env. Follow the existing `validate()` middleware style.
- Acceptance criteria: unauthenticated request → 401; token for student A on student B's planner → 403; valid token → 200; all existing API tests updated and passing.
- How to verify: `npm test` (add cases for 401/403/200).
- Out of scope: OAuth, refresh tokens, password reset.

### TASK-007: Group subscription flow in the app
- Milestone: M3 · **P1** · Depends on: TASK-005
- Why: `GroupsScreen` lists groups but a student cannot actually subscribe.
- Files to touch: `app/src/screens/GroupsScreen.tsx`; `app/src/api/client.ts`
- Approach: add `subscribe`/`unsubscribe` client functions hitting the existing endpoints; make group rows toggle subscription with optimistic UI and rollback on failure; show subscribed state clearly.
- Acceptance criteria: toggling updates the server and the planner reflects it; failure rolls back and surfaces an error.
- How to verify: `npx tsc --noEmit`; manual against a live API.
- Out of scope: group discovery/search.

### TASK-008: Populate `eventCount` on the groups endpoint
- Milestone: M3 · **P2** · Depends on: none
- Why: `GroupsScreen` shows "Listening" for every live group because the API never returns a count.
- Files to touch: `server/src/store/db.ts` (`listGroups`); `server/src/api/app.ts`; `app/src/api/client.ts`; `server/test/api.test.ts`
- Approach: `LEFT JOIN` active events and return `event_count`; map it in `fetchGroups()`.
- Acceptance criteria: `GET /groups` includes a correct `event_count`; the app displays it.
- How to verify: `npm test` with a case asserting the count.
- Out of scope: per-student counts.

### TASK-009: Push notifications
- Milestone: M3 · **P1** · Depends on: TASK-005, TASK-006
- Why: The core promise ("you'll never miss a CAT") needs a push, not a poll. `ConsoleNotifier` is a stub.
- Files to touch: `server/src/notify/notifier.ts` (new `ExpoPushNotifier`); `server/src/index.ts`; `server/src/store/db.ts` (store push tokens); `app/src/lib/push.ts` (new); `app/src/screens/ProfileScreen.tsx`
- Approach: use Expo's push service. App registers for a token and `POST`s it to a new endpoint; server stores it against the student; `ExpoPushNotifier` sends to all subscribers of the event's group. Wire the existing Profile toggle to actually enable/disable. Keep the `Notifier` interface.
- Acceptance criteria: a new event triggers a push to subscribed students; the toggle genuinely controls delivery and persists.
- How to verify: `npm test` for token storage + notifier fan-out (mocked HTTP); manual end-to-end on a device.
- Out of scope: digests, quiet hours, per-type preferences.

### TASK-010: Consent & disclosure at group onboarding
- Milestone: M3 · **P0** · Depends on: none
- Why: Kenya DPA 2019 and the project's stated ethics: "invisible" means no behaviour change, **not covert**.
- Files to touch: `docs/` (new `PRIVACY.md`); `app/src/screens/ProfileScreen.tsx` (link it)
- Approach: write a plain-language privacy notice — what is read, what is stored (IDs + academic events only), what is discarded, how to request deletion, contact. Document the rep-consent step in the onboarding runbook. Bot profile must be named "ClassMate 📚" with a clear description.
- Acceptance criteria: `PRIVACY.md` exists and is reachable from the app; the rep-consent step is written down.
- How to verify: file exists; the Profile row opens it.
- Out of scope: legal review (owner's call).

---

# M4 — Robustness

### TASK-011: Declare `react-native-worklets` explicitly
- Milestone: M4 · **P1** · Depends on: none
- Why: `babel.config.js` requires `react-native-worklets/plugin` but the package is only a transitive dep of Reanimated. A dependency shift breaks the build with a confusing Babel error.
- Files to touch: `app/package.json`
- Approach: add `react-native-worklets` at the exact version already installed (`node -e "console.log(require('react-native-worklets/package.json').version)"`). Do not upgrade anything else.
- Acceptance criteria: it appears in `dependencies`; the app still bundles.
- How to verify: `npx expo export --platform web` exits 0.
- Out of scope: any other dependency change.

### TASK-012: Add app-side `typecheck`, `lint`, and `test` scripts
- Milestone: M4 · **P1** · Depends on: none
- Why: `app/package.json` has no quality scripts, so CI cannot gate the app.
- Files to touch: `app/package.json`; `app/.eslintrc` or `eslint.config.js`
- Approach: add `"typecheck": "tsc --noEmit"`; add ESLint via `npx expo lint` conventions; add Jest via `jest-expo` with one smoke test rendering `EventCard`.
- Acceptance criteria: all three scripts run and pass.
- How to verify: `npm run typecheck && npm run lint && npm test` in `app/`.
- Out of scope: full component coverage.

### TASK-013: Validate path/query params at the API boundary
- Milestone: M4 · **P1** · Depends on: none
- Why: Bodies are zod-validated; path params are passed straight into SQL-bound queries unvalidated.
- Files to touch: `server/src/api/app.ts`; `server/test/api.test.ts`
- Approach: add a `validateParams(schema)` middleware mirroring the existing `validate()`. Constrain ids to reasonable length/charset. Reject oversized inputs with 400.
- Acceptance criteria: a 10,000-char id returns 400, not a DB error; valid ids unaffected.
- How to verify: `npm test` with new cases.
- Out of scope: auth (TASK-006).

### TASK-025: Structured logging with request IDs
- Milestone: M4 · **P1** · Depends on: none
- Why: `console.log` strings cannot be searched or correlated in production.
- Files to touch: create `server/src/lib/logger.ts`; `server/src/api/app.ts`; `server/src/index.ts`
- Approach: small JSON logger (level, msg, ts, context) — no new dependency unless justified. Attach a request id per API request and include it in error logs. Replace `console.*` in `src/` incrementally.
- Acceptance criteria: logs are single-line JSON with a level; API errors include a request id.
- How to verify: `npm run api`, hit an endpoint, observe JSON logs.
- Out of scope: shipping logs anywhere (TASK-029).

### TASK-026: Real health check
- Milestone: M4 · **P0** · Depends on: none
- Why: `/health` returns `{ok:true}` unconditionally — it would report healthy with a corrupt DB.
- Files to touch: `server/src/api/app.ts`; `server/src/store/db.ts`; `server/test/api.test.ts`
- Approach: run a trivial query (`SELECT 1`), report DB reachability, event count, and the most recent ingested message time. Return 503 when the DB check fails.
- Acceptance criteria: healthy → 200 with details; DB failure → 503.
- How to verify: `npm test`; `curl /health`.
- Out of scope: a separate metrics endpoint.

### TASK-027: Rate limiting and security headers
- Milestone: M4 · **P0** · Depends on: TASK-006
- Why: No rate limiting, no CORS policy, no security headers on a public API.
- Files to touch: `server/src/api/app.ts`; `server/src/config.ts`
- Approach: add a small in-memory rate limiter (per IP, per route class) — prefer hand-rolled over a new dep given the scale, or `express-rate-limit` with justification logged. Add an explicit CORS allowlist from env. Add basic security headers.
- Acceptance criteria: exceeding the limit returns 429; disallowed origins are rejected; headers present.
- How to verify: `npm test` with a burst test asserting 429.
- Out of scope: a WAF/CDN.

### TASK-028: Database indexes and integrity
- Milestone: M4 · **P1** · Depends on: TASK-031
- Why: Only two indexes exist; no foreign keys, so orphaned rows accumulate.
- Files to touch: `server/src/store/db.ts`; `server/test/store.test.ts`
- Approach: add indexes for the real query shapes (`events(datetime)`, `seen_messages(group_id)`), enable `PRAGMA foreign_keys = ON`, and declare FKs on `subscriptions`. **Must be delivered as a migration (TASK-031), not a bare schema edit** — existing DBs won't pick up new constraints.
- Acceptance criteria: deleting a student removes their subscriptions; queries use the indexes; existing tests pass.
- How to verify: `npm test`; `EXPLAIN QUERY PLAN` on the planner query.
- Out of scope: sharding, other engines.

### TASK-031: Minimal migration system
- Milestone: M4 · **P0** · Depends on: none
- Why: Schema is `CREATE TABLE IF NOT EXISTS` only. **Any column added later will not appear in an existing database**, and there is no way to evolve production data.
- Files to touch: create `server/src/store/migrations.ts`; `server/src/store/db.ts`; `server/test/migrations.test.ts`
- Approach: a `schema_version` table and an ordered array of migration functions applied in a transaction on startup. Migration 1 = the current schema. Keep it ~100 lines; no external dependency.
- Acceptance criteria: a fresh DB gets the full schema; an existing DB is upgraded without data loss; migrations are idempotent.
- How to verify: `npm test` covering fresh + upgrade paths.
- Out of scope: down-migrations.

### TASK-032: Integration test — ingestion to planner
- Milestone: M4 · **P1** · Depends on: TASK-031
- Why: Every layer is unit-tested but the wiring in `index.ts` is not tested at all.
- Files to touch: create `server/test/integration.test.ts`
- Approach: `FakeSource` + a mocked `LlmClient` (pattern in `extractor.test.ts`) → real `MessageBuffer`, `Extractor`, `Store` → then assert `GET /students/:id/planner` via supertest returns the event. No network.
- Acceptance criteria: a message emitted by `FakeSource` appears in a subscribed student's planner response.
- How to verify: `npm test`.
- Out of scope: Baileys.

### TASK-033: Accessibility and responsive pass on the app
- Milestone: M4 · **P1** · Depends on: TASK-004
- Why: Acceptance criteria, not polish. Touch targets, labels, and contrast are unverified.
- Files to touch: `app/src/components/*.tsx`, `app/src/screens/*.tsx`
- Approach: add `accessibilityLabel`/`accessibilityRole` to all touchables (`TabBar` especially); ensure ≥44×44pt targets; verify text contrast against `tokens.ts` colours meets WCAG AA; test at 320px width and with large system font.
- Acceptance criteria: every interactive element is labelled; no clipped layouts at 320px or at 200% font scale.
- How to verify: `npx expo start --web`, inspect at 320/375/768px and with enlarged font.
- Out of scope: a redesign.

---

# M5 — Ship it

> **Confirm assumptions A1–A3 with the owner before starting.**

### TASK-029: Dockerize both processes
- Milestone: M5 · **P0** · Depends on: TASK-031
- Why: Reproducible deploys; two processes must run side by side with a shared volume.
- Files to touch: create `server/Dockerfile`, `docker-compose.yml`, `.dockerignore`
- Approach: Node 24 base (must be ≥22.13 for `node:sqlite`), multi-stage build (`npm ci` → `npm run build` → slim runtime). Compose defines `ingestion` and `api` services sharing a named volume for the DB and `baileys-auth`. Never bake secrets in; pass env at runtime.
- Acceptance criteria: `docker compose up` starts both; the API answers `/health`; the DB persists across restarts.
- How to verify: `docker compose up -d && curl localhost:4000/health` → `{"ok":true}`; restart and confirm data survives.
- Out of scope: orchestration beyond compose.

### TASK-034: CI pipeline
- Milestone: M5 · **P0** · Depends on: TASK-012
- Why: Nothing currently prevents a broken commit reaching `main`.
- Files to touch: create `.github/workflows/ci.yml`
- Approach: on push/PR — Node 24 matrix; `cd server && npm ci && npm run typecheck && npm test && npm run build`; `cd app && npm ci && npm run typecheck && npm test`. Cache npm. No secrets needed (tests are offline).
- Acceptance criteria: CI passes on `main`; a deliberately broken test fails the run.
- How to verify: push a branch and observe the run.
- Out of scope: auto-deploy.

### TASK-035: Deploy to a VPS with process supervision
- Milestone: M5 · **P0** · Depends on: TASK-029 · **NEEDS OWNER: host + credentials**
- Why: Baileys needs a persistent connection — this cannot run on sleeping free tiers.
- Files to touch: create `docs/DEPLOYMENT.md`
- Approach: provision a small Linux VPS; install Docker; `docker compose up -d` with restart policies; reverse proxy (Caddy/nginx) with TLS in front of the API; firewall everything else. Document every step so it is reproducible.
- Acceptance criteria: API reachable over HTTPS; both containers restart automatically after reboot; ingestion session survives.
- How to verify: `curl https://<host>/health`; reboot the VPS and re-check.
- Out of scope: multi-region, autoscaling.

### TASK-036: Secrets management
- Milestone: M5 · **P0** · Depends on: TASK-035
- Why: Secrets currently live in a local `.env`. `baileys-auth/` credentials are the crown jewels — they are a live WhatsApp session.
- Files to touch: `docs/DEPLOYMENT.md`
- Approach: store env vars in the host's secret mechanism (Docker secrets or root-only `.env` with `chmod 600`). Document rotation for `GEMINI_API_KEY`. Ensure `baileys-auth/` is never in an image or a backup that leaves the host unencrypted.
- Acceptance criteria: no secret in git or in any image layer; rotation documented.
- How to verify: `git log -p | grep -i "api[_-]key"` finds no real key; `docker history` shows no secrets.
- Out of scope: a managed vault.

### TASK-037: Database backups
- Milestone: M5 · **P0** · Depends on: TASK-035
- Why: One SQLite file holds every event and student. No backup exists.
- Files to touch: create `server/scripts/backup.sh`; `docs/DEPLOYMENT.md`
- Approach: nightly `sqlite3 .backup` (or `VACUUM INTO`) — **never a raw file copy of a WAL database** — to a timestamped file, retain 7 daily copies, ship off-host. Document the restore procedure and test it once.
- Acceptance criteria: backups run on schedule; a restore into a clean environment has been performed and verified.
- How to verify: run the script, restore into a temp dir, query the restored DB.
- Out of scope: point-in-time recovery.

### TASK-038: Monitoring and alerting
- Milestone: M5 · **P1** · Depends on: TASK-026, TASK-035
- Why: Silent ingestion failure is the product's worst failure mode.
- Files to touch: `docs/DEPLOYMENT.md`
- Approach: external uptime monitor on `/health` (5-min interval), alert on 503 or timeout. Wire TASK-021's gap warnings to the same alert path.
- Acceptance criteria: stopping the API triggers an alert within ~10 minutes.
- How to verify: stop the container and confirm the alert fires.
- Out of scope: full metrics stack.

### TASK-039: Staging environment
- Milestone: M5 · **P1** · Depends on: TASK-035
- Why: Prompt and pipeline changes must be tried somewhere other than the group real students depend on.
- Files to touch: `docs/DEPLOYMENT.md`
- Approach: second compose stack with its own DB, its own bot number, and a private test group. Deploy there first, always.
- Acceptance criteria: staging runs independently; no shared DB or WhatsApp session with production.
- How to verify: both stacks up simultaneously with separate data.
- Out of scope: automated promotion.

### TASK-040: Rollback plan
- Milestone: M5 · **P1** · Depends on: TASK-034, TASK-037
- Why: Needed before the first risky deploy.
- Files to touch: `docs/DEPLOYMENT.md`
- Approach: tag images per release; document reverting to the previous tag, restoring a backup, and the (rare) case of re-linking a WhatsApp session. Keep it to a checklist someone can follow while stressed.
- Acceptance criteria: a rollback has been performed once on staging and timed.
- How to verify: perform it on staging; record the duration.
- Out of scope: automated rollback.

### TASK-041: Dependency audit
- Milestone: M5 · **P1** · Depends on: none
- Why: `npm install` reported moderate-severity advisories during setup; Baileys' ecosystem has a real supply-chain history (the `lotusbail` credential-stealer, April 2026).
- Files to touch: `server/package.json`, `app/package.json` (only if a fix is needed)
- Approach: run `npm audit` in both; fix what is genuinely exploitable in a server context; document accepted risks in `PROGRESS_LOG.md`. **Never install any third-party "anti-ban" WhatsApp package.**
- Acceptance criteria: no unaddressed high/critical advisories; accepted moderates documented with reasoning.
- How to verify: paste `npm audit` output into `PROGRESS_LOG.md`.
- Out of scope: major version upgrades (especially Expo — see landmines).

---

# M6 — Launch

### TASK-042: Pilot with one real class group
- Milestone: M6 · **P0** · Depends on: M1–M5 P0 tasks · **REQUIRES THE HUMAN**
- Why: Real students, real messages, real feedback before widening.
- Files to touch: none (produces `docs/PILOT_NOTES.md`)
- Approach: get the rep's explicit consent; add the warmed bot number; onboard ~5 students; run 2 weeks. Log every missed event and every false positive with the original message text — this becomes new gold-set data.
- Acceptance criteria: 2 weeks of continuous operation; a written list of misses/false positives; measured recall on real traffic.
- How to verify: `PILOT_NOTES.md` contains real numbers.
- Out of scope: expanding beyond one group.

### TASK-043: Pre-launch checklist
- Milestone: M6 · **P0** · Depends on: TASK-042
- Why: Final gate.
- Files to touch: create `docs/handoff/PRELAUNCH_CHECKLIST.md`
- Approach: a checklist covering — all P0 tasks closed; CI green; backups tested by restore; rollback rehearsed; monitoring alerting; no demo data reachable in production; auth enforced; secrets absent from git; privacy notice live and linked; rep consent obtained per group; bot number is dedicated and warmed; **bot cannot send**; error states verified; accessibility pass done.
- Acceptance criteria: every item ticked with evidence (command output or a link).
- How to verify: the document is complete with evidence.
- Out of scope: marketing.

### TASK-044: Play Store release (Android)
- Milestone: M6 · **P1** · Depends on: TASK-042 · **NEEDS OWNER: $25 dev account**
- Why: Expo Go cannot be the distribution channel (it is already failing on the owner's device).
- Files to touch: `app/app.json`, `app/eas.json` (new)
- Approach: configure EAS Build; produce a signed AAB; complete the store listing including a data-safety declaration consistent with `PRIVACY.md`. Internal testing track first.
- Acceptance criteria: an installable build runs on a real device with no Expo Go; internal testers can install it.
- How to verify: install the artifact on a physical Android device and complete onboarding.
- Out of scope: iOS (needs a Mac + $99/yr).

---

## Recommended order

**Sprint 1 (unblock everything):** TASK-001 → TASK-002 → TASK-017 → TASK-014
**Sprint 2 (prove it works):** TASK-019 → TASK-020 → TASK-022 → TASK-015
**Sprint 3 (make it real):** TASK-031 → TASK-003 → TASK-004 → TASK-005 → TASK-006
**Sprint 4 (harden):** TASK-026 → TASK-027 → TASK-013 → TASK-032 → TASK-011/012
**Sprint 5 (ship):** TASK-029 → TASK-034 → TASK-035 → TASK-036 → TASK-037
**Sprint 6 (launch):** TASK-010 → TASK-042 → TASK-043

**If capacity runs out, cut in this order:** all P2 → TASK-044 → TASK-038/039/040 → TASK-009.
**Never cut:** TASK-001, 002, 003, 019, 031, 006.
