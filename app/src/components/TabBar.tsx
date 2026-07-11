import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CalendarDays, Users, User } from 'lucide-react-native';
import { colors, radius, shadow, spacing, type as typo } from '../theme/tokens';

const ICONS: Record<string, typeof CalendarDays> = {
  Planner: CalendarDays,
  Groups: Users,
  Profile: User,
};

/** A floating, dark, pill-highlighted tab bar — the premium touch. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || spacing.md }]} pointerEvents="box-none">
      <View style={[styles.bar, shadow.card]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? CalendarDays;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item} hitSlop={8}>
              <View style={[styles.pill, focused && styles.pillActive]}>
                <Icon
                  size={22}
                  color={focused ? colors.primaryBright : colors.textMuted}
                  strokeWidth={focused ? 2.5 : 2.1}
                />
              </View>
              <Text style={[styles.label, focused && styles.labelActive]}>{route.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  item: { alignItems: 'center', paddingHorizontal: spacing.lg, gap: 3 },
  pill: {
    width: 46,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primarySoft },
  label: { ...typo.caption, color: colors.textMuted, fontSize: 10.5 },
  labelActive: { color: colors.primaryBright },
});
