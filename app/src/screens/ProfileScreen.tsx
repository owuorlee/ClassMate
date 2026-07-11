import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Bell, ShieldCheck, Sparkles, ChevronRight } from 'lucide-react-native';
import { category, colors, radius, spacing, type as typo } from '../theme/tokens';
import type { Student } from '../data/types';
import { fetchStudent } from '../api/client';

function Row({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      {right ?? <ChevronRight size={20} color={colors.textMuted} strokeWidth={2.2} />}
    </View>
  );
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [student, setStudent] = useState<Student | null>(null);
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchStudent('demo-student')
      .then((s) => alive && setStudent(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(student?.name ?? 'C').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{student?.name ?? 'ClassMate student'}</Text>
          <Text style={styles.sub}>Your planner stays in sync automatically.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify().damping(18)} style={styles.group}>
          <Row
            icon={<Bell size={19} color={colors.primaryBright} strokeWidth={2.2} />}
            title="Notifications"
            subtitle="Get pinged when a CAT or deadline drops"
            right={
              <Switch
                value={notify}
                onValueChange={setNotify}
                trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
          <View style={styles.divider} />
          <Row
            icon={<ShieldCheck size={19} color={colors.success} strokeWidth={2.2} />}
            title="Privacy"
            subtitle="Only academic info is kept — social chatter is discarded"
          />
          <View style={styles.divider} />
          <Row
            icon={<Sparkles size={19} color={category.cat.color} strokeWidth={2.2} />}
            title="How ClassMate works"
            subtitle="A silent bot reads your class groups; AI extracts what matters"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify().damping(18)}>
          <Text style={styles.footer}>ClassMate · built for Kenyan campuses</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  profile: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xxl, gap: spacing.xs },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontFamily: 'Sora_700Bold', fontSize: 34, color: colors.primaryBright },
  name: { ...typo.h1, color: colors.textPrimary },
  sub: { ...typo.body, color: colors.textMuted },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...typo.title, color: colors.textPrimary },
  rowSub: { ...typo.caption, color: colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border },
  footer: { ...typo.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
