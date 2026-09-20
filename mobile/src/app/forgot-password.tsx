import { router } from 'expo-router';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ApiError, requestPasswordReset } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!email.trim() || !email.includes('@')) {
      setError('Зөв имэйл хаяг оруулна уу.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 429 ? "Хэт олон хүсэлт илгээсэн байна. Түр хүлээгээд дахин оролдоно уу." : err.message);
      } else {
        setError('Хүсэлт илгээхэд алдаа гарлаа. Дахин оролдоно уу.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Буцах товч */}
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

            {sent ? (
              /* ─── Амжилттай илгээсэн дэлгэц ─── */
              <View style={styles.successCard}>
                <ThemedText style={styles.successIcon}>📬</ThemedText>
                <ThemedText type="title" style={styles.center}>
                  Имэйлээ шалгана уу
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.center}>
                  <ThemedText type="smallBold">{email}</ThemedText> хаяг бүртгэлтэй бол нууц үг
                  шинэчлэх холбоос очно. Холбоосоор орж нууц үгээ шинэчилнэ үү.
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  Имэйл ирэхгүй бол Spam/Junk хавтас болон хаягаа шалгана уу. Асуудал үргэлжилбэл тусламжийн багтай холбогдоно уу.
                </ThemedText>

                <Pressable
                  onPress={() => { setSent(false); }}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.secondaryButtonText}>
                    Хаягаа засах / дахин илгээх
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => router.replace('/login')}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.primaryButtonText}>
                    Нэвтрэх хуудас руу буцах
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              /* ─── Имэйл оруулах форм ─── */
              <>
                <View style={styles.header}>
                  <ThemedText type="title">Нууц үг мартсан</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    Бүртгэлтэй имэйл хаягаа оруулна уу. Нууц үг шинэчлэх холбоос
                    илгээгдэх болно. Google-ээр бүртгүүлсэн бол Google товчоор нэвтэрч болно. Эсвэл энэ холбоосоор тухайн аккаунтдаа нууц үг тохируулна уу.
                  </ThemedText>
                </View>

                <View style={styles.form}>
                  <View style={styles.field}>
                    <ThemedText type="smallBold">Имэйл хаяг</ThemedText>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="example@mail.com"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      returnKeyType="send"
                      onSubmitEditing={handleSubmit}
                      style={styles.input}
                    />
                  </View>

                  {error ? (
                    <ThemedText type="small" style={styles.errorText}>
                      {error}
                    </ThemedText>
                  ) : null}

                  <Pressable
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      (pressed || isSubmitting) && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" style={styles.primaryButtonText}>
                      {isSubmitting ? 'Илгээж байна...' : 'Холбоос илгээх'}
                    </ThemedText>
                  </Pressable>
                </View>

                <View style={styles.footer}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Нууц үгээ санасан уу?
                  </ThemedText>
                  <Pressable onPress={() => router.back()}>
                    <ThemedText type="smallBold" style={styles.linkText}>
                      Нэвтрэх
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            )}
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
  secondaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#16A34A',
    marginTop: Spacing.two,
  },
  secondaryButtonText: { color: '#16A34A', fontSize: 16 },
  pressed: { opacity: 0.8 },
  errorText: { color: '#DC2626' },
  successCard: {
    gap: Spacing.three,
    alignItems: 'center',
  },
  successIcon: { fontSize: 64 },
  center: { textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  linkText: { color: '#16A34A' },
});
