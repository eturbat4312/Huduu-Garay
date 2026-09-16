/**
 * Түрээслүүлэгч болох өргөдлийн форм
 *
 * Backend: POST /host/apply/ — multipart/form-data
 * Талбарууд: full_name, phone_number, bank_name, account_number,
 *            id_card_image (file), selfie_with_id (file)
 *
 * ⚠️  Зураг upload: expo-image-picker суулгасны дараа pickImage() дотрох
 *     TODO блокийг нээнэ үү. Суулгах: npx expo install expo-image-picker
 */
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import * as ImagePicker from 'expo-image-picker';
import { applyToBeHostFormData } from '@/lib/api';

// ─── Тогтмол утгууд ────────────────────────────────────────────────────────
const BANK_OPTIONS = [
  'Хаан Банк', 'Голомт Банк', 'ХХБанк',
  'Төрийн Банк', 'Капитрон', 'ХАС Банк', 'Чингис Хаан Банк',
];

type ImageFile = { uri: string; name: string; type: string };

// ─── Дэлгэц ────────────────────────────────────────────────────────────────
export default function BecomeHostScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { user, refresh } = useAuth();

  const [fullName, setFullName]         = useState(user?.full_name ?? '');
  const [phoneNumber, setPhoneNumber]   = useState(user?.phone ?? '');
  const [bankName, setBankName]         = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [idCardImage, setIdCardImage]   = useState<ImageFile | null>(null);
  const [selfieImage, setSelfieImage]   = useState<ImageFile | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [error, setError]               = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // ── Зураг сонгох ────────────────────────────────────────────────────────
  async function pickImage(target: 'id' | 'selfie') {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError('Зургийн цомогт хандах зөвшөөрөл өгнө үү.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        const a = result.assets[0];
        const file: ImageFile = {
          uri: a.uri,
          name: a.fileName ?? (target === 'id' ? 'id_card.jpg' : 'selfie.jpg'),
          type: a.mimeType ?? 'image/jpeg',
        };
        if (target === 'id') setIdCardImage(file);
        else setSelfieImage(file);
      }
    } catch {
      setError('Зураг сонгоход алдаа гарлаа.');
    }
  }

  // ── Илгээх ──────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError('');
    if (!fullName.trim())      { setError('Бүтэн нэр оруулна уу.'); return; }
    if (!phoneNumber.trim())   { setError('Утасны дугаар оруулна уу.'); return; }
    if (!bankName)             { setError('Банк сонгоно уу.'); return; }
    if (!accountNumber.trim()) { setError('Дансны дугаар оруулна уу.'); return; }
    if (!idCardImage)          { setError('Иргэний үнэмлэхний зургийг оруулна уу.'); return; }
    if (!selfieImage)          { setError('Иргэний үнэмлэхтэй хамт зурсан зургийг оруулна уу.'); return; }
    if (!termsAccepted)        { setError('Хостын үйлчилгээний нөхцөлийг зөвшөөрнө үү.'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('full_name', fullName.trim());
      fd.append('phone_number', phoneNumber.trim());
      fd.append('bank_name', bankName);
      fd.append('account_number', accountNumber.trim());
      fd.append('id_card_image', { uri: idCardImage.uri, name: idCardImage.name, type: idCardImage.type } as any);
      fd.append('selfie_with_id', { uri: selfieImage.uri, name: selfieImage.name, type: selfieImage.type } as any);
      fd.append('host_terms_accepted', 'true');

      await applyToBeHostFormData(fd);
      await refresh();
      setSubmitted(true);
    } catch (err: any) {
      const detail = err?.data?.detail ?? err?.message ?? 'Алдаа гарлаа. Дахин оролдоно уу.';
      if (detail.includes('аль хэдийн')) {
        await refresh();
        router.back();
      } else {
        setError(detail);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Аль хэдийн хост / өргөдөл илгээсэн ──────────────────────────────────
  if (user?.is_host) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, styles.center]}>
          <Text style={{ fontSize: 56 }}>🏠</Text>
          <Text style={[styles.statusTitle, { color: '#16A34A' }]}>Та аль хэдийн хост болсон байна!</Text>
          <Pressable onPress={() => router.back()} style={styles.backPressable}>
            <Text style={[styles.backLinkText, { color: C.textSecondary }]}>‹ Буцах</Text>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (user?.host_application_status === 'pending') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, styles.center]}>
          <Text style={{ fontSize: 56 }}>⏳</Text>
          <Text style={[styles.statusTitle, { color: '#D97706' }]}>Таны өргөдөл хянагдаж байна</Text>
          <Text style={[styles.statusSub, { color: C.textSecondary }]}>
            Ажилтан таны өргөдлийг хянасны дараа имэйлээр мэдэгдэх болно.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backPressable}>
            <Text style={[styles.backLinkText, { color: C.textSecondary }]}>‹ Буцах</Text>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (user?.host_application_status === 'rejected') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, styles.center]}>
          <Text style={{ fontSize: 56 }}>❌</Text>
          <Text style={[styles.statusTitle, { color: '#DC2626' }]}>Өргөдөл татгалзагдсан</Text>
          <Text style={[styles.statusSub, { color: C.textSecondary }]}>
            Дэлгэрэнгүй мэдээллийг имэйлээс шалгана уу.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backPressable}>
            <Text style={[styles.backLinkText, { color: C.textSecondary }]}>‹ Буцах</Text>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Амжилт ────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, styles.center]}>
          <Text style={{ fontSize: 64 }}>✅</Text>
          <Text style={[styles.statusTitle, { color: C.text }]}>Өргөдөл амжилттай илгээгдлээ!</Text>
          <Text style={[styles.statusSub, { color: C.textSecondary }]}>
            Таны өргөдлийг хянасны дараа бид имэйлээр мэдэгдэх болно.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.submitBtn, { marginTop: Spacing.three }, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.submitText}>Буцах</Text>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Форм ──────────────────────────────────────────────────────────────────
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <Pressable onPress={() => router.back()} style={{ paddingVertical: Spacing.three }}>
              <Text style={[styles.backLinkText, { color: C.textSecondary }]}>‹ Буцах</Text>
            </Pressable>

            <Text style={[styles.title, { color: C.text }]}>Түрээслүүлэгч болох</Text>

            {/* Шимтгэлийн мэдээлэл */}
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>💰 Платформын шимтгэлийн талаар</Text>
              <Text style={styles.infoText}>
                Манай платформ таны захиалга бүрийн нийт дүнгийн{' '}
                <Text style={{ fontWeight: '700' }}>10%</Text>-ийг үйлчилгээний хөлс болгон авна.
              </Text>
              <View style={styles.exampleBox}>
                <Text style={styles.exampleRow}>Байрны үнэ: <Text style={{ fontWeight: '700' }}>100,000₮</Text> / хоног</Text>
                <Text style={styles.exampleRow}>Шимтгэл: <Text style={{ fontWeight: '700' }}>10,000₮</Text></Text>
                <Text style={[styles.exampleRow, { color: '#16A34A', fontWeight: '700' }]}>Таны авах: 90,000₮</Text>
              </View>
            </View>

            {/* Бүтэн нэр */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Бүтэн нэр *</Text>
              <TextInput
                value={fullName} onChangeText={setFullName}
                placeholder="Жишээ: Болд Бат" placeholderTextColor={C.textSecondary}
                style={[styles.input, { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}
              />
            </View>

            {/* Утас */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Утасны дугаар *</Text>
              <TextInput
                value={phoneNumber} onChangeText={setPhoneNumber}
                placeholder="9900 0000" placeholderTextColor={C.textSecondary}
                keyboardType="phone-pad"
                style={[styles.input, { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}
              />
            </View>

            {/* Банк */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Банк *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: Spacing.two, paddingVertical: 4 }}>
                  {BANK_OPTIONS.map((bank) => (
                    <Pressable
                      key={bank}
                      onPress={() => setBankName(bank)}
                      style={[
                        styles.chip,
                        bankName === bank
                          ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                          : { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected },
                      ]}
                    >
                      <Text style={{ color: bankName === bank ? '#fff' : C.text, fontSize: 13, fontWeight: '500' }}>
                        {bank}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Данс */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Дансны дугаар *</Text>
              <TextInput
                value={accountNumber} onChangeText={setAccountNumber}
                placeholder="1234567890" placeholderTextColor={C.textSecondary}
                keyboardType="number-pad"
                style={[styles.input, { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}
              />
            </View>

            {/* Иргэний үнэмлэх */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Иргэний үнэмлэхний зураг *</Text>
              <Pressable
                onPress={() => pickImage('id')}
                style={[styles.pickerBtn, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}
              >
                <Text style={{ fontSize: 26 }}>{idCardImage ? '✅' : '📷'}</Text>
                <Text style={[styles.pickerText, { color: idCardImage ? '#16A34A' : C.textSecondary }]}>
                  {idCardImage ? idCardImage.name : 'Зураг сонгох'}
                </Text>
              </Pressable>
            </View>

            {/* Selfie */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Иргэний үнэмлэхтэй хамт selfie *</Text>
              <Text style={[styles.selfieNote, { color: C.textSecondary }]}>
                Иргэний үнэмлэхээ гартаа барьж, нүүрийнхээ хажууд байлган зурна уу.
              </Text>
              <Pressable
                onPress={() => pickImage('selfie')}
                style={[styles.pickerBtn, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}
              >
                <Text style={{ fontSize: 26 }}>{selfieImage ? '✅' : '🤳'}</Text>
                <Text style={[styles.pickerText, { color: selfieImage ? '#16A34A' : C.textSecondary }]}>
                  {selfieImage ? selfieImage.name : 'Зураг сонгох'}
                </Text>
              </Pressable>
            </View>

            {/* Алдаа */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Хостын нөхцөл */}
            <Pressable
              onPress={() => setTermsAccepted((accepted) => !accepted)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              style={styles.termsConsent}>
              <View style={[
                styles.checkbox,
                { borderColor: termsAccepted ? '#16A34A' : C.backgroundSelected },
                termsAccepted && styles.checkboxChecked,
              ]}>
                {termsAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={[styles.termsConsentText, { color: C.text }]}>
                Би хостын үйлчилгээний нөхцөл болон захиалга бүрээс 10% үйлчилгээний
                шимтгэл суутгахыг уншиж, зөвшөөрч байна.
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/host-terms' as never)}
              style={styles.termsLinkBtn}>
              <Text style={styles.termsLinkText}>📄 Хостын үйлчилгээний нөхцөлийг харах →</Text>
            </Pressable>

            {/* Илгээх */}
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [styles.submitBtn, (pressed || submitting) && { opacity: 0.75 }]}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>Өргөдөл илгээх</Text>}
            </Pressable>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: Spacing.three },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three },

  backPressable: { paddingVertical: Spacing.two },
  backLinkText: { fontSize: 16 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: Spacing.three },

  infoCard: {
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 16, padding: Spacing.three, marginBottom: Spacing.three, gap: Spacing.two,
  },
  infoCardTitle: { fontSize: 15, fontWeight: '700', color: '#1D4ED8' },
  infoText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  exampleBox: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 10, padding: Spacing.two, gap: 4,
  },
  exampleRow: { fontSize: 13, color: '#374151' },

  fieldGroup: { marginBottom: Spacing.three },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    height: 50, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: Spacing.three, fontSize: 15,
  },

  chip: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },

  pickerBtn: {
    borderWidth: 1, borderRadius: 12, borderStyle: 'dashed',
    height: 68, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.three, gap: Spacing.two,
  },
  pickerText: { fontSize: 14, fontWeight: '500' },
  selfieNote: { fontSize: 12, marginBottom: Spacing.one, lineHeight: 18 },

  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: Spacing.three, marginBottom: Spacing.three,
  },
  errorText: { color: '#DC2626', fontSize: 13, lineHeight: 20 },

  termsLinkBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  termsConsent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#16A34A' },
  checkmark: { color: '#fff', fontWeight: '800', fontSize: 16 },
  termsConsentText: { flex: 1, fontSize: 13, lineHeight: 20 },
  termsLinkText: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    height: 52, borderRadius: 14, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.five,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  statusTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  statusSub: { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.three },
});
