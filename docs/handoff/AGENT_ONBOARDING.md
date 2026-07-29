# START HERE — Onboarding for the incoming agent

**You are taking over ClassMate. You have no memory of this project. Read this page fully, then
follow the reading order below before writing a single line of code.**

## What this is, in three sentences

ClassMate turns Kenyan university WhatsApp class groups into a clean personal planner for
students. A silent bot (Baileys) reads a class group, an LLM extracts the academic facts buried
in Sheng/Kiswahili/English chatter — CAT dates, deadlines, venue changes — and a React Native app
shows each student their events. The backend and app are built and tested; **the AI's real-world
accuracy is unmeasured and the bot has never connected to real WhatsApp.**

## Reading order (do not skip, do not reorder)

1. **`PROGRESS_LOG.md`** — the most recent entries. This is the project's memory; it tells you
   what just happened and what's next.
2. **`STATE_OF_PLAY.md`** — what is real vs stubbed. **The most important document here.** Several
   things look finished but are demo data. Do not mistake a stub for a feature.
3. **`HANDOFF.md`** — product, stack, how to run it, env vars, codebase map, **landmines**.
4. **`ARCHITECTURE.md`** — how the pieces fit; the data model; why it's built this way.
5. **`ROADMAP_TO_PRODUCTION.md`** — every remaining task, in dependency order, with acceptance criteria.
6. **`QUALITY_STANDARDS.md`** — the rules you must follow. Read before your first change.

Then read the actual code for the files your task touches. **The code is the truth; these docs
are a description of it as of 2026-07-28.**

## Your operating loop — every session, in this order

1. **Read `PROGRESS_LOG.md`** (latest entries first).
2. **Pick the next unblocked task** from `ROADMAP_TO_PRODUCTION.md`. Respect `Depends on:`.
   Prefer P0. Some tasks require the human — if that's the next one, say so and pick another.
3. **Re-read the files the task lists** before editing them. Don't work from these docs alone.
4. **Implement** exactly that task — nothing more.
5. **Verify** by running the commands in the task's "How to verify". Capture the real output.
6. **Append an entry to `PROGRESS_LOG.md`** using its template, pasting the real output.
7. **Commit** with `TASK-NNN: <message>`.

One task per session. If a task turns out to be bigger than one session, split it, log the split,
and say so.

## Hard rules — never break these

1. **Never make the bot send a WhatsApp message.** It is a pure listener. Sending multiplies the
   account-ban risk roughly 10×. All output to students goes through the app.
2. **Never propose rep-forwarding** (asking class reps to forward messages to a bot). The owner
   explicitly and permanently rejected it. It destroys the product's core value.
3. **Never commit** `.env`, `baileys-auth/`, `TXT Files/`, `server/eval-data/`, `*.db`, or
   `node_modules/`. `TXT Files/` contains real students' private messages.
4. **Never let mock/demo data reach a production path.** `app/src/data/mock.ts` contains fake
   CATs. Real students acting on fake academic info is this product's worst possible failure.
5. **Never bump the Expo SDK** (pinned to 56 on purpose — 57 broke the owner's only preview path).
6. **Never fabricate.** No invented APIs, env vars, file paths, or CLI flags. If you didn't verify
   it, label it `[UNVERIFIED]`. A confident wrong claim damages this project more than "I don't know".
7. **Never claim a green build you didn't run.** Paste real output.
8. **Never import Baileys outside `server/src/sources/baileys.ts`.**
9. **Never leave an empty catch block** or a swallowed error.
10. **When the code contradicts these docs, the code wins** — fix the doc and flag it.

## Quick facts you'll need immediately

- **Two npm projects:** `server/` (Node/TS backend) and `app/` (Expo/React Native).
- **Node ≥ 22.13 required** (uses built-in `node:sqlite`). Verified on v24.12.0.
- Verify the backend: `cd server && npm run typecheck && npm test && npm run build`
  → expect **45 tests passing, 6 files**, all offline (no API key or network needed).
- Run the API: `cd server && npm run api` → `http://localhost:4000`, `GET /health` → `{"ok":true}`.
- Preview the app: `cd app && npx expo start --web`. **Expo Go on a phone does not work** — use web.
- `ExperimentalWarning: SQLite is an experimental feature` on startup is **normal**, not an error.

## The single most valuable thing you can do

Get **TASK-001** (human labels the gold set) unblocked, then **TASK-002** (build the eval harness).
Until extraction accuracy is measured on real messages, every other improvement is guesswork —
and the real corpus has already shown the current prompt mishandles common real-world patterns.

If TASK-001 is still pending with the human, the best unblocked work is **TASK-031** (migration
system), **TASK-011** (declare `react-native-worklets`), or **TASK-022** (replay cost guard).
