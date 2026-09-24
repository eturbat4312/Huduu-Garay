import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FacebookSignInButton } from '@/components/facebook-sign-in-button';
import { facebookReturnPath } from '@/lib/facebook';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api';
import { safeAuthReturnPath } from '@/lib/auth-return';

export default function LoginScreen() {
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeAuthReturnPath(rawReturnTo);
  const isBookingLogin = returnTo?.startsWith('/checkout?') ?? false;
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (isSubmitting) return;
    if (!email.trim() || !password) {
      setError('Имэйл болон нууц үгээ оруулна уу.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace(await facebookReturnPath(returnTo));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Имэйл эсвэл нууц үг буруу байна.');
      } else {
        setError(err instanceof Error ? err.message : 'Нэвтрэхэд алдаа гарлаа.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <ThemedText type="title">Нэвтрэх</ThemedText>
              <ThemedText themeColor="textSecondary">
                {isBookingLogin
                  ? 'Захиалгаа үргэлжлүүлэхийн тулд нэвтэрнэ үү. Нэвтэрсний дараа сонгосон захиалга руу буцаана.'
                  : 'Танайд Хоноё — Орон сууц, Зуслан, Амралт захиалгын цогц платформ'}
              </ThemedText>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <ThemedText type="smallBold">Имэйл эсвэл хэрэглэгчийн нэр</ThemedText>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="example@mail.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">Нууц үг</ThemedText>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  autoComplete="password"
                  style={styles.input}
                />
              </View>

              {error ? (
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={handleLogin}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || isSubmitting) && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {isSubmitting ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
                </ThemedText>
              </Pressable>

              <Pressable onPress={() => router.push('/forgot-password')} style={styles.linkButton}>
                <ThemedText type="small" themeColor="textSecondary">
                  Нууц үг мартсан?
                </ThemedText>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.dividerText}>
                  эсвэл
                </ThemedText>
                <View style={styles.dividerLine} />
              </View>

              <GoogleSignInButton
                label="Google-ээр нэвтрэх"
                onError={(msg) => setError(msg)}
                returnTo={returnTo}
              />
              <FacebookSignInButton returnTo={returnTo} />
            </View>

            <View style={styles.footer}>
              <ThemedText type="small" themeColor="textSecondary">
                Бүртгэл байхгүй юу?
              </ThemedText>
              <Pressable
                onPress={() => router.push(
                  returnTo
                    ? ({ pathname: '/signup', params: { returnTo } } as never)
                    : '/signup',
                )}>
                <ThemedText type="smallBold" style={styles.linkText}>
                  Бүртгүүлэх
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: { gap: Spacing.two },
  form: { gap: Spacing.three },
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D7DAE0',
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    backgroundColor: '#FFFFFF',
    color: '#000000',
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#16A34A',
    marginTop: Spacing.two,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16 },
  pressed: { opacity: 0.8 },
  errorText: { color: '#DC2626' },
  linkButton: { alignItems: 'center', paddingVertical: Spacing.two },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#D7DAE0' },
  dividerText: { paddingHorizontal: Spacing.one },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  linkText: { color: '#16A34A' },
});
