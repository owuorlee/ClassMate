/**
 * Client-side shapes. PlannerEvent mirrors the server's ExtractedEvent
 * (server/src/types.ts) but in camelCase and enriched with the group's
 * display name for rendering.
 */

export type EventType = 'cat' | 'exam' | 'assignment' | 'class_update' | 'material' | 'announcement';

export interface PlannerEvent {
  id: string;
  groupId: string;
  groupName: string;
  type: EventType;
  course: string | null;
  title: string;
  /** ISO-8601 with +03:00 offset, or null when no date applies. */
  datetime: string | null;
  venue: string | null;
  notes: string | null;
}

export interface Group {
  groupId: string;
  displayName: string | null;
  /** Count of active events — used on the Groups screen. */
  eventCount?: number;
}

export interface Student {
  id: string;
  name: string | null;
}
