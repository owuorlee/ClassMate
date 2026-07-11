import type { PlannerEvent } from '../data/types';

/** Buckets the planner groups events into, in display order. */
export type Bucket = 'Overdue' | 'Today' | 'Tomorrow' | 'This week' | 'Later' | 'No date';

const BUCKET_ORDER: Bucket[] = ['Overdue', 'Today', 'Tomorrow', 'This week', 'Later', 'No date'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whole days from today's midnight to the event's midnight (negative = past). */
function dayDelta(now: Date, then: Date): number {
  const ms = startOfDay(then).getTime() - startOfDay(now).getTime();
  return Math.round(ms / 86_400_000);
}

export function bucketFor(ev: PlannerEvent, now: Date = new Date()): Bucket {
  if (!ev.datetime) return 'No date';
  const then = new Date(ev.datetime);
  const delta = dayDelta(now, then);
  if (then.getTime() < now.getTime() && delta <= 0) return delta < 0 ? 'Overdue' : 'Today';
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta <= 7) return 'This week';
  return 'Later';
}

export interface Section {
  bucket: Bucket;
  data: PlannerEvent[];
}

/** Groups events into ordered sections, each sorted chronologically. */
export function groupIntoSections(events: PlannerEvent[], now: Date = new Date()): Section[] {
  const map = new Map<Bucket, PlannerEvent[]>();
  for (const ev of events) {
    const b = bucketFor(ev, now);
    const arr = map.get(b) ?? [];
    arr.push(ev);
    map.set(b, arr);
  }
  const sections: Section[] = [];
  for (const bucket of BUCKET_ORDER) {
    const data = map.get(bucket);
    if (!data || data.length === 0) continue;
    data.sort((a, b) => (a.datetime ?? '').localeCompare(b.datetime ?? ''));
    sections.push({ bucket, data });
  }
  return sections;
}

/** The soonest upcoming (or ongoing-today) event — the "Next up" hero. */
export function nextUp(events: PlannerEvent[], now: Date = new Date()): PlannerEvent | null {
  const future = events
    .filter((e) => e.datetime && new Date(e.datetime).getTime() >= startOfDay(now).getTime())
    .sort((a, b) => (a.datetime ?? '').localeCompare(b.datetime ?? ''));
  return future[0] ?? null;
}

const TIME_FMT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
const DATE_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

export function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], TIME_FMT);
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'No date set';
  return new Date(iso).toLocaleDateString([], DATE_FMT);
}

/** Human countdown: "in 3h", "in 2 days", "Tomorrow", "Now". */
export function countdown(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const then = new Date(iso);
  const delta = dayDelta(now, then);
  if (delta > 1) return `in ${delta} days`;
  if (delta === 1) return 'Tomorrow';
  if (delta < 0) return `${Math.abs(delta)}d ago`;
  const diffMs = then.getTime() - now.getTime();
  const hrs = Math.round(diffMs / 3_600_000);
  if (hrs > 0) return `in ${hrs}h`;
  if (hrs === 0) return 'Now';
  return 'Today';
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
