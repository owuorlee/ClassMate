# ClassMate — Master Handoff

> Written 2026-07-28 by the outgoing agent (Claude). Everything here was verified by reading
> or running the code on that date unless tagged **[UNVERIFIED]**.
> Read [AGENT_ONBOARDING.md](AGENT_ONBOARDING.md) first if you are an AI agent.

---

## 1. What this product is

**ClassMate** turns the chaos of Kenyan university WhatsApp class groups into a clean personal
planner. A silent bot account sits in a class group, an AI pipeline reads the messages and
extracts only the academic facts — CAT dates, assignment deadlines, venue changes, cancelled
lectures, shared notes — and each student sees them as structured events in a mobile app.

**Who it is for:** Kenyan university students (initial target: JKUAT), especially in large
courses of 100–300 where the WhatsApp class group is the only student-to-student channel.

**The problem:** Critical academic info is posted once, in Sheng/Kiswahili/English, then buried
under memes within the hour. Students miss CATs and submit late. There is no official digital
layer between students.

**Core user journeys**
1. *Class rep* posts "CAT ya Calculus imehamia Friday 3PM, venue ni LT5 sio LT2" — and does
   nothing else, ever. **Rep behaviour never changes.**
2. *Bot* (already in the group) reads it silently. Never replies, never posts.
3. *Pipeline* batches recent messages, sends them to an LLM, extracts a structured event, and
   reconciles it against existing events (this one is an `update`, so it supersedes the old CAT).
4. *Student* opens ClassMate and sees "Calculus II CAT · Friday 3:00 PM · LT5" in their planner.
   One-time setup; nothing to do afterwards.

## 2. Current status — one honest sentence

**Backend ingestion + extraction + Planner API are built and tested (45 passing tests) but have
never processed a real WhatsApp connection or been deployed; the mobile app is a working
UI shell wired to hardcoded demo data; the AI's real-world accuracy is completely unmeasured.**

## 3. Locked product decisions (do not relitigate)

These were decided deliberately by the product owner. Changing them requires his explicit say-so.

| Decision | Rationale |
|---|---|
| **Baileys (unofficial WhatsApp bridge) is the foundation** | Meta's official Cloud API caps groups at **8 participants** and cannot join an existing student group — it structurally cannot do this job. See [WHATSAPP_INGESTION_RISK.md](../WHATSAPP_INGESTION_RISK.md). |
| **The bot NEVER sends a message** | Pure listeners sit in the lowest ban-risk tier. All student output goes through the app. Adding any send capability would multiply ban risk ~10x. |
| **No rep-forwarding, ever** | Owner explicitly rejected any flow where reps forward messages to a bot. It adds friction and destroys the core value (invisibility). **Do not propose this again.** |
| **Least friction** | Reps and students change nothing after one-time setup. Any feature requiring ongoing user effort is wrong by default. |
| **Data minimization** | Raw social chatter is never stored — only message IDs (dedup) and extracted academic events. Kenya Data Protection Act 2019 applies. |

## 4. Tech stack (versions verified from installed `node_modules`, 2026-07-28)

**Runtime:** Node **v24.12.0**, npm **11.6.2**.
`node:sqlite` requires Node ≥ 22.13 — **do not run this on Node 20**.

### `server/` — ingestion, extraction, API
| Package | Installed | Why |
|---|---|---|
| `@whiskeysockets/baileys` | 6.7.23 | WhatsApp Web protocol client. Only viable way to read existing large groups. |
| `@google/genai` | 1.52.0 | Gemini SDK. **ESM-only** — `require()` fails, `import` works. |
| `express` | 5.2.1 | Planner API. v5 auto-forwards async rejections to the error handler. |
| `zod` | 3.25.76 | Validates LLM JSON output and API request bodies. |
| `dotenv` | 16.6.1 | Env loading. |
| `qrcode-terminal` | 0.12.0 | Prints the Baileys pairing QR. Has a local `.d.ts` shim (`src/qrcode-terminal.d.ts`) — no upstream types. |
| `typescript` | 5.9.3 | strict mode on. |
| `vitest` | 3.2.6 | Test runner. |
| `tsx` | 4.23.0 | Runs TS directly; all npm scripts use it. |
| `supertest` | 7.2.2 | HTTP assertions against the Express app. |

