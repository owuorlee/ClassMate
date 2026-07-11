import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, spacing, type as typo } from '../theme/tokens';
import type { PlannerEvent, Student } from '../data/types';
import { fetchPlanner, fetchStudent, isMock } from '../api/client';
import { greeting, groupIntoSections, nextUp } from '../lib/datetime';
import { NextUpCard } from '../components/NextUpCard';
import { SectionHeader } from '../components/SectionHeader';
import { EventCard } from '../components/EventCard';
import { EmptyState } from '../components/EmptyState';

export function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchPlanner('demo-student'), fetchStudent('demo-student')])
      .then(([evs, stu]) => {
        if (!alive) return;
        setEvents(evs);
        setStudent(stu);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const hero = useMemo(() => nextUp(events), [events]);
  const sections = useMemo(() => groupIntoSections(events), [events]);
  const today = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  let animIndex = 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {greeting()}
              {student?.name ? ',' : ''}
            </Text>
            {student?.name ? <Text style={styles.name}>{student.name}</Text> : null}
            <Text style={styles.date}>{today}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(student?.name ?? 'C').charAt(0).toUpperCase()}</Text>
          </View>
        </Animated.View>

        {isMock ? (
          <Animated.View entering={FadeIn.delay(150)} style={styles.demoTag}>
            <Text style={styles.demoText}>Demo data · set EXPO_PUBLIC_API_URL for live</Text>
          </Animated.View>
        ) : null}

        {hero ? (
          <Animated.View entering={FadeInDown.delay(120).springify().damping(18)} style={{ marginBottom: spacing.xl }}>
            <NextUpCard event={hero} />
          </Animated.View>
        ) : null}

        {!loading && events.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            subtitle="No academic events yet. As your class reps post CATs, deadlines and updates, they'll appear here automatically."
          />
        ) : null}

        {sections.map((section) => (
          <View key={section.bucket} style={styles.section}>
            <SectionHeader title={section.bucket} count={section.data.length} />
            <View style={{ gap: spacing.md }}>
              {section.data.map((ev) => {
                const delay = 180 + animIndex++ * 55;
                return (
                  <Animated.View key={ev.id} entering={FadeInDown.delay(delay).springify().damping(18)}>
                    <EventCard event={ev} />
                  </Animated.View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xl },
  greeting: { ...typo.body, color: colors.textSecondary },
  name: { ...typo.hero, color: colors.textPrimary, marginTop: 2 },
  date: { ...typo.bodyMedium, color: colors.textMuted, marginTop: spacing.xs },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typo.h2, color: colors.primaryBright },
  demoTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: 999,
    marginBottom: spacing.lg,
  },
  demoText: { ...typo.caption, color: colors.textMuted },
  section: { marginBottom: spacing.xl },
});
