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

export default function SignupScreen() {
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeAuthReturnPath(rawReturnTo);
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    if (!email.trim()) return 'Имэйл хаягаа оруулна уу.';
    if (!email.includes('@')) return 'Имэйл хаяг буруу байна.';
    if (!username.trim()) return 'Хэрэглэгчийн нэрээ оруулна уу.';
    if (username.trim().length < 3) return 'Хэрэглэгчийн нэр хамгийн багадаа 3 тэмдэгт байна.';
    if (!password) return 'Нууц үгээ оруулна уу.';
    if (password.length < 8) return 'Нууц үг хамгийн багадаа 8 тэмдэгт байна.';
    if (password !== password2) return 'Нууц үг таарахгүй байна.';
    return null;
  };

  const handleSignup = async () => {
    if (isSubmitting) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await signup(email.trim(), username.trim(), password);
      router.replace(await facebookReturnPath(returnTo));
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as Record<string, unknown> | undefined;
        if (data?.email) setError(`Имэйл: ${data.email}`);
        else if (data?.username) setError(`Хэрэглэгчийн нэр: ${data.username}`);
        else setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Бүртгэхэд алдаа гарлаа.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* ─── Буцах товч ─── */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <ThemedText style={styles.backIcon}>‹</ThemedText>
          <ThemedText type="small">Буцах</ThemedText>
        </Pressable>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <ThemedText type="title">Бүртгүүлэх</ThemedText>
              <ThemedText themeColor="textSecondary">
                Шинэ бүртгэл үүсгэж эхлэх
              </ThemedText>
            </View>

            <View style={styles.form}>
              {/* ─── Google товч ─── */}
              <GoogleSignInButton
                label="Google-ээр бүртгүүлэх"
                onError={(msg) => setError(msg)}
                returnTo={returnTo}
              />
              <FacebookSignInButton returnTo={returnTo} />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.dividerText}>
                  эсвэл имэйлээр
                </ThemedText>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">Имэйл</ThemedText>
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
                <ThemedText type="smallBold">Хэрэглэгчийн нэр</ThemedText>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="username"
                  autoCapitalize="none"
                  autoComplete="username-new"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">Нууц үг</ThemedText>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Хамгийн багадаа 8 тэмдэгт"
                  secureTextEntry
                  autoComplete="password-new"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">Нууц үг давтах</ThemedText>
                <TextInput
                  value={password2}
                  onChangeText={setPassword2}
                  placeholder="Нууц үгийг давтан оруулна уу"
                  secureTextEntry
                  autoComplete="password-new"
                  style={styles.input}
                />
              </View>

              {error ? (
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={handleSignup}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || isSubmitting) && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {isSubmitting ? 'Бүртгэж байна...' : 'Бүртгүүлэх'}
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <ThemedText type="small" themeColor="textSecondary">
                Бүртгэл байгаа юу?
              </ThemedText>
              <Pressable
                onPress={() => router.push(
                  returnTo
                    ? ({ pathname: '/login', params: { returnTo } } as never)
                    : '/login',
                )}>
                <ThemedText type="smallBold" style={styles.linkText}>
                  Нэвтрэх
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  backIcon: { fontSize: 24, lineHeight: 26, color: '#16A34A' },
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