**Storage is `node:sqlite` (built into Node) — deliberately, to avoid native build pain on
Windows.** No `better-sqlite3`, no ORM, no migration tool. Schema is `CREATE TABLE IF NOT EXISTS`
in the `Store` constructor.

### `app/` — student mobile app
| Package | Installed | Why |
|---|---|---|
| `expo` | 56.0.15 | **Pinned to SDK 56 on purpose** — see Landmines. |
| `react-native` | 0.85.3 | |
| `react` / `react-dom` | 19.2.3 | |
| `@react-navigation/native` | 7.3.8 | |
| `@react-navigation/bottom-tabs` | 7.18.8 | Tab shell; rendered via a custom `TabBar`. |
| `react-native-reanimated` | 4.3.1 | Entrance animations. |
| `react-native-web` | 0.21.2 | Lets the app run in a browser — **the only way the owner can currently preview it**. |
| `lucide-react-native` | 1.24.0 | Icon set. |
| `@expo-google-fonts/sora`, `/inter` | 0.4.2 | Display + body fonts. |
| `typescript` | ~6.0.3 (declared) | |

## 5. Get running in 10 minutes

Prerequisite: Node ≥ 22.13 (verified on v24.12.0), git.

### 5a. Backend
```bash
cd server
npm install
cp .env.example .env      # then edit: set GEMINI_API_KEY
```
Get a free Gemini API key at <https://aistudio.google.com>. Free tier is sufficient for development.

Verify (all four were run on 2026-07-28 and passed):
```bash
npm run typecheck   # expected: no output, exit 0
npm test            # expected: "Test Files 6 passed (6)"  "Tests 45 passed (45)"
npm run build       # expected: exit 0, emits dist/
npm run api         # expected: "[api] listening on http://localhost:4000 (db: ./classmate.db)"
```
With the API running, in another terminal:
```bash
curl http://localhost:4000/health      # expected: {"ok":true}
curl http://localhost:4000/groups      # expected: []  (empty until data is ingested)
```
> An `ExperimentalWarning: SQLite is an experimental feature` line on startup is **normal and
> expected** from `node:sqlite`. It is not an error.

### 5b. Mobile app
```bash
cd app
npm install
npx expo start --web    # opens a browser; app runs with bundled demo data
```
`npx expo export --platform web` was run on 2026-07-28 and exited 0.

**Expo Go on a physical phone does not currently work** — see Landmines. Web is the working
preview path.

To point the app at a live backend instead of demo data:
```bash
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000 npx expo start --web
```
Use the machine's LAN IP, never `localhost`, if a phone is involved.

### 5c. Eval tooling (AI accuracy work)
```bash
cd server
npx tsx src/eval/buildCorpus.ts "../TXT Files" 260
```
Reads the raw exports, anonymizes them, writes `eval-data/corpus.jsonl` (8,377 messages) and
`eval-data/tolabel.jsonl` (268 sampled messages awaiting human labels).
Then open `server/src/eval/labeler.html` in a browser and load `eval-data/tolabel.jsonl`.

## 6. Environment variables (`server/.env`)

