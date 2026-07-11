/**
 * Core contracts. Everything downstream of ingestion depends only on these
 * shapes — never on Baileys (or any other source) directly.
 */

export interface IncomingMessage {
  /** Stable ID from the source, used for deduplication across reconnects/replays. */
  sourceMessageId: string;
  /** ClassMate-internal group identifier (for Baileys this is the group JID). */
  groupId: string;
  senderId: string;
  senderName?: string;
  text: string;
  timestamp: Date;
}

export interface SourceHealth {
  connected: boolean;
  lastMessageAt?: Date;
  detail?: string;
}

export type MessageHandler = (msg: IncomingMessage) => void;

/**
 * The single boundary between "where messages come from" and the rest of the
 * system. Baileys lives entirely inside one implementation of this.
 */
export interface MessageSource {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onMessage(handler: MessageHandler): void;
  health(): SourceHealth;
}

// ---------------------------------------------------------------------------
// Extraction output
// ---------------------------------------------------------------------------

export type EventType =
  | 'cat'          // continuous assessment test
  | 'exam'
  | 'assignment'
  | 'class_update' // venue/time change, cancellation of a class
  | 'material'     // notes, slides, past papers shared
  | 'announcement';

export type EventAction = 'create' | 'update' | 'cancel';

export interface ExtractedEvent {
  type: EventType;
  action: EventAction;
  /** Course/unit name as mentioned, e.g. "Calculus", "MAT 2101". Null if unstated. */
  course: string | null;
  /** Short human title, e.g. "Calculus CAT". */
  title: string;
  /** ISO-8601 with offset (Africa/Nairobi, +03:00). Null when no date/time applies. */
  datetime: string | null;
  venue: string | null;
  notes: string | null;
  /** IDs of the messages this event was derived from. */
  sourceMessageIds: string[];
  /** Model's own confidence, 0..1. Below threshold triggers escalation. */
  confidence: number;
}

export interface ExtractionResult {
  events: ExtractedEvent[];
  /** Which model produced the accepted result. */
  model: string;
  escalated: boolean;
}
