# ClassMate — Progress Log

> **This file replaces long-lived chat memory. It is the continuity mechanism for this project.**
>
> Every agent session starts by reading the most recent entries here and ends by appending one.
> If you skip this, the next session starts blind and repeats work that was already done or
> already proven not to work. **Append after EVERY task — no exceptions.**
>
> Newest entries at the top. Never edit or delete a past entry; if it turns out to be wrong, add
> a new entry correcting it.

---

## Template — copy this for each entry

```markdown
## YYYY-MM-DD — TASK-NNN: <title>
**Status:** Complete | Partial | Blocked | Abandoned
**Agent:** <model/tool name>

**What changed:**
- <bullet per meaningful change>

**Files touched:**
- `path/to/file.ts` — <what and why>

**Verification (real output, pasted — not summarised):**
```
$ cd server && npm test
 Test Files  6 passed (6)
      Tests  45 passed (45)
```

**Discovered:** <anything surprising: bugs found, wrong doc statements, dead ends.
Include things that did NOT work — that saves the next session from retrying them.>

**Docs updated:** <which handoff docs you corrected, or "none needed">

**Next:** <the next unblocked TASK id, and anything the human must do first>
```

---

# Entries

## 2026-07-28 — Handoff package created (no feature work)
**Status:** Complete
**Agent:** Claude (Claude Code) — final session before handover to Google Antigravity

**What changed:**
- Created `docs/handoff/` with 7 documents: `HANDOFF.md`, `ARCHITECTURE.md`,
  `STATE_OF_PLAY.md`, `ROADMAP_TO_PRODUCTION.md`, `QUALITY_STANDARDS.md`,
  `PROGRESS_LOG.md` (this file), `AGENT_ONBOARDING.md`.
- Removed a stray zero-byte artifact `server/api-smoke-err.log` left by an earlier smoke test.
- No source code was changed in this session.

**Files touched:**
- `docs/handoff/*.md` — created
- `server/api-smoke-err.log` — deleted (empty leftover)

**Verification (real output):**
```
$ cd server && npm run typecheck
> tsc --noEmit
exit=0

$ cd server && npm test
 Test Files  6 passed (6)
      Tests  45 passed (45)

$ cd server && npm run build
exit=0   (emits dist/)

$ cd server && npm run api    # then, in another shell:
[api] listening on http://localhost:4100 (db: ./_verify.db)
$ curl http://localhost:4100/health
{"ok":true}                                  HTTP 200
$ curl http://localhost:4100/groups
[]                                           HTTP 200
$ curl -X POST http://localhost:4100/students -d '{"name":"Handoff Test"}'
{"id":"7031bca3-...","name":"Handoff Test"}  HTTP 201

$ npx tsx src/eval/buildCorpus.ts "../TXT Files" 260
Corpus:  8377 messages  (2612 keyword candidates, 31.2%)
Sample:  268 messages queued for labeling

$ cd app && npx tsc --noEmit
exit=0
$ cd app && npx expo export --platform web
exit=0
```

**Discovered:**
- `SOURCE` env var is declared in `config.ts` and `.env.example` but **never read** anywhere.
  `index.ts` branches on the `--replay` CLI flag instead. Setting `SOURCE` does nothing.
  Documented as `[UNVERIFIED]`/dead in `HANDOFF.md`; not fixed (out of scope for a handoff).
- `buildCorpus.ts` **overwrites** `eval-data/tolabel.jsonl`. Running it with a smaller sample
  size during verification destroyed the 268-row sample; regenerated at 260. Labels live in
  browser localStorage keyed by a deterministic message-id hash, so they survive a same-size
  rebuild — but **download `labeled.jsonl` before re-running it.** Recorded as a landmine.
- `react-native-worklets` is required by `app/babel.config.js` but is **not a declared
  dependency** — it only resolves transitively via Reanimated. Became TASK-011.
- `npm run build` emits `dist/` but does **not** copy `src/eval/labeler.html`. Harmless today
  (eval tooling is dev-only, run via `tsx`), but would matter if eval ever ships.
- Grep for `TODO|FIXME|HACK|XXX|STUB` across `server/src`, `server/test`, `app/src`, `app/App.tsx`
  returned **zero hits**. The gaps in this project are structural absences, not annotated ones —
  which is exactly why `STATE_OF_PLAY.md` exists. Do not read "no TODOs" as "nothing missing".
- On Windows, SQLite files stay locked while a Node process holds them; `rm` fails with
  "Device or resource busy" until the process is killed.

**Docs updated:** all 7 handoff docs created this session.

**Next:** **TASK-001 (human-labels the 268-message gold set)** — it blocks all of M1 and cannot be
done by an agent. In parallel, an agent can start **TASK-011** (declare `react-native-worklets`),
**TASK-022** (replay cost guard), or **TASK-031** (migration system), none of which depend on
TASK-001.

---

## Earlier work (reconstructed from git history, 2026-07-24 → 2026-07-28)

Not written contemporaneously — summarised here so the record starts complete.

| Commit | What |
|---|---|
| `298a7ca` | Backend: Baileys ingestion behind `MessageSource`, micro-batching buffer, Gemini extraction cascade with confidence escalation, SQLite store with dedup + event reconciliation, Express Planner API. |
| `742de15` | Mobile app: React Native + Expo student planner, dark "midnight campus" design system, three screens, custom floating tab bar. |
| `0fdffcf` | Pinned app to Expo SDK 56 — Play Store Expo Go rejected SDK 57 on the owner's device. |
| `c4f3e25` | Added web target (`react-dom`, `react-native-web`, `@expo/metro-runtime`) so the app can be previewed in a browser; all three screens verified rendering. |
| `1d278dc` | Eval corpus pipeline + **two real parser bugs found by real data**: (1) date order was assumed D/M/Y but US-locale phones export M/D/YY, which corrupted dates and silently dropped every message with a day > 12 — fixing it recovered **3,706 messages (5,696 → 9,402, +65%)**; (2) system lines ("X removed Y") were being appended to the previous message's text. Added `anonymize.ts`, `buildCorpus.ts`, `labeler.html`. |

**Key lesson from that period, worth carrying forward:** the two most valuable bugs were found by
running real data through the pipeline, not by reading code or writing unit tests. Get real data
flowing through any new component as early as you can.
