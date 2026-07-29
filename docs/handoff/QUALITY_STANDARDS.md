# ClassMate — Quality Standards

> **These are instructions to you, the agent working on this project.** They are derived from how
> this codebase is actually written, not from generic best practice. Follow them.

---

## 1. Read before you write

Locate the existing pattern and imitate it. Concretely, before you write:

| If you are adding… | Read this first and copy its shape |
|---|---|
| A message source | `server/src/sources/fake.ts` (simplest `MessageSource` impl) |
| An API route | `server/src/api/app.ts` — note `param()`, `validate()`, and the `return void res.status(404)` idiom |
| A SQL query | `server/src/store/db.ts` — **all SQL lives here**, always via `prepare(...).run/get/all` |
| A test | `server/test/store.test.ts` (unit) or `server/test/api.test.ts` (HTTP via supertest) |
| An app component | `app/src/components/EventCard.tsx` — tokens + `StyleSheet.create` at the bottom |
| An app screen | `app/src/screens/GroupsScreen.tsx` — the `alive` flag effect pattern |
| An LLM call | `server/src/pipeline/extractor.ts` `tryModel()` — parse, then **zod-validate**, never trust |

**Never `import` Baileys outside `server/src/sources/baileys.ts`.** That isolation is the whole
point of the `MessageSource` interface.

## 2. Consistency beats your preference

Do not restyle, reformat, or "modernise" working code. Observed conventions — match them:

- **TypeScript, `strict: true`, ESM.** Server imports use `.js` extensions (`from '../types.js'`)
  because it's NodeNext. **The app does NOT** (Metro resolves extensionless). Match the folder.
- 2-space indent, single quotes, semicolons, trailing commas in multiline literals.
- `camelCase` in TS. `snake_case` for SQL columns (and therefore in raw API responses).
- Named exports. No default exports except React components/`App.tsx`.
- Interfaces for object shapes; `type` for unions.
- Comments explain **why**, not what. The codebase uses short `/** ... */` blocks on exported
  symbols and inline `//` for non-obvious decisions. Keep that density — don't over-comment.
- Prefer small, single-purpose files. One component per file.

## 3. No silent scope creep

Implement the task in the roadmap, nothing more. If you spot an unrelated problem:
1. Do **not** fix it in the same change.
2. Note it in `PROGRESS_LOG.md` under "Discovered".
3. Propose it as a new TASK to the human.

Refactors that touch files outside the task's "Files to touch" list need explicit approval.

## 4. No stubs, mocks, or dead code on a shipping path

- Never leave `TODO`/commented-out code in code that ships. (This repo currently has **zero** —
  keep it that way.)
- If you genuinely must stub, mark it `// STUB: <what's missing>` **and** add a roadmap task in
  the same session.
- `app/src/data/mock.ts` is the one sanctioned mock; it exists for dev/demo only. TASK-003 gates
  it behind `__DEV__`. **Never let mock data reach a production path** — fake CATs shown to real
  students is the worst failure this product can have.

## 5. Never fabricate

Do not invent an API method, library export, env var, file path, or CLI flag. If you are not
certain it exists:
- Check the code (`grep`), or
- Check `node_modules/<pkg>/package.json` and its types, or
- Say you don't know.

**A confident wrong statement is worse than an admission of uncertainty.** If you cannot verify
something, write `[UNVERIFIED]` next to it in the docs and the log.

Two live examples of why: `@google/genai` is **ESM-only** (`require` throws), and
`react-native-worklets` is required by Babel but **is not a declared dependency**. Both would be
easy to guess wrong about.

## 6. Handle errors explicitly

- **No empty catch blocks.** The three that exist (`app/src/screens/*.tsx`) are a known defect
  being fixed by TASK-004 — do not copy them.
- Every user-facing failure needs a real message and a real UI state. Not a blank screen.
- Server-side: log with context and either recover or propagate. Express 5 auto-forwards async
  rejections to the error handler in `api/app.ts` — rely on that rather than try/catch per route.
- The extractor's fallback ladder (escalate → fall back to primary → throw) is deliberate:
  **a low-confidence CAT beats a silently dropped one.** Preserve that bias.

## 7. Validate all external input at the boundary

Three boundaries, all untrusted:
1. **HTTP requests** → zod via `validate()`. Path params still need TASK-013.
2. **LLM responses** → zod. Never `JSON.parse` and use directly. Models emit fenced JSON and
   hallucinate enum values; `extractor.ts` already handles both.
3. **WhatsApp messages** → treat as hostile text. Never interpolate into SQL (always use bound
   parameters), never execute, never trust length.

## 8. Secrets

- Never commit a secret. `.env`, `baileys-auth/`, `TXT Files/`, and `server/eval-data/` are
  gitignored — **keep them that way**.
