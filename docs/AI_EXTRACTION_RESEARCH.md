# ClassMate — AI Extraction Layer: Research & Design

*Last updated: 2026-07-02. Pricing verified against provider docs on this date.*

## 1. The task

Turn raw WhatsApp group messages (Sheng / Kiswahili / English, code-switched) into structured planner events:

```
Input:  "Wadau CAT ya Calculus imehamia Friday 3PM, venue ni LT5 sio LT2. Mlete calculators"
Output: {
  "is_academic": true,
  "type": "assessment",
  "action": "update",          // create | update | cancel
  "course": "Calculus",
  "event": "CAT",
  "datetime": "2026-07-04T15:00:00+03:00",
  "venue": "LT5",
  "notes": "Bring calculators. Venue changed from LT2.",
  "confidence": 0.95
}
```

Two sub-problems:
1. **Classification** — is this message academic info at all? (~90–95% of group traffic is noise)
2. **Extraction** — pull structured fields from the messages that matter, resolving relative dates ("Friday", "kesho") against the message timestamp.

## 2. Can LLMs handle Sheng/Kiswahili? (research findings)

- Swahili is the **best-supported African language** in current LLMs — benchmarks (AfroBench, IrokoBench) show performance correlates with available web text, and Swahili has by far the most.
- There is still a measurable gap vs English (best frontier models lose ~12–20 points on African-language tasks vs English), and **proprietary models (GPT, Gemini, Claude) beat open-source models by 12+ points** on African languages.
- **Sheng specifically is the risk zone**: it's slang, campus-specific, and evolves. No benchmark covers it. Mitigation: few-shot examples of *real messages from your own groups* in the prompt, and a confidence score in the output so low-confidence extractions can be escalated or flagged.
- Fine-tuning a small local model is NOT the right first move: no labeled dataset exists, and frontier-API few-shot prompting will beat a fine-tuned small model on this task at your volumes for far less effort. Revisit only at large scale.

**Key architectural insight:** extraction of short structured facts is much easier than open-ended generation. Even "cheap-tier" frontier models handle Swahili classification/extraction well — this is exactly the workload they're priced for.

## 3. Model options & current pricing (per 1M tokens, July 2026)

| Model | Input | Output | Notes |
|---|---|---|---|
| **Gemini 2.5 Flash-Lite** | $0.10 | $0.40 | Cheapest; generous free tier on Gemini API |
| **GPT-5 nano** | $0.05 | $0.40 | Cheapest input; solid at classification |
| DeepSeek V3 | ~$0.14–0.23 | ~$0.28–0.34 | Cheap; weaker on African languages per benchmarks |
| **GPT-5 mini** | $0.25 | $2.00 | Good mid-tier |
| Gemini 2.5 Flash | $0.30 | $2.50 | Good mid-tier |
| **Claude Haiku 4.5** (`claude-haiku-4-5`) | $1.00 | $5.00 | Best instruction-following in budget tier; strict structured outputs |
| Gemini 3.5 Flash | $1.50 | $9.00 | |
| Claude Sonnet 5 (`claude-sonnet-5`) | $3.00 ($2 intro → Aug 31 2026) | $15.00 ($10 intro) | Escalation tier only |

