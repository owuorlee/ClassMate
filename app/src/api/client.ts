import type { Group, PlannerEvent, Student } from '../data/types';
import { MOCK_EVENTS, MOCK_GROUPS, MOCK_STUDENT } from '../data/mock';

/**
 * Planner API client. Points at the server we built (server/src/api/app.ts).
 *
 * Set EXPO_PUBLIC_API_URL to the server's address to use live data (on a phone
 * that's your machine's LAN IP, e.g. http://192.168.1.20:4000 — not localhost).
 * With no URL set, the app falls back to bundled mock data so it always demos.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const USE_MOCK = API_URL === '';

/** Map a raw SQLite event row from the API to the client shape. */
function mapEvent(row: Record<string, unknown>, groupName: string): PlannerEvent {
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    groupName,
    type: row.type as PlannerEvent['type'],
    course: (row.course as string | null) ?? null,
    title: String(row.title),
    datetime: (row.datetime as string | null) ?? null,
    venue: (row.venue as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function fetchGroups(): Promise<Group[]> {
  if (USE_MOCK) return MOCK_GROUPS;
  const rows = await getJson<Array<Record<string, unknown>>>('/groups');
  return rows.map((r) => ({ groupId: String(r.group_id), displayName: (r.display_name as string | null) ?? null }));
}

export async function fetchPlanner(studentId: string): Promise<PlannerEvent[]> {
  if (USE_MOCK) return MOCK_EVENTS;
  const groups = await fetchGroups();
  const nameById = new Map(groups.map((g) => [g.groupId, g.displayName ?? g.groupId]));
  const rows = await getJson<Array<Record<string, unknown>>>(`/students/${studentId}/planner`);
  return rows.map((r) => mapEvent(r, nameById.get(String(r.group_id)) ?? String(r.group_id)));
}

export async function fetchStudent(studentId: string): Promise<Student> {
  if (USE_MOCK) return MOCK_STUDENT;
  const row = await getJson<Record<string, unknown>>(`/students/${studentId}`);
  return { id: String(row.id), name: (row.name as string | null) ?? null };
}

export const isMock = USE_MOCK;
