import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ApiError, confirmPasswordReset } from '@/lib/api';

export default function ResetPasswordScreen() {
  const { uid, token } = useLocalSearchParams<{ uid?: string; token?: string }>();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!uid || !token) {
      setError('Нууц үг шинэчлэх холбоос буруу байна. Шинэ холбоос авна уу.');
      return;
    }
    if (password.length < 8) {
      setError('Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой.');
      return;
    }
    if (password !== confirmation) {
      setError('Нууц үгүүд таарахгүй байна.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await confirmPasswordReset(uid, token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError
        ? (err.status === 429 ? "Хэт олон хүсэлт илгээсэн байна. Түр хүлээгээд дахин оролдоно уу." : err.message)
        : 'Нууц үг шинэчлэхэд алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}>
          <View style={styles.content}>
            {success ? (
              <>
                <ThemedText style={styles.icon}>✅</ThemedText>
                <ThemedText type="subtitle" style={styles.centerText}>
                  Нууц үг шинэчлэгдлээ
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  Та шинэ нууц үгээрээ нэвтэрч болно.
                </ThemedText>
                <Pressable
                  onPress={() => router.replace('/login')}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.primaryButtonText}>
                    Нэвтрэх
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.header}>
                  <ThemedText type="subtitle">Нууц үг шинэчлэх</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    8–128 тэмдэгттэй, түгээмэл биш, дан тооноос бүрдээгүй нууц үгээ хоёр удаа оруулна уу.
                  </ThemedText>
                </View>

                {!uid || !token ? (
                  <ThemedText type="small" style={styles.errorText}>
                    Холбоосын мэдээлэл дутуу байна. Нууц үг сэргээх хүсэлтийг дахин илгээнэ үү.
                  </ThemedText>
                ) : null}

                <View style={styles.field}>
                  <ThemedText type="smallBold">Шинэ нууц үг</ThemedText>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    maxLength={128}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    placeholder="Хамгийн багадаа 8 тэмдэгт"
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <ThemedText type="smallBold">Нууц үг давтах</ThemedText>
                  <TextInput
                    value={confirmation}
                    onChangeText={setConfirmation}
                    secureTextEntry
                    maxLength={128}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    placeholder="Нууц үгээ дахин оруулна уу"
                    style={styles.input}
                  />
                </View>

                {error ? <ThemedText type="small" style={styles.errorText}>{error}</ThemedText> : null}

                <Pressable
                  onPress={handleSubmit}
                  disabled={submitting || !uid || !token}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (pressed || submitting || !uid || !token) && styles.pressed,
                  ]}>
                  {submitting
                    ? <ActivityIndicator color="#fff" />
                    : <ThemedText type="smallBold" style={styles.primaryButtonText}>
                        Нууц үг шинэчлэх
                      </ThemedText>}
                </Pressable>

                <Pressable onPress={() => router.replace('/forgot-password')} style={styles.linkButton}>
                  <ThemedText type="smallBold" style={styles.linkText}>
                    Шинэ холбоос авах
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: { gap: Spacing.two, marginBottom: Spacing.one },
  field: { gap: Spacing.one },
  input: {
    minHeight: 50,
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
  pressed: { opacity: 0.65 },
  errorText: { color: '#DC2626' },
  linkButton: { alignItems: 'center', padding: Spacing.two },
  linkText: { color: '#16A34A' },
  icon: { fontSize: 64, textAlign: 'center' },
  centerText: { textAlign: 'center' },
});
