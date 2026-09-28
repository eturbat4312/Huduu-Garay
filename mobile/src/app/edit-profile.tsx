import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import {
  fetchHostApplication,
  resolveMediaUrl,
  updateHostApplication,
  updateMe,
} from '@/lib/api';

const BANK_OPTIONS = [
  'Хаан Банк',
  'Голомт Банк',
  'ХХБанк',
  'Төрийн Банк',
  'Капитрон',
  'ХАС Банк',
  'Чингис Хаан Банк',
];

type AvatarFile = { uri: string; name: string; type: string };

export default function EditProfileScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { user, refresh } = useAuth();

  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [hostPhone, setHostPhone] = useState(user?.host_phone_number ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [avatarFile, setAvatarFile] = useState<AvatarFile | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(resolveMediaUrl(user?.avatar));
  const [hostApplicationLoaded, setHostApplicationLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user?.is_host) return;
    let active = true;
    fetchHostApplication()
      .then((application) => {
        if (!active) return;
        setHostPhone(application.phone_number || user.host_phone_number || '');
        setBankName(application.bank_name || '');
        setAccountNumber(application.account_number || '');
        setHostApplicationLoaded(true);
      })
      .catch(() => {
        if (active) setHostApplicationLoaded(false);
      });
    return () => { active = false; };
  }, [user?.host_phone_number, user?.is_host]);

  async function pickAvatar() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Зургийн цомогт хандах зөвшөөрөл өгнө үү.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAvatarFile({
      uri: asset.uri,
      name: asset.fileName ?? 'avatar.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    });
    setAvatarPreview(asset.uri);
  }

  async function handleSave() {
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      if (!username.trim()) throw new Error('Хэрэглэгчийн нэр хоосон байж болохгүй.');
      if (!email.trim() || !email.includes('@')) throw new Error('Имэйл хаягаа зөв оруулна уу.');

      if (avatarFile) {
        const formData = new FormData();
        formData.append('username', username.trim());
        formData.append('email', email.trim());
        formData.append('full_name', fullName.trim());
        formData.append('phone', phone.trim());
        formData.append('address', address.trim());
        formData.append('bio', bio.trim());
        if (user?.is_host) formData.append('host_phone_number', hostPhone.trim());
        formData.append('avatar', avatarFile as any);
        await updateMe(formData);
      } else {
        await updateMe({
          username: username.trim(),
          email: email.trim(),
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          bio: bio.trim(),
          ...(user?.is_host ? { host_phone_number: hostPhone.trim() } : {}),
        });
      }

      if (user?.is_host && hostApplicationLoaded) {
        await updateHostApplication({
          phone_number: hostPhone.trim(),
          bank_name: bankName,
          account_number: accountNumber.trim(),
        });
      }
      await refresh();
      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    } catch (err: any) {
      setError(err?.message ?? 'Хадгалахад алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Гарчиг мөр */}
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={[styles.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
              </Pressable>
              <Text style={[styles.headerTitle, { color: C.text }]}>Профайл засах</Text>
              <View style={{ width: 64 }} />
            </View>

            {/* Амжилт */}
            {success && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✅ Амжилттай хадгалагдлаа!</Text>
              </View>
            )}

            <View style={styles.avatarSection}>
              <View style={[styles.avatarWrap, { backgroundColor: C.backgroundSelected }]}>
                {avatarPreview ? (
                  <Image source={{ uri: avatarPreview }} style={styles.avatar} />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {(fullName || username || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => void pickAvatar()} style={styles.avatarButton}>
                <Text style={styles.avatarButtonText}>Зураг солих</Text>
              </Pressable>
            </View>

            {/* Имейл */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Имейл</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                style={[
                  styles.input,
                  { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected },
                ]}
              />
            </View>

            {/* Хэрэглэгчийн нэр */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Хэрэглэгчийн нэр</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
                style={[
                  styles.input,
                  { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected },
                ]}
              />
            </View>

            {/* Бүтэн нэр */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Бүтэн нэр</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Жишээ: Болд Бат"
                placeholderTextColor={C.textSecondary}
                style={[
                  styles.input,
                  { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected },
                ]}
              />
            </View>

            {user?.is_host ? (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: C.text }]}>Түрээслүүлэгчийн холбоо барих утас</Text>
                <TextInput
                  value={hostPhone}
                  onChangeText={setHostPhone}
                  placeholder="9900 0000"
                  placeholderTextColor={C.textSecondary}
                  keyboardType="phone-pad"
                  style={[
                    styles.input,
                    { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected },
                  ]}
                />
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Хаяг</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Хот, дүүрэг, хороо"
                placeholderTextColor={C.textSecondary}
                style={[
                  styles.input,
                  { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected },
                ]}
              />
            </View>

            {/* Утасны дугаар */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Утасны дугаар</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="9900 0000"
                placeholderTextColor={C.textSecondary}
                keyboardType="phone-pad"
                style={[
                  styles.input,
                  { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected },
                ]}
              />
            </View>

            {user?.is_host && hostApplicationLoaded ? (
              <View style={[styles.bankCard, { borderColor: C.backgroundSelected }]}>
                <Text style={[styles.bankTitle, { color: C.text }]}>🏦 Төлбөр хүлээн авах данс</Text>
                <Text style={[styles.label, { color: C.text }]}>Банк</Text>
                <View style={styles.bankOptions}>
                  {BANK_OPTIONS.map((bank) => (
                    <Pressable
                      key={bank}
                      onPress={() => setBankName(bank)}
                      style={[
                        styles.bankOption,
                        { borderColor: bankName === bank ? '#16A34A' : C.backgroundSelected },
                        bankName === bank && styles.bankOptionSelected,
                      ]}>
                      <Text style={{ color: bankName === bank ? '#15803D' : C.text, fontSize: 13 }}>
                        {bankName === bank ? '✓ ' : ''}{bank}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.label, { color: C.text }]}>Дансны дугаар</Text>
                <TextInput
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="number-pad"
                  placeholder="Дансны дугаар"
                  placeholderTextColor={C.textSecondary}
                  style={[
                    styles.input,
                    { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected },
                  ]}
                />
              </View>
            ) : null}

            {/* Товч танилцуулга */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.text }]}>Товч танилцуулга</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Өөрийн тухай товч бичнэ үү..."
                placeholderTextColor={C.textSecondary}
                multiline
                numberOfLines={4}
                style={[
                  styles.textArea,
                  { color: C.text, backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected },
                ]}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Хадгалах товч */}
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [styles.saveBtn, (pressed || saving) && { opacity: 0.75 }]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Хадгалах</Text>
              )}
            </Pressable>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: Spacing.three },

  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: Spacing.three,
  },
  backBtn: { width: 64 },
  backText: { fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  successBanner: {
    backgroundColor: '#DCFCE7', borderRadius: 12,
    padding: Spacing.three, marginBottom: Spacing.three, alignItems: 'center',
  },
  successText: { color: '#15803D', fontSize: 15, fontWeight: '700' },

  avatarSection: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.four },
  avatarWrap: {
    width: 96, height: 96, borderRadius: 48, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarInitial: { color: '#16A34A', fontSize: 36, fontWeight: '700' },
  avatarButton: {
    borderWidth: 1, borderColor: '#16A34A', borderRadius: 18,
    paddingHorizontal: Spacing.three, paddingVertical: 8,
  },
  avatarButtonText: { color: '#15803D', fontSize: 13, fontWeight: '700' },

  fieldGroup: { marginBottom: Spacing.three },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },

  input: {
    height: 50, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: Spacing.three, fontSize: 15,
  },
  textArea: {
    borderWidth: 1, borderRadius: 12,
    padding: Spacing.three, fontSize: 15,
    minHeight: 100, textAlignVertical: 'top',
  },
  bankCard: {
    borderWidth: 1, borderRadius: 14, padding: Spacing.three,
    gap: Spacing.two, marginBottom: Spacing.three,
  },
  bankTitle: { fontSize: 16, fontWeight: '700' },
  bankOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  bankOption: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 },
  bankOptionSelected: { backgroundColor: '#DCFCE7' },

  errorText: { color: '#DC2626', fontSize: 13, marginBottom: Spacing.two },

  saveBtn: {
    height: 52, borderRadius: 14, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.five,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
