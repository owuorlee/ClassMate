# ClassMate — State of Play

> Verified 2026-07-28 by reading every source file and running the test suite, typecheck, build,
> API server, and eval pipeline. **This is the document that prevents you from mistaking a stub
> for a working feature. Read it before planning any work.**

Confidence key: **High** = observed working. **Medium** = code reviewed + tests pass, but never
exercised against the real external system. **Low** = written, never run in any form.

---

## 1. The four things most likely to mislead you

| Looks like | Actually is |
|---|---|
| A working mobile app showing a student's planner | **Bundled demo data.** `app/src/data/mock.ts` is compiled into the app. It never calls the server unless `EXPO_PUBLIC_API_URL` is set. |
| A working WhatsApp bot | **Never connected to WhatsApp.** Not once. Zero real messages have flowed through `BaileysSource`. |
| A tested AI extraction pipeline | The **plumbing** is tested with a mocked LLM. The **prompt's real-world accuracy is completely unmeasured** — no eval harness exists yet. |
| A functioning student account system | `POST /students` inserts a row with a name. **No auth, no login, no password, no ownership checks.** The app doesn't call it at all — it hardcodes `'demo-student'`. |

---

## 2. Feature status

### Ingestion
| Feature | Status | Where | What's missing | Confidence |
|---|---|---|---|---|
| `MessageSource` abstraction | **Done** | `server/src/types.ts` | — | High |
| Baileys listener (QR pair, reconnect, unwrap) | **Partial** | `server/src/sources/baileys.ts` | Never run against live WhatsApp. Backoff/logout paths unexercised. No multi-number supervisor. | **Low** |
| Chat-export replay + date-order detection | **Done** | `server/src/sources/chatExport.ts` | — (9 regression tests) | High |
| `FakeSource` for tests | **Done** | `server/src/sources/fake.ts` | — | High |
| Message dedup | **Done** | `store/db.ts markSeen` | — | High |
| Multi-number / session supervisor | **Not started** | — | Everything. Needed for >20 groups. | — |

### AI extraction
| Feature | Status | Where | What's missing | Confidence |
|---|---|---|---|---|
| Micro-batching buffer | **Done** | `pipeline/buffer.ts` | — (5 tests) | High |
| Cascade + zod validation + escalation | **Done** | `pipeline/extractor.ts` | — (6 tests, mocked LLM) | High (logic) |
| Gemini client | **Partial** | `pipeline/llm.ts` | **Never called against the real API in any verified run.** No retry, no timeout, no rate-limit handling, no token/cost logging. | **Low** |
| System prompt + Sheng few-shots | **Partial** | `pipeline/prompt.ts` | Written before real data was seen. Known to mismatch real patterns (multi-event messages, split events, questions-vs-announcements). | **Low** |
| **Accuracy measurement / eval harness** | **Not started** | — | **Everything.** No harness, no metrics, no gold labels yet. | — |
| Anonymization | **Done** | `eval/anonymize.ts` | — (7 tests; leak-scan showed 0 phones/regnos/emails) | High |
| Corpus builder + sampler | **Done** | `eval/buildCorpus.ts` | — (8,377 msgs; 268 sampled) | High |
| Labeling UI | **Done** | `eval/labeler.html` | — (workflow driven live in-browser) | High |
| **Human gold labels** | **Not started** | `eval-data/tolabel.jsonl` | 268 messages await human labeling. **This blocks all accuracy work.** | — |

### Storage & API
| Feature | Status | Where | What's missing | Confidence |
|---|---|---|---|---|
| SQLite schema | **Done** | `store/db.ts` | No migrations, no FKs, no indexes beyond two. | High |
| Event reconciliation (update/cancel) | **Partial** | `store/db.ts saveEvent` | Matches on `group+type+course` only — distinct CATs for one course collide. | Medium |
| Planner API — 12 routes | **Done** | `api/app.ts` | See gaps below. | High |
| Request body validation (zod) | **Partial** | `api/app.ts validate()` | Bodies validated; **path/query params are not**. | Medium |
| API error handling | **Partial** | `api/app.ts` | 404 + 500 handlers exist. No structured logging, no request IDs. | Medium |
| **Auth / authorization** | **Not started** | — | Everything. Any caller with a UUID has full access. | — |
| Rate limiting | **Not started** | — | Everything. | — |
| CORS / security headers | **Not started** | — | Everything. | — |
| Health check | **Partial** | `GET /health` | Returns `{ok:true}` unconditionally — **does not check the DB or ingestion liveness**. | High (as written) |

### Mobile app
| Feature | Status | Where | What's missing | Confidence |
|---|---|---|---|---|
| Navigation + custom tab bar | **Done** | `App.tsx`, `components/TabBar.tsx` | — | High |
| Design tokens & theming | **Done** | `theme/tokens.ts` | — | High |
| Planner screen (hero, buckets, cards) | **Done (UI)** | `screens/PlannerScreen.tsx` | Bound to demo data; no refresh; no error state. | High (UI) |
| Groups screen | **Done (UI)** | `screens/GroupsScreen.tsx` | `eventCount` never populated from API → always shows "Listening". | High (UI) |
| Profile screen | **Partial** | `screens/ProfileScreen.tsx` | Notification toggle is **local state controlling nothing**. Privacy/How-it-works rows are non-functional. | High (UI) |
| API client | **Partial** | `api/client.ts` | Falls back to mock when `EXPO_PUBLIC_API_URL` unset. No retry/timeout. Live path **[UNVERIFIED] end-to-end**. | Medium |
| **Student onboarding / login** | **Not started** | — | Everything. `'demo-student'` is hardcoded. | — |
| **Error / retry UI** | **Not started** | — | 3 empty `.catch(() => {})` blocks render a blank screen on failure. | — |
| Loading state | **Partial** | `PlannerScreen` | `loading` gates the empty state only; no spinner/skeleton. | High |
| Pull-to-refresh | **Not started** | — | Data loads once on mount. | — |
| Push notifications | **Not started** | — | Everything. | — |
| App tests | **Not started** | — | No test runner configured. | — |

