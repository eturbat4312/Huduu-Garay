import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { updateMe } from '@/lib/api';

export default function EditProfileScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { user, refresh } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // user өөрчлөгдвөл утгуудыг шинэчлэх
  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? '');
      setPhone(user.phone ?? '');
      setBio(user.bio ?? '');
    }
  }, [user]);

  async function handleSave() {
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      await updateMe({
        full_name: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
      } as any);
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

            {/* Имейл (засах боломжгүй) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.textSecondary }]}>Имейл</Text>
              <View style={[styles.readonlyField, { backgroundColor: C.backgroundSelected }]}>
                <Text style={[styles.readonlyText, { color: C.textSecondary }]}>{user?.email}</Text>
              </View>
            </View>

            {/* Хэрэглэгчийн нэр (засах боломжгүй) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.textSecondary }]}>Хэрэглэгчийн нэр</Text>
              <View style={[styles.readonlyField, { backgroundColor: C.backgroundSelected }]}>
                <Text style={[styles.readonlyText, { color: C.textSecondary }]}>{user?.username}</Text>
              </View>
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
  readonlyField: {
    height: 50, borderRadius: 12,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  readonlyText: { fontSize: 15 },

  errorText: { color: '#DC2626', fontSize: 13, marginBottom: Spacing.two },

  saveBtn: {
    height: 52, borderRadius: 14, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.five,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
