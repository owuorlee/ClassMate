import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Users, ChevronRight, Plus } from 'lucide-react-native';
import { colors, radius, spacing, type as typo } from '../theme/tokens';
import type { Group } from '../data/types';
import { fetchGroups } from '../api/client';

export function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    let alive = true;
    fetchGroups()
      .then((g) => alive && setGroups(g))
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
        <Animated.View entering={FadeIn.duration(400)}>
          <Text style={styles.h1}>Your groups</Text>
          <Text style={styles.sub}>Class groups ClassMate is quietly reading for you.</Text>
        </Animated.View>

        <View style={styles.list}>
          {groups.map((g, i) => (
            <Animated.View key={g.groupId} entering={FadeInDown.delay(80 + i * 60).springify().damping(18)}>
              <View style={styles.groupCard}>
                <View style={styles.groupIcon}>
                  <Users size={20} color={colors.primaryBright} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupName} numberOfLines={1}>
                    {g.displayName ?? g.groupId}
                  </Text>
                  <Text style={styles.groupMeta}>
                    {g.eventCount != null ? `${g.eventCount} active ${g.eventCount === 1 ? 'event' : 'events'}` : 'Listening'}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textMuted} strokeWidth={2.2} />
              </View>
            </Animated.View>
          ))}

          <Animated.View entering={FadeInDown.delay(120 + groups.length * 60).springify().damping(18)}>
            <View style={styles.addCard}>
              <View style={styles.addIcon}>
                <Plus size={20} color={colors.primaryBright} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addTitle}>Join a class group</Text>
                <Text style={styles.groupMeta}>Add the ClassMate bot to a WhatsApp group once — that's it.</Text>
              </View>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  h1: { ...typo.hero, color: colors.textPrimary },
  sub: { ...typo.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl },
  list: { gap: spacing.md },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: { ...typo.title, color: colors.textPrimary },
  groupMeta: { ...typo.caption, color: colors.textMuted, marginTop: 2 },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    padding: spacing.lg,
  },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTitle: { ...typo.title, color: colors.textPrimary },
});
