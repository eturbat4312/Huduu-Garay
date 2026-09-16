import { router, useLocalSearchParams , useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, type ColorPalette } from '@/constants/theme';
import { fetchHostBookingDetail, hostCancelBooking } from '@/lib/api';
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

function InfoRow({ label, value, C }: { label: string; value: string; C: ColorPalette }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: C.text }]}>{value}</Text>
    </View>
  );
}

export default function HostBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    fetchHostBookingDetail(id)
      .then(setBooking)
      .catch(() => setError('Мэдээлэл татахад алдаа гарлаа.'))
      .finally(() => setLoading(false));
  }, [id]));

  const handleCancel = () => {
    Alert.alert(
      'Захиалга цуцлах',
      'Та энэ захиалгыг цуцлахдаа итгэлтэй байна уу? Энэ үйлдлийг буцаах боломжгүй.',
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Цуцлах',
          style: 'destructive',
          onPress: async () => {
            if (!booking) return;
            setCancelling(true);
            try {
              await hostCancelBooking(booking.id);
              setBooking((prev) => prev ? { ...prev, is_cancelled_by_host: true, status: 'cancelled' } : prev);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Цуцлахад алдаа гарлаа.';
              Alert.alert('Алдаа', msg);
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={[styles.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: C.text }]}>Захиалгын дэлгэрэнгүй</Text>
            <View style={{ width: 64 }} />
          </View>
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16A34A" />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (error || !booking) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={[styles.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: C.text }]}>Захиалгын дэлгэрэнгүй</Text>
            <View style={{ width: 64 }} />
          </View>
          <View style={styles.center}>
            <Text style={{ fontSize: 32 }}>⚠️</Text>
            <Text style={{ color: C.textSecondary, marginTop: Spacing.two }}>
              {error || 'Мэдээлэл олдсонгүй.'}
            </Text>
            <Pressable onPress={() => router.back()} style={[styles.outlineBtn, { borderColor: C.textSecondary, marginTop: Spacing.three }]}>
              <Text style={{ color: C.textSecondary, fontWeight: '600' }}>Буцах</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const statusInfo = STATUS_LABELS[booking.status] ?? { label: booking.status, color: '#6B7280' };
  const nights = Math.round(
    (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
  );
  const canCancel = booking.status === 'confirmed' && !booking.is_cancelled_by_host;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Гарчиг */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: C.text }]}>Захиалга #{booking.id}</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Статус badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>

          {/* Зар */}
          <View style={[styles.section, { backgroundColor: C.backgroundElement }]}>
            <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>🏠 Зар</Text>
            <Text style={[styles.listingTitle, { color: C.text }]}>{booking.listing.title}</Text>
            <Text style={[styles.listingLocation, { color: C.textSecondary }]}>
              📍 {booking.listing.location_city}, {booking.listing.location_district}
            </Text>
          </View>

          {/* Зочны мэдээлэл */}
          <View style={[styles.section, { backgroundColor: C.backgroundElement }]}>
            <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>👤 Зочны мэдээлэл</Text>
            <InfoRow label="Нэр"    value={booking.full_name}    C={C} />
            <InfoRow label="Утас"   value={booking.phone_number} C={C} />
            {booking.notes ? <InfoRow label="Тэмдэглэл" value={booking.notes} C={C} /> : null}
          </View>

          {/* Огноо ба үнэ */}
          <View style={[styles.section, { backgroundColor: C.backgroundElement }]}>
            <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>📅 Захиалгын мэдээлэл</Text>
            <InfoRow label="Ирэх огноо"   value={fmtDate(booking.check_in)}  C={C} />
            <InfoRow label="Гарах огноо"  value={fmtDate(booking.check_out)} C={C} />
            <InfoRow label="Хонох хоног"  value={`${nights} хоног`}          C={C} />
            <InfoRow label="Зочны тоо"    value={`${booking.guest_count} хүн`} C={C} />
            <View style={[styles.divider, { backgroundColor: C.backgroundSelected }]} />
            <InfoRow label="Нийт дүн"     value={`₮${Number(booking.total_price).toLocaleString()}`} C={C} />
            <InfoRow label="Шимтгэл (10%)" value={`₮${Number(booking.service_fee).toLocaleString()}`} C={C} />
            <View style={[styles.payoutRow]}>
              <Text style={[styles.payoutLabel, { color: C.textSecondary }]}>Таны авах мөнгө</Text>
              <Text style={[styles.payoutValue, { color: '#16A34A' }]}>
                ₮{(Number(booking.total_price) - Number(booking.service_fee)).toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Цуцлах */}
          {canCancel && (
            <Pressable
              onPress={handleCancel}
              disabled={cancelling}
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && { opacity: 0.75 },
                cancelling && { opacity: 0.5 },
              ]}
            >
              {cancelling
                ? <ActivityIndicator color="#DC2626" />
                : <Text style={styles.cancelBtnText}>Захиалга цуцлах</Text>
              }
            </Pressable>
          )}

          {booking.is_cancelled_by_host && (
            <View style={styles.cancelledNote}>
              <Text style={{ color: '#DC2626', fontSize: 13 }}>
                ⚠️ Та энэ захиалгыг цуцалсан бөгөөд тухайн огнооны боломж буцаан нэмэгдсэн.
              </Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  scroll: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.three },

  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  backBtn: { width: 64 },
  backText: { fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '700' },

  section: {
    borderRadius: 16, padding: Spacing.three, gap: Spacing.two,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  listingTitle: { fontSize: 17, fontWeight: '700' },
  listingLocation: { fontSize: 14 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: Spacing.two },

  divider: { height: 1, marginVertical: 4 },

  payoutRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 4,
  },
  payoutLabel: { fontSize: 15, fontWeight: '600' },
  payoutValue: { fontSize: 20, fontWeight: '800' },

  cancelBtn: {
    height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },

  cancelledNote: {
    borderRadius: 12, padding: Spacing.three,
    backgroundColor: '#FEF2F2',
  },

  outlineBtn: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: Spacing.four, paddingVertical: 10,
    alignItems: 'center',
  },
});
