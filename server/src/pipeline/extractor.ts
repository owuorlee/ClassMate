import { z } from 'zod';
import type { ExtractedEvent, ExtractionResult, IncomingMessage } from '../types.js';
import type { LlmClient } from './llm.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';

const eventSchema = z.object({
  type: z.enum(['cat', 'exam', 'assignment', 'class_update', 'material', 'announcement']),
  action: z.enum(['create', 'update', 'cancel']),
  course: z.string().nullable(),
  title: z.string().min(1),
  datetime: z.string().nullable(),
  venue: z.string().nullable(),
  notes: z.string().nullable(),
  source_message_ids: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

const responseSchema = z.object({
  events: z.array(eventSchema),
});

export interface ExtractorOptions {
  primary: LlmClient;
  escalation?: LlmClient;
  confidenceThreshold: number;
}

export class Extractor {
  constructor(private readonly opts: ExtractorOptions) {}

  /**
   * Cascade: run the cheap model; if it fails to produce valid JSON or any
   * event lands below the confidence threshold, re-run the same batch on the
   * stronger model and take its answer.
   */
  async extract(messages: IncomingMessage[], now: Date = new Date()): Promise<ExtractionResult> {
    const userPrompt = buildUserPrompt(messages, now);

    const primaryEvents = await this.tryModel(this.opts.primary, userPrompt);
    const needsEscalation =
      primaryEvents === null ||
      primaryEvents.some((e) => e.confidence < this.opts.confidenceThreshold);

    if (!needsEscalation || !this.opts.escalation) {
      if (primaryEvents === null) {
        throw new Error(`Extraction failed on ${this.opts.primary.model} and no escalation model configured`);
      }
      return { events: primaryEvents, model: this.opts.primary.model, escalated: false };
    }

    const escalatedEvents = await this.tryModel(this.opts.escalation, userPrompt);
    if (escalatedEvents !== null) {
      return { events: escalatedEvents, model: this.opts.escalation.model, escalated: true };
    }
    // Escalation also failed: fall back to whatever the primary produced
    // (low-confidence events are still better than silently dropping a CAT).
    if (primaryEvents !== null) {
      return { events: primaryEvents, model: this.opts.primary.model, escalated: true };
    }
    throw new Error('Extraction failed on both primary and escalation models');
  }

  private async tryModel(client: LlmClient, userPrompt: string): Promise<ExtractedEvent[] | null> {
    let raw: string;
    try {
      raw = await client.complete(SYSTEM_PROMPT, userPrompt);
    } catch (err) {
      console.error(`[extractor] ${client.model} call failed:`, err);
      return null;
    }
    const parsed = safeParseJson(raw);
    if (parsed === null) {
      console.error(`[extractor] ${client.model} returned non-JSON output`);
      return null;
    }
    const result = responseSchema.safeParse(parsed);
    if (!result.success) {
      console.error(`[extractor] ${client.model} JSON failed schema validation:`, result.error.message);
      return null;
    }
    return result.data.events.map((e) => ({
      type: e.type,
      action: e.action,
      course: e.course,
      title: e.title,
      datetime: e.datetime,
      venue: e.venue,
      notes: e.notes,
      sourceMessageIds: e.source_message_ids,
      confidence: e.confidence,
    }));
  }
}

function safeParseJson(raw: string): unknown | null {
  // Models occasionally wrap JSON in code fences despite instructions.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
