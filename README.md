# ClassMate

Turns Kenyan university WhatsApp class-group chatter into a clean personal planner. A silent
bot account listens to class groups (via Baileys), an AI pipeline extracts the academic facts
buried in Sheng/Kiswahili/English messages — CATs, assignment deadlines, venue changes, shared
materials — and students get them as structured planner events. Class reps and students change
nothing about how they already work.

## Design principles (locked)

1. **Least friction.** One-time setup; nobody changes behavior afterwards.
2. **The bot NEVER sends.** Pure listener — this keeps WhatsApp ban risk near zero
   (see [docs/WHATSAPP_INGESTION_RISK.md](docs/WHATSAPP_INGESTION_RISK.md)). All student-facing
   output goes through the app, never WhatsApp.
3. **Baileys is the foundation**, isolated behind one `MessageSource` interface
   ([server/src/types.ts](server/src/types.ts)) so protocol breakage is a one-file fix and the
   whole pipeline is testable without WhatsApp.
4. **Cheap-first AI cascade.** Gemini 2.5 Flash-Lite handles every batch; low-confidence
   extractions escalate to a stronger model (see [docs/AI_EXTRACTION_RESEARCH.md](docs/AI_EXTRACTION_RESEARCH.md)).
5. **Data minimization.** Raw social chatter is never stored — only message IDs (for dedup)
   and extracted academic events.

## Repository layout

```
docs/      research: AI extraction costs & model choice, WhatsApp ingestion risk
server/    ingestion + extraction service, and the planner API (Node 22.13+/24, TypeScript)
  src/
    types.ts             core contracts: IncomingMessage, MessageSource, ExtractedEvent
    sources/             baileys.ts (the ONLY WhatsApp-aware file), chatExport.ts, fake.ts
    pipeline/            buffer.ts (micro-batching), prompt.ts (Sheng few-shots),
                         llm.ts (provider abstraction), extractor.ts (cascade + validation)
    store/               db.ts — SQLite (node:sqlite), dedup + event reconciliation,
                         groups/students/subscriptions
    notify/              notifier.ts — console stub until app push exists
    api/app.ts           Planner API (Express): serves events to clients
    index.ts             ingestion process entrypoint (Baileys or --replay)
    apiServer.ts         planner API process entrypoint
  test/                  runs entirely offline (FakeSource + mocked LLM + supertest)
```

The ingestion service and the Planner API are **two separate processes sharing one SQLite
file** (WAL mode, so concurrent read-while-write is safe): ingestion only writes, the API only
reads/manages subscriptions. Run them independently.

## Running

```bash
cd server
npm install
cp .env.example .env   # fill in GEMINI_API_KEY (free tier: aistudio.google.com)

npm test               # offline test suite
npm run dev            # ingestion: prints QR to link the bot phone, then listens
npm run api            # planner API on http://localhost:4000

# Replay a WhatsApp "Export chat" file through the real pipeline (needs API key):
npm run replay -- path/to/export.txt my-group-id
```

## Planner API

No auth yet (student ids are unguessable UUIDs — fine for a closed pilot, not for wider rollout).

| Method & path | Purpose |
|---|---|
| `GET /groups` | List discovered class groups (auto-created the first time the bot sees a message) |
| `PATCH /groups/:groupId` `{displayName}` | Name a group, e.g. "Calculus 101" |
| `GET /groups/:groupId/events` | Active events for one group |
| `GET /events/:id` | A single event |
| `POST /students` `{name?}` | Create a student, returns `{id, name}` |
| `POST /students/:id/subscriptions` `{groupId}` | Subscribe a student to a group's feed |
| `DELETE /students/:id/subscriptions/:groupId` | Unsubscribe |
| `GET /students/:id/subscriptions` | A student's subscribed groups |
| `GET /students/:id/planner` | **The core payload** — merged, sorted active events across all of a student's subscribed groups |

## Operational rules

- Bot numbers are dedicated prepaid SIMs, never anyone's personal number; ~10–20 groups per
  number; a ban means a new SIM and a one-tap re-add by the class rep.
- Session credentials (`baileys-auth/`) are secrets: never commit, never log.
- Pin Baileys versions; never install third-party "anti-ban" middleware.
- Group onboarding includes class-rep consent and a visible "ClassMate 📚" bot identity —
  invisible means *no behavior change*, not covert.

## Roadmap

- [x] Ingestion + extraction core
- [x] Planner API (serve events; per-student group subscriptions)
- [ ] Extraction eval set from real exported group chats (150–200 labeled messages)
- [ ] Mobile app (planner UI + push notifications)
- [ ] Session supervisor for multiple bot numbers + health dashboard
- [ ] Real auth for the Planner API before wider rollout