| Name | Purpose | Example | Where to get it | Required for local dev? |
|---|---|---|---|---|
| `GEMINI_API_KEY` | Auth for Gemini extraction calls | *(never commit a real key)* | <https://aistudio.google.com> | **Yes** for `npm run dev`/`replay`. **No** for `npm run api` or tests. |
| `PRIMARY_MODEL` | Cheap first-pass model | `gemini-2.5-flash-lite` | — | No (has default) |
| `ESCALATION_MODEL` | Stronger model for low-confidence batches | `gemini-2.5-flash` | — | No (default) |
| `CONFIDENCE_THRESHOLD` | Below this, escalate | `0.8` | — | No (default 0.8) |
| `FLUSH_INTERVAL_MS` | Buffer window per group before an LLM call | `600000` (10 min) | — | No (default) |
| `MAX_BATCH_SIZE` | Flush early at N messages | `25` | — | No (default) |
| `DB_PATH` | SQLite file | `./classmate.db` | — | No (default) |
| `API_PORT` | Planner API port | `4000` | — | No (default 4000) |
| `SOURCE` | `baileys` \| `fake` | `baileys` | — | No (default). **[UNVERIFIED]: declared in config.ts and .env.example but `src/index.ts` never reads `config.source` — it branches on the `--replay` CLI flag instead. This var currently does nothing.** |
| `BAILEYS_AUTH_DIR` | WhatsApp session credentials dir | `./baileys-auth` | — | No (default). **Secret — gitignored, never commit.** |

App-side: `EXPO_PUBLIC_API_URL`. Unset ⇒ app uses bundled demo data.

## 7. External services

| Service | Role | Notes |
|---|---|---|
| **Google Gemini API** | All extraction. `GeminiClient` in `src/pipeline/llm.ts`. | Only external paid dependency. Free tier adequate for dev. Cost analysis: [AI_EXTRACTION_RESEARCH.md](../AI_EXTRACTION_RESEARCH.md). |
| **WhatsApp (via Baileys)** | Message ingestion. | Unofficial. ToS risk analysed in [WHATSAPP_INGESTION_RISK.md](../WHATSAPP_INGESTION_RISK.md). Requires a dedicated phone number. |
| **GitHub** | `https://github.com/owuorlee/ClassMate` | Single branch `main`. |
| Push notifications | Not integrated. | Planned; nothing exists yet. |

## 8. Map of the codebase

```
docs/                       Research + this handoff
  AI_EXTRACTION_RESEARCH.md   Model costs, benchmarks, cascade design rationale
  WHATSAPP_INGESTION_RISK.md  Ban risk, number strategy, legal/ethical posture
  handoff/                    You are here

server/src/
  types.ts            CORE CONTRACTS. MessageSource, IncomingMessage, ExtractedEvent.
                      Touch when changing the shape of a message or event.
  config.ts           Env parsing with defaults. Add new env vars here.
  index.ts            Ingestion entrypoint. Wires source -> dedup -> buffer -> extractor
                      -> store -> notifier. Also handles `--replay`.
  apiServer.ts        Planner API entrypoint (separate process from ingestion).

  sources/            Everything that produces messages. All implement MessageSource.
    baileys.ts          THE ONLY FILE THAT KNOWS WHATSAPP EXISTS. QR pairing, reconnect
                        with backoff, message unwrapping. Touch for connection issues.
    chatExport.ts       Parses "Export Chat" .txt files. Date-order detection lives here.
    fake.ts             In-memory source for tests.

  pipeline/
    buffer.ts           Micro-batching per group (time OR size trigger) + a stage-0 filter
                        dropping messages under 3 chars.
    prompt.ts           THE SYSTEM PROMPT + Sheng glossary + few-shot examples.
                        *** This is the highest-leverage file for AI accuracy. ***
    llm.ts              LlmClient interface + GeminiClient. Add other providers here.
    extractor.ts        The cascade: primary model -> zod validation -> escalate on low
                        confidence or invalid JSON. Handles code-fenced JSON.

  store/db.ts         ALL SQL. Schema (CREATE TABLE IF NOT EXISTS), dedup, event
                      reconciliation, groups/students/subscriptions. Touch for any data change.
  api/app.ts          All 12 Express routes + zod body validation. Touch for API changes.
  notify/notifier.ts  Notifier interface + ConsoleNotifier stub. Real push goes here.

  eval/               AI accuracy tooling (dev-only, never ships)
    anonymize.ts        Strips phones/reg numbers/emails; stable sender pseudonyms.
    buildCorpus.ts      Exports -> anonymized corpus + stratified labeling sample.
    labeler.html        Keyboard-driven labeling UI. Standalone; no build step.

server/test/          Vitest. Runs fully offline — no API key, no WhatsApp, no network.

app/
  App.tsx             Font loading, navigation container, dark theme, tab navigator.
  src/theme/tokens.ts DESIGN TOKENS. All colours/spacing/type. Never hardcode a colour.
  src/api/client.ts   Planner API client + demo-data fallback (`isMock`).
  src/data/           types.ts (client shapes), mock.ts (demo data)
  src/lib/datetime.ts Bucketing (Today/Tomorrow/This week), countdowns, greeting.
  src/components/     EventCard, NextUpCard, CategoryBadge/Icon, SectionHeader,
                      EmptyState, TabBar (custom floating tab bar).
  src/screens/        PlannerScreen (home), GroupsScreen, ProfileScreen.

TXT Files/            RAW WhatsApp exports. GITIGNORED. Real students' messages — PII.
server/eval-data/     Derived corpus. GITIGNORED.
```

