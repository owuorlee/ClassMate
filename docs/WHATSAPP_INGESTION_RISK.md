# ClassMate — WhatsApp Ingestion (Baileys): Risk Analysis & Mitigation

*Last updated: 2026-07-02. Companion to [AI_EXTRACTION_RESEARCH.md](AI_EXTRACTION_RESEARCH.md).*

## 1. The four distinct risks

Running Baileys against a regular WhatsApp account violates WhatsApp's Terms of Service. That headline hides four separate risks with different severities:

| Risk | What happens | Severity for ClassMate |
|---|---|---|
| **Number bans** | The bot's WhatsApp number is banned; ingestion for its groups stops | Medium — recoverable if architected for it |
| **Protocol breakage** | Meta changes the protocol; Baileys breaks until maintainers catch up (happens periodically — it's reverse-engineered) | Medium — outages of hours to days |
| **Supply chain** | Malicious packages in the Baileys ecosystem. Real incident: April 2026, the "anti-ban" package `lotusbail` (56K downloads) was exfiltrating session credentials and messages | High if careless — fully avoidable |
| **Legal / platform action** | Meta has pursued legal action against WhatsApp automation companies — historically bulk-senders and spammers, not passive readers | Low at pilot scale; a real diligence flag at company scale |

## 2. Why ClassMate's risk profile is unusually favorable

WhatsApp's 2025–2026 ban detection (per published analyses of enforcement patterns) weights **sending behavior**: reply-ratio below 10%, proactive messages to non-contacts, robotic send timing, unanswered-message counts. Field data across 50+ deployments: bots that only respond to incoming messages see **<2% ban rate over 12 months**; bots that proactively message strangers see 15–30%.

**ClassMate's bot never sends anything.** It is a pure listener — no outbound messages, no bulk sends, no stranger contact. It sits below even the lowest-risk measured category. Notifications to students go through the ClassMate app (push notifications), never through WhatsApp.

This doesn't make the risk zero — bans can be arbitrary, and enforcement can change — but it means the design should keep it that way: **the ingestion number must never be reused for sending. Ever.** No "reply in group" feature, no "bot answers questions in the group" feature. Those features would move ClassMate into the high-ban-rate category and should live in the app instead.

## 3. The official Cloud API is NOT an escape hatch (verified July 2026)

Meta's Cloud API now has a Groups API, but it is built for business-created groups:
- **Maximum 8 participants per group** — a 250-member class group is impossible.
- Groups must be created and owned by the business number; the API cannot join an existing student-created group as a member.
- Per-message billing, template restrictions.

So for "listen to an existing large student group," the unofficial route is structurally the only invisible option. This is a fact to accept and mitigate, not a temporary workaround. (The On-Premises API was deprecated October 2025; Cloud API is the only official architecture.)

## 4. Mitigation architecture

### Number strategy — treat numbers as expendable infrastructure
- **Never a student's personal number.** A ban would destroy their personal WhatsApp — chats, groups, identity. Dedicated cheap prepaid SIMs (Safaricom prepaid is a few hundred shillings) registered for ClassMate only.
- **Warm up numbers** before deployment: register, set a profile, some organic activity, age it days–weeks. Fresh numbers that instantly join many groups pattern-match to spam ops.
- **Shard the blast radius:** ~10–20 groups per number. One ban costs those groups only, and recovery = new SIM + class rep re-adds the new number. Make re-onboarding a one-tap flow for the rep.
- Multi-device sessions require the registering phone to come online periodically — plan for a "SIM rack" (physical or hosted) as part of operations, not an afterthought.

### Software hygiene
- Pin Baileys (`@whiskeysockets/baileys`) to reviewed versions; upgrade deliberately after protocol breaks, reading the diff/community reports.
- **No third-party "anti-ban" middleware, ever** (see lotusbail). Session credentials are the crown jewels — encrypt at rest, never in repos or logs.
- Passive posture in code: read receipts off, no presence broadcasting, no auto-"online" status, throttled history sync.

### Reliability engineering
- Heartbeat + gap detection per group: if a group has zero messages for an unusually long window, alert — silence may mean a dead session, not a quiet group.
- Auto-reconnect with backoff; alert a human when a session needs re-linking (QR scan).
- On extended outage, degrade visibly in the app: "Updates for MAT 2101 paused since Tue — ask your class rep" beats silent staleness, which destroys the product's core trust promise.

## 5. Legal & ethical layer (separate from ToS)

- **Kenya Data Protection Act (2019):** ClassMate processes personal data (names, numbers, message content) of every group member. Needed regardless of ingestion method: class-rep/admin consent to add the bot, a notice to the group that messages are processed for academic-planner extraction, a privacy policy, data minimization (discard non-academic messages immediately after classification — don't warehouse the group's social chatter), and likely ODPC data-processor registration once this is a real service.
- **Transparency is cheap insurance:** name the bot account "ClassMate 📚" with a clear profile description, rather than a fake student identity. "Invisible" should mean *no behavior change required*, not *covert*. A covert reader of 300 students' messages is an ethics scandal waiting to happen; a disclosed one is a utility.

## 6. Product hedges (design these in from day one)

1. **Pluggable ingestion interface** — one `MessageSource` abstraction with Baileys as the first implementation. Rep-forward mode (rep forwards key messages to the bot in a 1:1 chat — 1:1 receiving is far safer and near-zero ban risk) becomes both the fallback during bans and the compliance story if enforcement tightens.
2. **WhatsApp Export bootstrap** — "Export Chat" from WhatsApp produces a text file any student can upload; good for backfilling history at onboarding and as a manual fallback.
3. **Long-term pivot path** — if ClassMate wins adoption, reps will post *into ClassMate* and WhatsApp becomes the mirror rather than the source. The Baileys dependency is a bridge for the cold-start period, not the permanent foundation. Frame it that way to any accelerator/judge who raises the ToS question — they will.

## 7. Bottom line

Proceed with Baileys for the MVP/pilot: a passive listener is the lowest-risk category of unofficial client, and the official API structurally cannot do this job. But (a) numbers are expendable and sharded, never personal; (b) the bot never sends; (c) the ecosystem is treated as hostile (pinned deps, no anti-ban packages); (d) consent and disclosure are built into group onboarding; (e) ingestion sits behind an interface with rep-forward as the ready fallback. At company scale, revisit — that's a business-risk decision, not an engineering one.

### Sources
- [WhatsApp automation ban-risk analysis (Kraya)](https://blog.kraya-ai.com/whatsapp-automation-ban-risk)
- [WhatsApp spam detection 2026 — 50+ case fixes (Achiya)](https://achiya-automation.com/en/blog/whatsapp-spam-detection-2026/)
- [Baileys high-ban-rate issue thread](https://github.com/WhiskeySockets/Baileys/issues/1869)
- [OpenClaw WhatsApp risks — engineer's guide](https://zenvanriel.com/ai-engineer-blog/openclaw-whatsapp-risks-engineers-guide/)
- [Meta Groups API docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups) · [Groups messaging](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/groups-messaging/)
- [WhatsApp Groups API 2026 guide (Wuseller)](https://www.wuseller.com/whatsapp-business-knowledge-hub/whatsapp-groups-api-create-manage-groups-2026-guide/)
