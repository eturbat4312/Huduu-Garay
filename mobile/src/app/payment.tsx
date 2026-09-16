/**
 * payment.tsx — QPay QR код харуулж, төлбөр батлагдахыг хүлээх дэлгэц
 *
 * Web-ийн PaymentContent.tsx-тай ижил логик:
 *   • GET /payments/:id/ — эхний мэдээлэл татах
 *   • POST /payments/:id/check/ — 5 секунд тутам polling
 *   • status === 'paid' → booking-success руу шилжих
 *   • Dev тест: "Төлбөр баталгаажуулах" товч (mock-confirm)
 */

import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { checkPayment, fetchPayment, mockConfirmPayment } from '@/lib/api';
import type { Payment } from '@/types/api';

const POLL_INTERVAL_MS = 5_000;

export default function PaymentScreen() {
  const { payment_id } = useLocalSearchParams<{ payment_id: string }>();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];

  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(Boolean(payment_id));
  const [error, setError] = useState(payment_id ? '' : 'Төлбөрийн дугаар олдсонгүй.');
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handlePaid = useCallback((p: Payment) => {
    stopPolling();
    setPayment(p);
    router.replace({
      pathname: '/booking-success',
      params: { booking_id: String(p.booking_id) },
    });
  }, []);

  const poll = useCallback(async () => {
    if (!payment_id) return;
    try {
      const p = await checkPayment(payment_id);
      setPayment(p);
      if (p.status === 'paid') handlePaid(p);
      else if (p.status !== 'pending') stopPolling(); // failed / expired / cancelled
    } catch {
      // Quiet fail — keep polling
    }
  }, [payment_id, handlePaid]);

  useEffect(() => {
    if (!payment_id) {
      return;
    }
    fetchPayment(payment_id)
      .then((p) => {
        setPayment(p);
        if (p.status === 'paid') {
          handlePaid(p);
        } else if (p.status === 'pending') {
          pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
        }
      })
      .catch(() => setError('Төлбөрийн мэдээлэл татахад алдаа гарлаа.'))
      .finally(() => setLoading(false));

    return () => stopPolling();
  }, [payment_id, poll, handlePaid]);

  const handleMockConfirm = async () => {
    if (!payment_id) return;
    setConfirming(true);
    try {
      const p = await mockConfirmPayment(payment_id);
      handlePaid(p);
    } catch (e: unknown) {
      const err = e as { message?: string };
      Alert.alert('Алдаа', err.message ?? 'Баталгаажуулахад алдаа гарлаа.');
    } finally {
      setConfirming(false);
    }
  };

  const handleCheckNow = async () => {
    if (!payment_id) return;
    setChecking(true);
    try {
      const nextPayment = await checkPayment(payment_id);
      setPayment(nextPayment);
      if (nextPayment.status === 'paid') handlePaid(nextPayment);
      else if (nextPayment.status !== 'pending') stopPolling();
    } catch (e: unknown) {
      const err = e as { message?: string };
      Alert.alert('Алдаа', err.message ?? 'Төлбөр шалгахад алдаа гарлаа.');
    } finally {
      setChecking(false);
    }
  };

  const openBankApp = async (link?: string) => {
    if (!link) return;
    try {
      await Linking.openURL(link);
    } catch {
      Alert.alert('Апп нээх боломжгүй', 'Сонгосон банкны апп суусан эсэхийг шалгана уу.');
    }
  };

  const qrImage = payment?.raw_response.qr_image
    ? payment.raw_response.qr_image.startsWith('data:image')
      ? payment.raw_response.qr_image
      : `data:image/png;base64,${payment.raw_response.qr_image}`
    : null;
  const bankUrls = payment?.raw_response.urls ?? [];
  const isMock = payment?.raw_response.mode === 'mock';

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: C.backgroundSelected }]}>
          <View style={{ width: 64 }} />
          <Text style={[styles.headerTitle, { color: C.text }]}>QPay Төлбөр</Text>
          <View style={{ width: 64 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16A34A" />
            <ThemedText themeColor="textSecondary" style={{ marginTop: 12 }}>
              Ачаалж байна...
            </ThemedText>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 40 }}>⚠️</Text>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 8 }}>
              {error}
            </ThemedText>
          </View>
        ) : payment ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Статус */}
            {payment.status === 'pending' ? (
              <View style={[styles.statusBox, { backgroundColor: '#FEF9C3' }]}>
                <Text style={[styles.statusTitle, { color: '#92400E' }]}>💳 Төлбөр хүлээгдэж байна</Text>
                <ThemedText themeColor="textSecondary" style={styles.statusSub}>
                  QPay апп нээж дараах мэдээллийг ашиглан төлбөрөө гүйцэтгэнэ үү.
                </ThemedText>
              </View>
            ) : payment.status === 'paid' ? (
              <View style={[styles.statusBox, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.statusTitle, { color: '#15803D' }]}>✅ Төлбөр амжилттай</Text>
              </View>
            ) : (
              <View style={[styles.statusBox, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.statusTitle, { color: '#991B1B' }]}>❌ Төлбөр амжилтгүй</Text>
                <ThemedText themeColor="textSecondary" style={styles.statusSub}>
                  Статус: {payment.status}
                </ThemedText>
              </View>
            )}

            {/* Дүн */}
            <View style={[styles.card, { backgroundColor: C.backgroundElement }]}>
              <ThemedText type="smallBold">Төлбөрийн мэдээлэл</ThemedText>
              <View style={styles.row}>
                <ThemedText themeColor="textSecondary">Нийт дүн</ThemedText>
                <Text style={[styles.amount, { color: C.text }]}>
                  ₮{Number(payment.amount).toLocaleString()}
                </Text>
              </View>
              <View style={styles.row}>
                <ThemedText themeColor="textSecondary">Invoice дугаар</ThemedText>
                <Text style={[styles.mono, { color: C.textSecondary }]} numberOfLines={1}>
                  {payment.sender_invoice_no || payment.invoice_id || `#${payment.id}`}
                </Text>
              </View>
            </View>

            {payment.status === 'pending' && (
              <View style={[styles.card, { backgroundColor: C.backgroundElement }]}>
                <ThemedText type="smallBold">QPay-аар төлөх</ThemedText>
                {qrImage ? (
                  <Image
                    source={{ uri: qrImage }}
                    style={styles.qrImage}
                    contentFit="contain"
                    accessibilityLabel="QPay төлбөрийн QR код"
                  />
                ) : (
                  <View style={[styles.qrPlaceholder, { borderColor: C.backgroundSelected }]}>
                    <ThemedText themeColor="textSecondary" type="small" style={styles.centerText}>
                      {isMock ? 'Local test invoice' : 'QR код ирээгүй байна.'}
                    </ThemedText>
                  </View>
                )}

                {bankUrls.length > 0 && (
                  <View style={styles.bankGrid}>
                    {bankUrls.map((item, index) => (
                      <Pressable
                        key={`${item.name ?? 'bank'}-${index}`}
                        onPress={() => openBankApp(item.link)}
                        disabled={!item.link}
                        style={({ pressed }) => [
                          styles.bankButton,
                          { borderColor: C.backgroundSelected },
                          (pressed || !item.link) && { opacity: 0.6 },
                        ]}>
                        <Text style={[styles.bankButtonText, { color: C.text }]}>
                          {item.description || item.name || 'Банкны апп'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {payment.raw_response.qr_text ? (
                  <Text
                    selectable
                    style={[styles.qrText, { color: C.textSecondary, borderColor: C.backgroundSelected }]}>
                    {payment.raw_response.qr_text}
                  </Text>
                ) : null}

                <Pressable
                  onPress={handleCheckNow}
                  disabled={checking}
                  style={({ pressed }) => [
                    styles.checkButton,
                    (pressed || checking) && { opacity: 0.7 },
                  ]}>
                  {checking
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.checkButtonText}>Төлбөр шалгах</Text>}
                </Pressable>
              </View>
            )}

            {/* Polling индикатор */}
            {payment.status === 'pending' && (
              <View style={styles.pollingRow}>
                <ActivityIndicator size="small" color="#16A34A" />
                <ThemedText themeColor="textSecondary" type="small" style={{ marginLeft: 8 }}>
                  Төлбөрийн байдлыг шалгаж байна...
                </ThemedText>
              </View>
            )}

            {/* Заавар */}
            {payment.status === 'pending' && (
              <View style={[styles.card, { backgroundColor: C.backgroundElement }]}>
                <ThemedText type="smallBold">QPay-ээр төлөх заавар</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  1. QPay апп-аа нээнэ үү.{'\n'}
                  2. “QR уншуулах” эсвэл “Invoice” сонгоно уу.{'\n'}
                  3. Invoice дугаарыг оруулна уу.{'\n'}
                  4. Дүнг баталгаажуулан төлнө үү.
                </ThemedText>
              </View>
            )}

            {/* Dev: Mock баталгаажуулах */}
            {payment.status === 'pending' && isMock && (
              <Pressable
                onPress={handleMockConfirm}
                disabled={confirming}
                style={[styles.mockBtn, { opacity: confirming ? 0.6 : 1 }]}>
                {confirming
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.mockBtnText}>🧪 Төлбөр баталгаажуулах (Test)</Text>}
              </Pressable>
            )}

            {/* Буцах */}
            {payment.status !== 'pending' && (
              <Pressable
                onPress={() => router.replace('/(tabs)/bookings' as never)}
                style={styles.backBtn}>
                <Text style={styles.backBtnText}>Захиалгууд руу буцах</Text>
              </Pressable>
            )}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  statusBox: { borderRadius: 16, padding: 20, gap: 8, alignItems: 'center' },
  statusTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  statusSub: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  qrImage: { width: 220, height: 220, alignSelf: 'center', borderRadius: 12 },
  qrPlaceholder: {
    width: 220, height: 220, alignSelf: 'center', borderWidth: 1,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: Spacing.three,
  },
  centerText: { textAlign: 'center' },
  bankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  bankButton: {
    minHeight: 44, minWidth: '47%', flexGrow: 1, borderWidth: 1,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: Spacing.two,
  },
  bankButtonText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  qrText: { borderWidth: 1, borderRadius: 10, padding: Spacing.two, fontSize: 11 },
  checkButton: {
    minHeight: 48, borderRadius: 12, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
  },
  checkButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 20, fontWeight: '800' },
  mono: { fontSize: 12, maxWidth: 160, textAlign: 'right' },
  pollingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  mockBtn: {
    backgroundColor: '#6B7280', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  mockBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backBtn: {
    backgroundColor: '#16A34A', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
