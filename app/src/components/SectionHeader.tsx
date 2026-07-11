import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type as typo } from '../theme/tokens';

/** A bucket heading ("Today", "This week") with a count chip. */
export function SectionHeader({ title, count }: { title: string; count: number }) {
  const urgent = title === 'Today' || title === 'Overdue';
  return (
    <View style={styles.row}>
      <Text style={[styles.title, urgent && { color: colors.textPrimary }]}>{title}</Text>
      <View style={[styles.chip, urgent && { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.chipText, urgent && { color: colors.primaryBright }]}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, marginTop: spacing.xs },
  title: { ...typo.h2, color: colors.textSecondary },
  chip: {
    minWidth: 22,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  chipText: { ...typo.caption, color: colors.textMuted },
});
