import { StyleSheet, Text, View } from 'react-native';
import { category, radius, spacing, type as typo } from '../theme/tokens';
import type { EventType } from '../data/types';
import { CategoryIcon } from './CategoryIcon';

export function CategoryBadge({ type }: { type: EventType }) {
  const meta = category[type];
  return (
    <View style={[styles.badge, { backgroundColor: meta.soft }]}>
      <CategoryIcon type={type} size={13} color={meta.color} />
      <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: { ...typo.caption },
});