## 9. Known broken / missing / technical debt

**Nothing in the repo is marked `TODO`/`FIXME`/`STUB`** — verified by grep. The gaps are
structural absences, not annotated ones. That makes this list important:

1. **Baileys has never connected to real WhatsApp.** Code is written and typechecks; the QR
   pairing, reconnect, and message-unwrapping paths are **[UNVERIFIED] against a live socket**.
2. **AI accuracy is entirely unmeasured.** No eval harness exists yet. The prompt was written
   from intuition and *later* found to mismatch real data (see Landmines).
3. **No authentication anywhere.** Student IDs are unguessable UUIDs, and that is the only
   thing protecting the API. Anyone with a student ID reads that planner.
4. **The app is hardcoded to `demo-student`** — `PlannerScreen.tsx:22`, `ProfileScreen.tsx:40`.
   There is no onboarding, login, or student creation flow in the app.
5. **Three empty catch blocks swallow all API errors** in the app: `GroupsScreen.tsx:18`,
   `PlannerScreen.tsx:28`, `ProfileScreen.tsx:42`. A failed fetch renders an empty screen with
   no error message and no retry.
6. **No push notifications.** `ConsoleNotifier` only `console.log`s. The Profile screen has a
   notifications toggle that is pure local state and controls nothing.
7. **No deployment of any kind.** No Dockerfile, no CI, no host, no staging.
8. **App has no tests and no `typecheck`/`lint` npm scripts.** (`npx tsc --noEmit` does pass.)
9. **No rate limiting, CORS config, security headers, or request logging** on the API.
10. **`GroupsScreen` shows `eventCount` only for demo data** — `fetchGroups()` doesn't populate
    it from the API, so against a live server every group reads "Listening".
11. **`SOURCE` env var is dead** — declared but never read (see env table).
12. **No `.env.example` for the app**, and `EXPO_PUBLIC_API_URL` is undocumented outside these docs.

## 10. Landmines — read before you touch anything

1. **WhatsApp date formats differ per phone locale.** Exports may be `26/05/2025` (day-first)
   *or* `3/31/26` (month-first). `chatExport.ts` auto-detects per file by scanning for a
   component > 12. **This cost 65% of the corpus when it was wrong** (5,696 → 9,402 messages
   after the fix) because an impossible "month 23" silently dropped messages. Never assume an
   order; never remove `detectDateOrder`. Regression tests exist in `test/chatExport.test.ts`.

2. **`npm run replay` on a big export burns a LOT of LLM calls.** Replay emits every message
   synchronously; with `MAX_BATCH_SIZE=25` a 5,300-message file is ~210 API calls with **no cost
   guard and no confirmation prompt**. Test on the smallest file first
   (`Graded & Reinforced.txt`, ~600 messages).

3. **`buildCorpus.ts` overwrites `eval-data/tolabel.jsonl`.** Re-running it with a different
   sample size replaces the labeling set. Human labels live in browser `localStorage` keyed by
   message ID (which is a deterministic hash, so they survive a same-size rebuild) — but
   **download `labeled.jsonl` before re-running it.**

