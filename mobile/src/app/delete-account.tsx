import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function DeleteAccountScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { deleteAccount } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const completeDeletion = async () => {
    if (!acknowledged || isDeleting) return;
    setError('');
    setIsDeleting(true);
    try {
      const result = await deleteAccount();
      setSuccessMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Бүртгэл устгахад алдаа гарлаа.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (successMessage) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.successWrap}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={[styles.title, { color: C.text }]}>Бүртгэл устгагдлаа</Text>
            <Text style={[styles.successText, { color: C.textSecondary }]}>{successMessage}</Text>
            <Pressable
              onPress={() => router.replace('/(tabs)' as never)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Эхлэл рүү очих</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Text style={[styles.backText, { color: C.text }]}>‹ Буцах</Text>
          </Pressable>

          <Text style={[styles.title, { color: C.text }]}>Бүртгэл устгах</Text>
          <Text style={[styles.intro, { color: C.textSecondary }]}>
            Энэ үйлдэл буцаах боломжгүй. Та дараа нь энэ үйлчилгээг ашиглах бол шинэ бүртгэл үүсгэх шаардлагатай.
          </Text>

          <View style={[styles.warning, { backgroundColor: scheme === 'dark' ? '#3A2020' : '#FEF2F2' }]}>
            <Text style={styles.warningTitle}>Устах мэдээлэл</Text>
            <Text style={[styles.warningText, { color: C.text }]}>• Профайлын нэр, имэйл, утас, хаяг, зураг</Text>
            <Text style={[styles.warningText, { color: C.text }]}>• Дуртай зар, мэдэгдэл, тусламжийн хүсэлт, мессеж</Text>
            <Text style={[styles.warningText, { color: C.text }]}>• Google, Facebook, Apple нэвтрэх холбоос</Text>
          </View>

          <View style={[styles.info, { borderColor: C.backgroundSelected }]}>
            <Text style={[styles.infoTitle, { color: C.text }]}>Хадгалагдах зүйл</Text>
            <Text style={[styles.infoText, { color: C.textSecondary }]}>
              Төлбөр, буцаалт болон захиалгын хуульд шаардлагатай гүйлгээний бүртгэл нь санхүүгийн баримт болгон тусдаа хадгалагдана.
            </Text>
          </View>

          <Text style={[styles.note, { color: C.textSecondary }]}>
            Идэвхтэй захиалга эсвэл төлбөрийн нэхэмжлэлтэй бол эхлээд цуцалж дуусгана уу. Ингэснээр зочин, түрээслүүлэгчийн баталгаатай захиалга хохирохгүй.
          </Text>

          {!confirming ? (
            <Pressable
              onPress={() => setConfirming(true)}
              style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}>
              <Text style={styles.dangerButtonText}>Бүртгэлээ устгахыг үргэлжлүүлэх</Text>
            </Pressable>
          ) : (
            <View style={[styles.confirmCard, { borderColor: '#DC2626' }]}>
              <Text style={[styles.confirmTitle, { color: C.text }]}>Эцсийн баталгаажуулалт</Text>
              <Text style={[styles.confirmText, { color: C.textSecondary }]}>
                Бүртгэл болон хувийн мэдээллээ бүрмөсөн устгахыг хүсэж байгаагаа батална уу.
              </Text>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acknowledged }}
                onPress={() => setAcknowledged((current) => !current)}
                style={styles.checkRow}>
                <View style={[styles.checkbox, acknowledged && styles.checkboxChecked]}>
                  {acknowledged ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={[styles.checkLabel, { color: C.text }]}>Энэ үйлдэл буцаах боломжгүйг ойлгож байна.</Text>
              </Pressable>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable
                disabled={!acknowledged || isDeleting}
                onPress={completeDeletion}
                style={({ pressed }) => [
                  styles.dangerButton,
                  (!acknowledged || isDeleting) && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                {isDeleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.dangerButtonText}>Бүртгэлийг бүрмөсөн устгах</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setConfirming(false)} style={styles.cancelButton}>
                <Text style={[styles.cancelText, { color: C.textSecondary }]}>Болих</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.three, paddingBottom: 48 },
  back: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700' },
  intro: { fontSize: 16, lineHeight: 24 },
  warning: { borderRadius: 16, padding: Spacing.three, gap: 8 },
  warningTitle: { color: '#DC2626', fontSize: 17, fontWeight: '700' },
  warningText: { fontSize: 14, lineHeight: 21 },
  info: { borderWidth: 1, borderRadius: 16, padding: Spacing.three, gap: 6 },
  infoTitle: { fontSize: 16, fontWeight: '700' },
  infoText: { fontSize: 14, lineHeight: 21 },
  note: { fontSize: 13, lineHeight: 20 },
  primaryButton: {
    minHeight: 52, borderRadius: 12, backgroundColor: '#16A34A',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  dangerButton: {
    minHeight: 52, borderRadius: 12, backgroundColor: '#DC2626',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  dangerButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  confirmCard: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  confirmTitle: { fontSize: 17, fontWeight: '700' },
  confirmText: { fontSize: 14, lineHeight: 21 },
  checkRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 4 },
  checkbox: { width: 22, height: 22, borderWidth: 1.5, borderColor: '#9CA3AF', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  checkmark: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
  cancelButton: { alignItems: 'center', padding: 10 },
  cancelText: { fontSize: 15, fontWeight: '600' },
  errorText: { color: '#DC2626', fontSize: 14, lineHeight: 20 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  successWrap: { flex: 1, padding: Spacing.four, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  successIcon: { color: '#16A34A', fontSize: 56, fontWeight: '700' },
  successText: { textAlign: 'center', fontSize: 16, lineHeight: 24 },
});
