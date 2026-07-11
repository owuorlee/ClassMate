import type { Group, PlannerEvent, Student } from './types';

/**
 * Demo data so the app looks alive without a running server. Datetimes are
 * generated relative to "now" so Today / This week always have content.
 * Flavour is deliberately real: Kenyan campus courses, Sheng-tinged notes —
 * exactly what the extraction pipeline produces from class-group chatter.
 */

function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const MOCK_STUDENT: Student = { id: 'demo-student', name: 'Leslie' };

export const MOCK_GROUPS: Group[] = [
  { groupId: 'g-mat2101', displayName: 'MAT 2101 · Calculus II', eventCount: 3 },
  { groupId: 'g-cs2203', displayName: 'CS 2203 · Data Structures', eventCount: 2 },
  { groupId: 'g-cs2210', displayName: 'CS 2210 · Operating Systems', eventCount: 2 },
  { groupId: 'g-sta2100', displayName: 'STA 2100 · Probability', eventCount: 1 },
];

export const MOCK_EVENTS: PlannerEvent[] = [
  {
    id: 'e1',
    groupId: 'g-mat2101',
    groupName: 'MAT 2101 · Calculus II',
    type: 'cat',
    course: 'Calculus II',
    title: 'Calculus II CAT',
    datetime: at(0, 15, 0),
    venue: 'LT5',
    notes: 'Moved from LT2. Beba calculator na ID.',
  },
  {
    id: 'e2',
    groupId: 'g-cs2210',
    groupName: 'CS 2210 · Operating Systems',
    type: 'class_update',
    course: 'Operating Systems',
    title: 'OS class cancelled',
    datetime: at(0, 8, 0),
    venue: null,
    notes: 'Lecturer ako conference. No morning class leo.',
  },
  {
    id: 'e3',
    groupId: 'g-cs2203',
    groupName: 'CS 2203 · Data Structures',
    type: 'assignment',
    course: 'Data Structures',
    title: 'Assignment 2: Balanced trees',
    datetime: at(2, 23, 59),
    venue: null,
    notes: 'Submit on the portal. Group of 3 max.',
  },
  {
    id: 'e4',
    groupId: 'g-sta2100',
    groupName: 'STA 2100 · Probability',
    type: 'exam',
    course: 'Probability',
    title: 'Probability Main Exam',
    datetime: at(5, 9, 0),
    venue: 'Main Hall B',
    notes: 'Bring your exam card. Two hours.',
  },
  {
    id: 'e5',
    groupId: 'g-cs2203',
    groupName: 'CS 2203 · Data Structures',
    type: 'material',
    course: 'Data Structures',
    title: 'Chapter 4 notes shared',
    datetime: at(4, 12, 0),
    venue: null,
    notes: 'Prof amesend slides za AVL & red-black trees.',
  },
  {
    id: 'e6',
    groupId: 'g-mat2101',
    groupName: 'MAT 2101 · Calculus II',
    type: 'announcement',
    course: 'Calculus II',
    title: 'Consultation moved to Thursday',
    datetime: at(6, 14, 0),
    venue: 'Office 214',
    notes: 'Weekly consultation ni Thursday sasa, sio Wednesday.',
  },
];