4. **The app is pinned to Expo SDK 56 deliberately.** SDK 57 is newer, but the Play Store's
   Expo Go rejected both 57 and 56 on the owner's device ("requires a newer version of Expo
   Go"). **Do not bump the Expo SDK to "fix" anything.** The working preview path is
   `npx expo start --web`. Native testing needs a real dev build (EAS), not Expo Go.

5. **`babel.config.js` requires `react-native-worklets/plugin`, but `react-native-worklets`
   is NOT a declared dependency** — it resolves only as a transitive dep of Reanimated. If that
   tree shifts, the app build breaks with a confusing Babel error. (Roadmap: TASK-011.)

6. **`@google/genai` is ESM-only.** `require('@google/genai')` throws; `import` works. Don't
   "fix" a require error by swapping packages.

7. **The `ExperimentalWarning: SQLite` line is normal.** It is not a bug to chase.

8. **Ingestion and API are two separate processes sharing one SQLite file.** WAL mode makes
   this safe. Don't merge them into one process assuming that's simpler — separation is
   deliberate so an ingestion crash doesn't take the API down.

9. **Windows: SQLite files stay locked while a Node process holds them.** `rm` fails with
   "Device or resource busy" until you kill the process.

10. **The real corpus contradicts the current prompt.** Observed in real messages, not handled
    by `prompt.ts` today:
    - *One message, many events:* "Cats...... Survey cat on monday from 4pm / PhE on Tuesday
      from 10am / Hydraulics 1 on Tuesday from 1pm" — three CATs in one message.
    - *One event split across messages:* "Let's have class tomorrow at 8am" then, separately,
      "Soil mechanics". The course is in the **next** message.
    - *Questions that look like announcements:* "Sasa mcomfirm kama kesho kuna exams" is a
      student **asking**, not announcing. Prime false-positive source.
    - *Terse abbreviations:* "Tos from 11 venue will be ctc Lh", `PhE`, `PDE cat 3`, `TOSIII`.
    - *Sheng cancellations:* "Hakuna lesson kesho from 5-7".

11. **`saveEvent` reconciliation matches on `group_id + type + course` only.** Two different
    CATs for the same course in one group will supersede each other incorrectly. Real data has
    "PDE cat 3", implying numbered sequences. (Roadmap: TASK-024.)

12. **Never commit `TXT Files/` or `server/eval-data/`.** They contain other students' real
    messages. Both are gitignored — keep it that way.

## 11. Glossary

| Term | Meaning |
|---|---|
| **CAT** | Continuous Assessment Test. A graded in-semester test. The single most important event type. |
| **Class rep** | Student elected to relay official info. Posts most real academic messages. |
| **Sheng** | Kenyan urban slang mixing Swahili and English. Evolves fast; no LLM benchmark covers it. |
| **imehamia / imesogezwa** | "has been moved/rescheduled" → `action: update` |
| **imecancel / imekufa / hakuna** | "cancelled / not happening" → `action: cancel` |
| **kesho / leo / kesho kutwa** | tomorrow / today / day after tomorrow |
| **mlete / beba / kuja na** | "bring" |
| **wadau / wasee / comrades** | "guys" — greeting, carries no info |
| **saa (Swahili time)** | Offset 6h from Western clock. *saa nane mchana* = 14:00, *saa mbili asubuhi* = 08:00. |
| **LT / LH** | Lecture Theatre / Lecture Hall (venue) |
| **suppl / mains** | supplementary exam / main exams |
| **JID** | WhatsApp's internal ID. Group JIDs end `@g.us`. Used as `groupId`. |
| **Micro-batching** | Buffering a group's messages so one LLM call sees ~25 messages with context. |
| **Cascade / escalation** | Cheap model first; re-run on a stronger model when confidence < threshold. |
| **Gold set** | Human-labeled messages that define "correct". The project's most valuable asset. |