**Discount levers (all major providers):**
- **Batch API: 50% off** (Anthropic, OpenAI, Gemini) — but results can take up to 24h. Fine for nightly digests, NOT for "CAT moved to tomorrow" alerts. Use sparingly.
- **Prompt caching:** Anthropic cache reads cost ~0.1× input price (but minimum cacheable prefix on Haiku 4.5 is **4,096 tokens** — a short system prompt silently won't cache; pad it with more few-shot examples or skip caching). OpenAI auto-caches prefixes ≥1,024 tokens at 50% off. Gemini 2.5 has implicit caching (~75% off cached tokens).
- **Micro-batching messages** (the biggest lever, free): don't call the API per message. Buffer each group's messages and process every 10–15 minutes in one call. This amortizes the system prompt across ~25 messages AND gives the model conversational context (crucial — "imehamia Friday" often refers to something said 3 messages earlier).

## 4. Cost model

Assumptions: one class group ≈ 300 messages/day, avg ~30 tokens/message. Micro-batched into 12 calls/day with a ~2,000-token system prompt (instructions + Sheng few-shot examples) and ~150 output tokens/call.

Monthly volume per group: ~270K uncached input tokens + ~720K cacheable system-prompt tokens + ~54K output tokens.

| Model | Cost / group / month | 100 groups / month | 1,000 groups / month |
|---|---|---|---|
| Gemini 2.5 Flash-Lite | ~$0.06 | ~$6 | ~$60 |
| GPT-5 nano | ~$0.05 | ~$5 | ~$50 |
| GPT-5 mini | ~$0.20 | ~$20 | ~$200 |
| Claude Haiku 4.5 (with caching) | ~$0.60 | ~$60 | ~$600 |
| Claude Sonnet 5 (intro pricing) | ~$1.30 | ~$130 | ~$1,300 |

Per-student framing: a student in 8 unit groups costs **well under $0.01–0.05/month** in AI even on the pricier models. **AI inference is not the cost bottleneck of ClassMate** — hosting, the Baileys relay infrastructure, and push notifications will dominate long before the LLM bill does.

## 5. Recommended architecture (cascade)

```
WhatsApp (Baileys listener)
   │  raw messages, buffered per group
   ▼
[Stage 0 — free filter]  drop stickers, media-only, reactions, very short msgs ("😂", "sawa")
   ▼
[Stage 1 — cheap model]  Gemini 2.5 Flash-Lite or GPT-5 nano
   micro-batch every 10–15 min → classify + extract in ONE call, JSON schema output
   │
   ├─ confidence ≥ 0.8 → write event to planner DB → notify students
   ├─ confidence < 0.8 → [Stage 2 — escalation] re-run only that message-window
   │                     on Claude Sonnet 5 / GPT-5 / Gemini Flash
   └─ not academic → discard
```

- **Single call does classify + extract** — at these prices a two-call pipeline isn't worth the complexity; the cheap model outputs `is_academic: false` for noise at negligible output-token cost.
- **Escalation should hit <5% of batches**, adding pennies while buying frontier-tier accuracy on the hard Sheng cases.
- **Structured outputs / JSON schema** on every call (all three providers support strict schemas) — never parse free text.
- **`action: create|update|cancel`** in the schema, because reps frequently *change* events ("imehamia", "imepostponed") and the planner must reconcile, not duplicate.
- Pass the **message timestamp and current date** to the model so "Friday", "kesho", "wiki ijayo" resolve to absolute dates. Timezone: Africa/Nairobi.

## 6. Before committing: build a 1-day eval

1. Export chat history from 2–3 real class groups (WhatsApp → Export Chat, without media).
2. Hand-label 150–200 messages: academic or not; for academic ones, the correct extracted fields.
3. Run the same prompt through Flash-Lite, GPT-5 nano, and Haiku 4.5. Compare precision/recall on classification and field-accuracy on extraction.
4. Whichever cheap model scores ≥ ~95% classification recall (missed CATs are the fatal failure — false positives are just clutter) wins Stage 1.

This eval set also becomes your regression suite as prompts evolve.

## 7. Bottom line

- **Cost-efficiency winner:** Gemini 2.5 Flash-Lite (also has a free tier — likely $0 during prototyping) or GPT-5 nano. Either runs a whole university's groups for tens of dollars a month.
- **Effectiveness insurance:** confidence-based escalation to Claude Sonnet 5 or GPT-5 for the ambiguous Sheng-heavy messages.
- **Biggest accuracy lever:** few-shot examples of real Sheng messages in the prompt + micro-batching for context — not a bigger model.
- **Biggest risk is not the AI:** it's the Baileys/WhatsApp ToS exposure and relay reliability. The AI layer is cheap and solvable.

### Sources
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Morph Gemini pricing guide](https://www.morphllm.com/gemini-api-pricing)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) · [GPT-5 nano pricing](https://pricepertoken.com/pricing-page/model/openai-gpt-5-nano) · [GPT-5 mini pricing](https://pricepertoken.com/pricing-page/model/openai-gpt-5-mini)
- [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing)
- Anthropic pricing from the official Claude API reference (Haiku 4.5 $1/$5, Sonnet 5 $3/$15 with $2/$10 intro through 2026-08-31, Batch −50%, cache reads ~0.1×)
- [AfroBench](https://arxiv.org/html/2311.07978v4) · [IrokoBench](https://arxiv.org/pdf/2406.03368) · [African LLM benchmarks overview](https://medium.com/@EjiroOnose/llms-on-trial-the-african-llm-evaluation-benchmarks-edition-9658fcf62642)
