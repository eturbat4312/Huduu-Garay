import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { fetchBooking } from '@/lib/api';
import type { BookingDetail } from '@/types/api';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Хүлээгдэж байна', color: '#D97706' },
  confirmed: { label: 'Баталгаажсан',    color: '#16A34A' },
  cancelled: { label: 'Цуцалсан',        color: '#DC2626' },
  completed: { label: 'Дууссан',         color: '#6B7280' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const C = Colors[scheme];
  return (
    <View style={styles.row}>
      <ThemedText themeColor="textSecondary" type="small" style={styles.rowLabel}>{label}</ThemedText>
      <Text style={[styles.rowValue, { color: valueColor ?? C.text }]}>{value}</Text>
    </View>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchBooking(id)
      .then(setBooking)
      .catch(() => setError('Мэдээлэл татахад алдаа гарлаа.'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: C.backgroundSelected }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: C.text }]}>Захиалгын дэлгэрэнгүй</Text>
          <View style={{ width: 64 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16A34A" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">{error}</ThemedText>
          </View>
        ) : booking ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Статус */}
            {(() => {
              const s = STATUS_LABELS[booking.status] ?? { label: booking.status, color: '#6B7280' };
              return (
                <View style={[styles.statusBox, { backgroundColor: s.color + '18' }]}>
                  <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                </View>
              );
            })()}

            {/* Зарын мэдээлэл */}
            <View style={[styles.card, { backgroundColor: C.backgroundElement }]}>
              <ThemedText type="smallBold" style={styles.cardTitle}>🏠 Зар</ThemedText>
              <Text style={[styles.listingTitle, { color: C.text }]}>{booking.listing.title}</Text>
              <ThemedText themeColor="textSecondary" type="small">
                📍 {booking.listing.location_city}, {booking.listing.location_district}
              </ThemedText>
              <Pressable
                onPress={() => router.push(`/listing/${booking.listing.id}` as never)}
                style={styles.viewListingBtn}>
                <Text style={styles.viewListingText}>Зарыг харах →</Text>
              </Pressable>
            </View>

            {/* Огноо / үнэ */}
            <View style={[styles.card, { backgroundColor: C.backgroundElement }]}>
              <ThemedText type="smallBold" style={styles.cardTitle}>📅 Захиалгын мэдээлэл</ThemedText>
              <Row label="Ирэх огноо"  value={fmtDate(booking.check_in)} />
              <Row label="Гарах огноо" value={fmtDate(booking.check_out)} />
              <Row label="Зочдын тоо"  value={String(booking.guest_count)} />
              <View style={[styles.divider, { backgroundColor: C.backgroundSelected }]} />
              <Row label="Өрөөний үнэ" value={`₮${Number(booking.total_price).toLocaleString()}`} />
              <Row label="Үйлчилгээний хураамж (10%)" value={`₮${Number(booking.service_fee).toLocaleString()}`} />
              <Row
                label="Нийт төлбөр"
                value={`₮${(Number(booking.total_price) + Number(booking.service_fee)).toLocaleString()}`}
                valueColor="#16A34A"
              />
            </View>

            {/* Зочны мэдээлэл */}
            <View style={[styles.card, { backgroundColor: C.backgroundElement }]}>
              <ThemedText type="smallBold" style={styles.cardTitle}>👤 Зочны мэдээлэл</ThemedText>
              <Row label="Нэр"    value={booking.full_name} />
              <Row label="Утас"   value={booking.phone_number} />
              {booking.notes ? <Row label="Тэмдэглэл" value={booking.notes} /> : null}
            </View>

            {booking.is_cancelled_by_host && (
              <View style={[styles.cancelNotice, { backgroundColor: '#FEE2E2' }]}>
                <Text style={{ color: '#DC2626', fontSize: 14, fontWeight: '600' }}>
                  ⚠️ Энэ захиалгыг хост цуцалсан байна.
                </Text>
              </View>
            )}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { minWidth: 64 },
  backText: { fontSize: 16 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  statusBox: {
    borderRadius: 10, padding: 12, alignItems: 'center',
  },
  statusText: { fontSize: 16, fontWeight: '700' },
  card: {
    borderRadius: 16, padding: Spacing.three, gap: Spacing.two,
  },
  cardTitle: { marginBottom: 4 },
  listingTitle: { fontSize: 17, fontWeight: '700' },
  viewListingBtn: { marginTop: 4 },
  viewListingText: { color: '#16A34A', fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  rowLabel: { flex: 1 },
  rowValue: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  cancelNotice: { borderRadius: 12, padding: 14 },
});
