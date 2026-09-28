import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { verifyRegistrationEmail } from '@/lib/api';

export default function ConfirmEmailScreen() {
  const { key } = useLocalSearchParams<{ key?: string }>();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const C = Colors[scheme];
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  async function confirm() {
    if (!key || state === 'loading') {
      if (!key) {
        setError('Баталгаажуулах холбоос дутуу байна.');
        setState('error');
      }
      return;
    }

    setState('loading');
    setError('');
    try {
      await verifyRegistrationEmail(key);
      setState('success');
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 400
          ? 'Энэ холбоос хүчингүй эсвэл өмнө нь ашиглагдсан байна.'
          : 'Имэйл баталгаажуулахад алдаа гарлаа. Дахин оролдоно уу.',
      );
      setState('error');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.card, { backgroundColor: C.backgroundElement }]}>
          <Text style={styles.icon}>{state === 'success' ? '✅' : '📧'}</Text>
          <Text style={[styles.title, { color: C.text }]}>
            {state === 'success' ? 'Имэйл баталгаажлаа' : 'Имэйл хаягаа баталгаажуулах'}
          </Text>
          <Text style={[styles.description, { color: C.textSecondary }]}>
            {state === 'success'
              ? 'Таны имэйл хаяг амжилттай баталгаажлаа. Одоо бүртгэлээрээ нэвтэрч болно.'
              : 'Доорх товчийг дарж бүртгэлийн имэйл хаягаа баталгаажуулна уу.'}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {state === 'success' ? (
            <Pressable
              onPress={() => router.replace({ pathname: '/login', params: { email_verified: '1' } } as never)}
              style={styles.button}>
              <Text style={styles.buttonText}>Нэвтрэх</Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={!key || state === 'loading'}
              onPress={() => void confirm()}
              style={[styles.button, (!key || state === 'loading') && styles.buttonDisabled]}>
              {state === 'loading' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Имэйл баталгаажуулах</Text>
              )}
            </Pressable>
          )}

          {state !== 'success' ? (
            <Pressable onPress={() => router.replace('/login')}>
              <Text style={styles.link}>Нэвтрэх хуудас руу буцах</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  card: { borderRadius: 18, padding: Spacing.four, gap: Spacing.three, alignItems: 'center' },
  icon: { fontSize: 52 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  error: { color: '#DC2626', fontSize: 14, textAlign: 'center' },
  button: {
    width: '100%', minHeight: 48, borderRadius: 12, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  link: { color: '#15803D', fontSize: 14, fontWeight: '600' },
});
