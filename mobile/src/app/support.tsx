import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { createSupportRequest, fetchSupportRequests } from '@/lib/api';
import type { SupportRequest } from '@/types/api';

const categories: { value: SupportRequest['category']; label: string }[] = [
  { value: 'booking', label: 'Захиалга' },
  { value: 'payment', label: 'Төлбөр, буцаалт' },
  { value: 'listing', label: 'Зар, түрээслүүлэлт' },
  { value: 'account', label: 'Бүртгэл' },
  { value: 'other', label: 'Бусад' },
];

const faqs = [
  {
    question: 'Захиалга хэзээ баталгаажих вэ?',
    answer: 'QPay төлбөр амжилттай төлөгдөж, систем төлбөрийг шалгасны дараа захиалга баталгаажна. Төлбөр хүлээгдэж байгаа үед сонгосон өдрүүд 15 минут түр хадгалагдана.',
  },
  {
    question: 'Захиалгаа хэрхэн цуцлах вэ?',
    answer: 'Миний захиалгууд хэсгээс тухайн захиалгын дэлгэрэнгүй рүү орж цуцлах боломжтой. Цуцлахаас өмнө буцаан олголтын нөхцөл дэлгэцэд харагдана.',
  },
  {
    question: 'Төлбөрийн буцаалт хэзээ орох вэ?',
    answer: 'Цуцалсан захиалгын төлбөрийг манай ажилтан нөхцөлтэй нь тулган хянаж, буцаан олголтыг гараар шийдвэрлэнэ. Явцыг тодруулах шаардлагатай бол “Төлбөр, буцаалт” төрлийг сонгоно уу.',
  },
  {
    question: 'Байрны бүтэн хаяг хэзээ харагдах вэ?',
    answer: 'Байрны барилга болон хаалганы тоот зөвхөн төлбөртэй захиалга баталгаажсаны дараа тухайн зочинд харагдана.',
  },
  {
    question: 'Түрээслүүлэгч болох хүсэлтийг хэр удаан шалгах вэ?',
    answer: 'Манай ажилтан бүрдүүлсэн мэдээллийг шалгасны дараа шийдвэрийг системийн мэдэгдэл болон цахим шуудангаар илгээнэ.',
  },
  {
    question: 'Тусламжийн хүсэлтийн хариуг хаанаас харах вэ?',
    answer: 'Админ хариу өгмөгц танд мэдэгдэл болон цахим шуудан очно. Хариуг энэ дэлгэцийн “Миний хүсэлтүүд” хэсгээс харж болно.',
  },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { isAuthenticated, isLoading } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<SupportRequest['category']>('booking');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setError('');
      setRequests(await fetchSupportRequests());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Хүсэлтүүдийг ачаалж чадсангүй.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login' as never);
      return;
    }
    void loadRequests();
  }, [isAuthenticated, isLoading, loadRequests]));

  async function submit() {
    setError('');
    setSuccess('');
    if (subject.trim().length < 3 || message.trim().length < 10) {
      setError('Гарчиг болон асуудлын дэлгэрэнгүйг бүрэн бичнэ үү.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createSupportRequest({
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setRequests((current) => [created, ...current]);
      setSubject('');
      setMessage('');
      setSuccess('Таны хүсэлтийг хүлээн авлаа. Манай ажилтан шалгаад хариу өгнө.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Хүсэлт илгээхэд алдаа гарлаа.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color="#15803D" />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.safe}>
          <View style={[styles.header, { borderBottomColor: C.backgroundSelected }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
              <Text style={[styles.backIcon, { color: C.text }]}>‹</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: C.text }]}>Тусламж</Text>
            <View style={styles.backButton} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.intro, { color: C.textSecondary }]}>
              Түгээмэл асуултаас хариугаа олох эсвэл манай ажилтанд хүсэлт илгээнэ үү.
            </Text>

            <Text style={[styles.sectionTitle, { color: C.text }]}>Түгээмэл асуулт</Text>
            <View style={[styles.faqList, { borderColor: C.backgroundSelected }]}>
              {faqs.map((item, index) => {
                const open = openFaq === index;
                return (
                  <View key={item.question} style={index > 0 ? [styles.faqItem, { borderTopColor: C.backgroundSelected }] : undefined}>
                    <Pressable onPress={() => setOpenFaq(open ? null : index)} style={styles.faqQuestion}>
                      <Text style={[styles.faqQuestionText, { color: C.text }]}>{item.question}</Text>
                      <Text style={[styles.chevron, { color: C.textSecondary }]}>{open ? '⌃' : '⌄'}</Text>
                    </Pressable>
                    {open ? <Text style={[styles.faqAnswer, { color: C.textSecondary }]}>{item.answer}</Text> : null}
                  </View>
                );
              })}
            </View>

            <View style={[styles.sectionDivider, { backgroundColor: C.backgroundSelected }]} />
            <Text style={[styles.sectionTitle, { color: C.text }]}>Шинэ хүсэлт илгээх</Text>
            <Text style={[styles.label, { color: C.text }]}>Асуудлын төрөл</Text>
            <View style={styles.categoryWrap}>
              {categories.map((item) => {
                const selected = category === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setCategory(item.value)}
                    style={[
                      styles.categoryButton,
                      { borderColor: selected ? '#15803D' : C.backgroundSelected },
                      selected && styles.categorySelected,
                    ]}
                  >
                    <Text style={[styles.categoryText, { color: selected ? '#166534' : C.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: C.text }]}>Гарчиг</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              maxLength={160}
              placeholder="Асуудлаа товч бичнэ үү"
              placeholderTextColor={C.textSecondary}
              style={[styles.input, { color: C.text, borderColor: C.backgroundSelected, backgroundColor: C.backgroundElement }]}
            />

            <Text style={[styles.label, { color: C.text }]}>Дэлгэрэнгүй</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              maxLength={3000}
              multiline
              textAlignVertical="top"
              placeholder="Юу болсон, ямар тусламж хэрэгтэй байгааг дэлгэрэнгүй бичнэ үү"
              placeholderTextColor={C.textSecondary}
              style={[styles.input, styles.messageInput, { color: C.text, borderColor: C.backgroundSelected, backgroundColor: C.backgroundElement }]}
            />
            <Text style={[styles.counter, { color: C.textSecondary }]}>{message.length}/3000</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}
            <Pressable
              disabled={submitting}
              onPress={submit}
              style={({ pressed }) => [styles.submitButton, (pressed || submitting) && styles.pressed]}
            >
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Хүсэлт илгээх</Text>}
            </Pressable>

            <View style={[styles.sectionDivider, { backgroundColor: C.backgroundSelected }]} />
            <Text style={[styles.sectionTitle, { color: C.text }]}>Миний хүсэлтүүд</Text>
            {loading ? (
              <ActivityIndicator color="#15803D" style={styles.listLoader} />
            ) : requests.length === 0 ? (
              <Text style={[styles.empty, { color: C.textSecondary }]}>Одоогоор илгээсэн хүсэлт байхгүй байна.</Text>
            ) : requests.map((item) => (
              <View key={item.id} style={[styles.requestCard, { borderColor: C.backgroundSelected, backgroundColor: C.backgroundElement }]}>
                <View style={styles.requestTop}>
                  <Text style={styles.requestMeta}>#{item.id} · {item.category_display}</Text>
                  <Text style={[styles.requestStatus, { color: item.admin_reply ? '#15803D' : '#B45309' }]}>
                    {item.admin_reply ? '✓' : '◷'} {item.status_display}
                  </Text>
                </View>
                <Text style={[styles.requestSubject, { color: C.text }]}>{item.subject}</Text>
                <Text style={[styles.requestMessage, { color: C.textSecondary }]}>{item.message}</Text>
                <Text style={[styles.requestDate, { color: C.textSecondary }]}>Илгээсэн: {formatDate(item.created_at)}</Text>
                {item.admin_reply ? (
                  <View style={styles.replyBox}>
                    <Text style={styles.replyTitle}>Манай ажилтны хариу</Text>
                    <Text style={[styles.replyText, { color: C.text }]}>{item.admin_reply}</Text>
                    {item.responded_at ? <Text style={[styles.requestDate, { color: C.textSecondary }]}>Хариулсан: {formatDate(item.responded_at)}</Text> : null}
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { height: 56, paddingHorizontal: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 34, lineHeight: 36 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: Spacing.four },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.three },
  sectionDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.four },
  faqList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  faqItem: { borderTopWidth: StyleSheet.hairlineWidth },
  faqQuestion: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  faqQuestionText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  chevron: { width: 22, textAlign: 'center', fontSize: 18 },
  faqAnswer: { fontSize: 14, lineHeight: 21, paddingBottom: Spacing.three, paddingRight: Spacing.four },
  label: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.two, marginTop: Spacing.three },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  categoryButton: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  categorySelected: { backgroundColor: '#DCFCE7' },
  categoryText: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, fontSize: 15 },
  messageInput: { minHeight: 132, paddingTop: 12, paddingBottom: 12 },
  counter: { marginTop: 4, textAlign: 'right', fontSize: 12 },
  error: { color: '#B91C1C', fontSize: 14, lineHeight: 20, marginTop: Spacing.three },
  success: { color: '#15803D', fontSize: 14, lineHeight: 20, marginTop: Spacing.three },
  submitButton: { height: 48, marginTop: Spacing.three, borderRadius: 6, backgroundColor: '#15803D', alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  listLoader: { marginVertical: Spacing.four },
  empty: { fontSize: 14, paddingVertical: Spacing.four },
  requestCard: { borderWidth: 1, borderRadius: 6, padding: Spacing.three, marginBottom: Spacing.three },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  requestMeta: { color: '#15803D', fontSize: 12, fontWeight: '700', flex: 1 },
  requestStatus: { fontSize: 12, fontWeight: '700' },
  requestSubject: { fontSize: 16, lineHeight: 22, fontWeight: '700', marginTop: Spacing.two },
  requestMessage: { fontSize: 14, lineHeight: 21, marginTop: Spacing.two },
  requestDate: { fontSize: 11, marginTop: Spacing.two },
  replyBox: { marginTop: Spacing.three, borderLeftWidth: 4, borderLeftColor: '#15803D', backgroundColor: '#DCFCE7', padding: Spacing.three },
  replyTitle: { color: '#14532D', fontSize: 13, fontWeight: '700' },
  replyText: { fontSize: 14, lineHeight: 21, marginTop: Spacing.two },
});
