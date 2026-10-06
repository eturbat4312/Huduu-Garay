import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { loginHref } from '@/lib/auth-return';

type HostActionProps = {
  variant?: 'inline' | 'card';
};

export function HostAction({ variant = 'inline' }: HostActionProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return null;

  const isHost = user?.is_host ?? false;
  const status = user?.host_application_status;
  const pending = !isHost && status === 'pending';
  const rejected = !isHost && status === 'rejected';
  const route = isHost ? '/create-listing' : '/become-host';
  const buttonLabel = isHost
    ? '＋ Зар оруулах'
    : pending
      ? '⏳ Хүсэлт хянагдаж байна'
      : rejected
        ? '↻ Түрээслүүлэгч болох хүсэлт'
        : '🏠 Түрээслүүлэгч болох';

  const openAction = () => {
    if (!isAuthenticated) {
      router.push(loginHref('/become-host'));
      return;
    }
    router.push(route as never);
  };

  if (variant === 'inline') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        onPress={openAction}
        style={({ pressed }) => [
          styles.inlineButton,
          pending && styles.pendingButton,
          pressed && styles.pressed,
        ]}>
        <Text style={styles.inlineLabel}>{buttonLabel}</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: scheme === 'dark' ? '#102A1B' : '#F0FDF4',
          borderColor: scheme === 'dark' ? '#166534' : '#86EFAC',
        },
      ]}>
      <View style={styles.cardCopy}>
        <Text style={[styles.cardTitle, { color: C.text }]}>
          {isHost ? 'Шинэ зар оруулах' : 'Байраа түрээслүүлэх үү?'}
        </Text>
        <Text style={[styles.cardDescription, { color: C.textSecondary }]}>
          {isHost
            ? 'Байр, зуслан эсвэл амралтын газрын шинэ зараа эндээс оруулна.'
            : !isAuthenticated
              ? 'Нэвтэрч эсвэл бүртгүүлээд байраа зарлаж, захиалга хүлээн аваарай.'
              : pending
              ? 'Таны түрээслүүлэгч болох хүсэлтийг ажилтан хянаж байна.'
              : rejected
                ? 'Өмнөх хүсэлтийн хариуг хараад шаардлагатай мэдээллээ шалгана уу.'
                : 'Баталгаажсаны дараа зар оруулж, захиалга хүлээн авах боломжтой.'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={openAction}
        style={({ pressed }) => [
          styles.cardButton,
          pending && styles.pendingButton,
          pressed && styles.pressed,
        ]}>
        <Text style={styles.cardButtonLabel}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    backgroundColor: '#16A34A',
  },
  pendingButton: { backgroundColor: '#B45309' },
  inlineLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  card: {
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  cardCopy: { gap: Spacing.one },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardDescription: { fontSize: 14, lineHeight: 20 },
  cardButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    backgroundColor: '#16A34A',
  },
  cardButtonLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
