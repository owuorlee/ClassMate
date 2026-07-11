import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { colors, radius, shadow, spacing, type as typo } from '../theme/tokens';
import type { PlannerEvent } from '../data/types';
import { countdown, formatDate, formatTime } from '../lib/datetime';
import { CategoryIcon } from './CategoryIcon';

/** The hero card: the single most imminent event, front and centre. */
export function NextUpCard({ event }: { event: PlannerEvent }) {
  return (
    <LinearGradient
      colors={colors.primaryGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, shadow.glow]}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <CategoryIcon type={event.type} size={18} color="#fff" />
        </View>
        <Text style={styles.eyebrow}>NEXT UP</Text>
        <View style={styles.countdownPill}>
          <Text style={styles.countdownText}>{countdown(event.datetime)}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>
      {event.groupName ? <Text style={styles.group}>{event.groupName}</Text> : null}

      <View style={styles.footer}>
        <Text style={styles.when}>
          {formatDate(event.datetime)}
          {formatTime(event.datetime) ? ` · ${formatTime(event.datetime)}` : ''}
        </Text>
        {event.venue ? (
          <View style={styles.venueRow}>
            <MapPin size={13} color="rgba(255,255,255,0.9)" strokeWidth={2.4} />
            <Text style={styles.venue}>{event.venue}</Text>
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { ...typo.label, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5, flex: 1 },
  countdownPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
  },
  countdownText: { ...typo.label, color: '#fff' },
  title: { ...typo.h1, color: '#fff', marginTop: spacing.sm },
  group: { ...typo.bodyMedium, color: 'rgba(255,255,255,0.82)' },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  when: { ...typo.bodySemi, color: '#fff' },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  venue: { ...typo.bodyMedium, color: 'rgba(255,255,255,0.92)' },
});
