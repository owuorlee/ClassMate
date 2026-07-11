import { BookOpen, CalendarClock, FileText, GraduationCap, Megaphone, PencilLine } from 'lucide-react-native';
import type { EventType } from '../data/types';

const ICONS = {
  cat: PencilLine,
  exam: GraduationCap,
  assignment: FileText,
  class_update: CalendarClock,
  material: BookOpen,
  announcement: Megaphone,
} as const;

export function CategoryIcon({ type, size = 20, color }: { type: EventType; size?: number; color: string }) {
  const Icon = ICONS[type];
  return <Icon size={size} color={color} strokeWidth={2.2} />;
}
