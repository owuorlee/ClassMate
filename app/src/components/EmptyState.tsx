import { StyleSheet, Text, View } from 'react-native';
import { CalendarCheck2 } from 'lucide-react-native';
import { colors, radius, spacing, type as typo } from '../theme/tokens';

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <CalendarCheck2 size={30} color={colors.primaryBright} strokeWidth={2} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typo.h2, color: colors.textPrimary },
  subtitle: { ...typo.body, color: colors.textMuted, textAlign: 'center', maxWidth: 260 },
});