### Ops
| Feature | Status | Confidence |
|---|---|---|
| Deployment (any host) | **Not started** | — |
| Dockerfile / compose | **Not started** | — |
| CI pipeline | **Not started** | — |
| Monitoring / alerting / log aggregation | **Not started** | — |
| DB backups | **Not started** | — |
| Secrets management | **Partial** — `.env` + gitignore only | Medium |
| Staging environment | **Not started** | — |

---

## 3. Hardcoded / faked / placeholder — would break in production

| # | Thing | Location | Impact |
|---|---|---|---|
| 1 | `'demo-student'` student ID | `PlannerScreen.tsx:22`, `ProfileScreen.tsx:40` | Every user sees the same fictional student. **P0 blocker.** |
| 2 | Bundled demo events/groups | `app/src/data/mock.ts` | Fake CATs ("Calculus II CAT", "Beba calculator na ID") ship inside the binary. Users could act on fake academic info. **P0 blocker.** |
| 3 | Mock fallback when API URL unset | `app/src/api/client.ts` (`USE_MOCK`) | A production build with a misconfigured env **silently shows fake data instead of erroring**. Dangerous. |
| 4 | `ConsoleNotifier` | `notify/notifier.ts` | "Notifications" are `console.log`. Nothing reaches a student. |
| 5 | Notification toggle | `ProfileScreen.tsx` (`useState`) | Pure UI theatre — controls nothing, doesn't persist. |
| 6 | `GET /health` returns `{ok:true}` unconditionally | `api/app.ts:23` | Reports healthy even if the DB is corrupt or ingestion is dead. |
| 7 | `eventCount` on groups | `GroupsScreen.tsx:47` | Only present in mock data; live API never sets it. |
| 8 | `SOURCE` env var | `config.ts:18` | Declared, never read. Setting it does nothing. Misleading. |
| 9 | No FKs / no cascade deletes | `store/db.ts` | Orphaned subscriptions accumulate silently. |
| 10 | `replay` has no cost guard | `index.ts` | One command on the largest export ≈ 210 LLM calls, unprompted. |

---

## 4. Test coverage — what IS and is NOT tested

**Verified 2026-07-28: `npm test` → 6 files, 45 tests, all passing. Runs fully offline.**

| Suite | Tests | Covers |
|---|---|---|
| `chatExport.test.ts` | 9 | Android/iOS formats, multi-line, am/pm, **date-order detection** |
| `store.test.ts` | 7 | dedup, supersede, case-insensitive course, cancel, group isolation, subscriptions/planner |
| `api.test.ts` | 11 | all main routes, 404s, 400 validation, subscription lifecycle |
| `extractor.test.ts` | 6 | cascade, escalation triggers, code-fenced JSON, both-fail path |
| `buffer.test.ts` | 5 | size/time flush, group isolation, stage-0 filter, flushAll |
| `anonymize.test.ts` | 7 | phone/regno/email scrubbing, stable pseudonyms, rep detection |

**NOT tested at all:**
- `sources/baileys.ts` — **zero tests**, zero live runs. The riskiest file in the repo.
- `pipeline/llm.ts` — no test hits the real Gemini API.
- `pipeline/prompt.ts` — no accuracy measurement of any kind.
- `index.ts` / `apiServer.ts` — no wiring/integration test.
- `notify/notifier.ts` — untested.
- `eval/buildCorpus.ts` — sampling logic untested.
- **The entire mobile app** — no test runner installed.
- Concurrency: two processes writing/reading SQLite simultaneously is untested.
- Failure modes: DB locked, disk full, malformed export, network loss mid-batch.

---

## 5. Verified commands (run 2026-07-28)

| Command | Result |
|---|---|
| `cd server && npm run typecheck` | exit 0, no output |
| `cd server && npm test` | **6 files, 45 tests passed** |
| `cd server && npm run build` | exit 0, emits `dist/` |
| `cd server && npm run api` | `[api] listening on http://localhost:4000` |
| `curl /health` | `{"ok":true}` HTTP 200 |
| `curl /groups` | `[]` HTTP 200 |
| `curl -X POST /students -d '{"name":"…"}'` | HTTP 201 + `{id,name}` |
| `npx tsx src/index.ts --replay` (no key) | Clean error: `GEMINI_API_KEY is not set…` |
| `npx tsx src/eval/buildCorpus.ts "../TXT Files" 260` | 8,377 msgs, 2,612 candidates (31.2%), 268 sampled |
| PII leak scan on `corpus.jsonl` | **0 phones, 0 reg numbers, 0 emails** |
| `cd app && npx tsc --noEmit` | exit 0 |
| `cd app && npx expo export --platform web` | exit 0 |

**Never verified:** live Baileys connection, a real Gemini API call, app↔API end-to-end over
HTTP, Expo Go on a physical device (known broken), any deployment.