- Never hardcode a key, credential, or URL. Add to `server/src/config.ts` with a sane default,
  and document it in the `HANDOFF.md` env table and `.env.example`.
- `baileys-auth/` is a **live WhatsApp session**. Treat it like a password: never log it, never
  copy it into an image, never put it in a backup that leaves the host unencrypted.
- **Never install a third-party "anti-ban" WhatsApp package.** In April 2026 one such package
  (`lotusbail`, 56k downloads) was caught exfiltrating session credentials.
- `TXT Files/` contains real students' messages shared in good faith. Never commit it, never
  send it to a third-party service other than the extraction LLM, and always anonymize
  (`src/eval/anonymize.ts`) before it goes anywhere else.

## 9. Testing

**Framework: Vitest** (`server/`). Run: `npm test`. Currently **45 tests across 6 files, all
passing, fully offline** — no network, no API key, no WhatsApp. Keep it that way; a test suite
that needs the internet is a test suite nobody runs.

Rules:
- **Every P0 task ships with tests that fail before the change and pass after.** Write the failing
  test first where practical.
- Test behaviour, not implementation. Use `FakeSource` and mocked `LlmClient` (see
  `extractor.test.ts` for the mock pattern) rather than hitting real services.
- Cover the failure path, not just the happy path. Existing suites do this well — copy them.
- Use `:memory:` for `Store` tests (see `store.test.ts`).
- When you fix a bug, add a regression test **naming the real-world cause**. Precedent:
  the date-order tests in `chatExport.test.ts` document the exact bug that cost 65% of the corpus.

## 10. Verify before you claim done

Run these and **paste the real output into `PROGRESS_LOG.md`**:

```bash
cd server && npm run typecheck && npm test && npm run build
cd app && npx tsc --noEmit
```

- Never claim a green build you did not observe.
- Never say "should work" — either you ran it, or you label it `[UNVERIFIED]`.
- If you cannot run something (needs a device, a live WhatsApp session, a deploy target), say so
  explicitly and mark it `[UNVERIFIED]`.
- Expect `ExperimentalWarning: SQLite is an experimental feature` — that is **normal**, not a
  failure.

## 11. Commits

One task, one focused commit. Reference the TASK id.

```
TASK-004: add error and retry states to app screens

Replaces three empty catch blocks that rendered a blank screen on any API
failure. Adds ErrorState (mirrors EmptyState) with a working retry.

Verified: app npx tsc --noEmit exit 0; manual check against an unreachable API.
```

- Subject: `TASK-NNN: <imperative, lowercase after the colon>`.
- Body: what changed and **why**, plus what you verified.
- Never commit `node_modules/`, `dist/`, `.env`, `*.db`, `baileys-auth/`, `TXT Files/`, or
  `server/eval-data/`.
- Check `git status` before committing. If something surprising is staged, stop and look.

## 12. Dependencies

- Do **not** add, upgrade, or remove a dependency without a reason recorded in `PROGRESS_LOG.md`.
- Prefer the standard library or what's installed. This codebase deliberately uses `node:sqlite`
  (no native build) and hand-rolled helpers instead of pulling packages.
- **Never bump the Expo SDK.** It is pinned to 56 because Expo Go rejected 57 on the owner's
  device. Bumping it will break their only working preview path.
- Node must stay **≥ 22.13** (`node:sqlite`). Verified on v24.12.0.

## 13. Don't delete what you don't understand

If code looks wrong but you can't explain why it's there, leave it and ask. Things that look
wrong here but are deliberate:
- Two processes sharing one SQLite file (WAL makes it safe; separation is intentional).
- The app not using `.js` import extensions while the server does.
- `markOnlineOnConnect: false` and no read receipts in `baileys.ts` (ban-risk posture).
- The extractor falling back to low-confidence results rather than dropping them.

## 14. Accessibility and responsive behaviour are acceptance criteria

Not polish, not "later". Every touchable needs an `accessibilityLabel` and a ≥44×44pt target.
Layouts must hold at 320px width and at 200% font scale. Colour choices must come from
`app/src/theme/tokens.ts` and meet WCAG AA contrast.

## 15. When blocked or when reality contradicts these docs

The docs describe the code as of 2026-07-28. If you find a discrepancy:
1. **Trust the code, not the docs.**
2. Fix the doc in the same session.
3. Note it in `PROGRESS_LOG.md` under "Discovered".
4. Flag it to the human.

**Do not guess and proceed.** If a task's acceptance criteria are impossible or wrong, stop and
say so. Several tasks (TASK-001, 019, 035, 042, 044) explicitly require the human — you cannot
complete those alone, and pretending otherwise wastes a session.
