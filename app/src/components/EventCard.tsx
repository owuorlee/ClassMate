import { StyleSheet, Text, View } from 'react-native';
import { MapPin, Clock } from 'lucide-react-native';
import { category, colors, radius, spacing, type as typo } from '../theme/tokens';
import type { PlannerEvent } from '../data/types';
import { formatTime } from '../lib/datetime';
import { CategoryBadge } from './CategoryBadge';

export function EventCard({ event }: { event: PlannerEvent }) {
  const meta = category[event.type];
  const time = formatTime(event.datetime);

  return (
    <View style={styles.card}>
      {/* Category accent rail */}
      <View style={[styles.rail, { backgroundColor: meta.color }]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <CategoryBadge type={event.type} />
          {time ? (
            <View style={styles.timePill}>
              <Clock size={12} color={colors.textSecondary} strokeWidth={2.2} />
              <Text style={styles.timeText}>{time}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        {event.groupName ? <Text style={styles.group}>{event.groupName}</Text> : null}

        {event.venue ? (
          <View style={styles.metaRow}>
            <MapPin size={13} color={meta.color} strokeWidth={2.2} />
            <Text style={styles.venue}>{event.venue}</Text>
          </View>
        ) : null}

        {event.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {event.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  rail: { width: 4 },
  body: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  timeText: { ...typo.caption, color: colors.textSecondary },
  title: { ...typo.title, color: colors.textPrimary },
  group: { ...typo.caption, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 1 },
  venue: { ...typo.bodyMedium, color: colors.textSecondary },
  notes: { ...typo.body, color: colors.textMuted, marginTop: 2 },
});
