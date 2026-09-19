import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { CHECK_IN_TIME, CHECK_OUT_TIME } from '@/constants/booking-times';
import { fetchHostBookings, resolveMediaUrl } from '@/lib/api';
import type { BookingSummary } from '@/types/api';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Хүлээгдэж байна', color: '#D97706' },
  confirmed: { label: 'Баталгаажсан',    color: '#16A34A' },
  cancelled: { label: 'Цуцалсан',        color: '#DC2626' },
  completed: { label: 'Дууссан',         color: '#6B7280' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export default function HostBookingsScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHostBookings()
      .then(setBookings)
      .catch(() => setError('Мэдээлэл татахад алдаа гарлаа.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>

        {/* Гарчиг мөр */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
          </Pressable>
          <Text style={[styles.title, { color: C.text }]}>Хостын захиалгууд</Text>
          <View style={{ width: 64 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16A34A" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : bookings.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.backgroundElement }]}>
            <Text style={{ fontSize: 40 }}>📋</Text>
            <Text style={[styles.emptyTitle, { color: C.text }]}>Захиалга байхгүй байна</Text>
            <Text style={[styles.emptySub, { color: C.textSecondary }]}>
              Таны зарлуудад одоогоор захиалга ирээгүй байна.
            </Text>
          </View>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.three, paddingBottom: Spacing.five }}
            renderItem={({ item }) => {
              const thumbUrl = resolveMediaUrl(item.listing.thumbnail);
              const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, color: '#6B7280' };
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: C.backgroundElement },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {/* Зураг + статус */}
                  <View style={styles.imageWrap}>
                    {thumbUrl ? (
                      <Image source={{ uri: thumbUrl }} style={styles.cardImage} />
                    ) : (
                      <View style={[styles.cardImage, styles.imagePlaceholder, { backgroundColor: C.backgroundSelected }]}>
                        <Text style={{ fontSize: 32 }}>🏠</Text>
                      </View>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '22' }]}>
                      <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>

                  {/* Мэдээлэл */}
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={1}>
                      {item.listing.title}
                    </Text>
                    <Text style={[styles.cardLocation, { color: C.textSecondary }]} numberOfLines={1}>
                      📍 {item.listing.location_city}, {item.listing.location_district}
                    </Text>
                    <Text style={[styles.cardDate, { color: C.textSecondary }]}>
                      📅 {formatDate(item.check_in)} — {formatDate(item.check_out)}
                    </Text>
                    <Text style={[styles.cardDate, { color: C.textSecondary }]}>Орох {CHECK_IN_TIME} · Гарах {CHECK_OUT_TIME}</Text>
                    <View style={styles.cardFooter}>
                      <Text style={[styles.cardPrice, { color: C.text }]}>
                        ₮{Number(item.total_price).toLocaleString()}
                        <Text style={[styles.cardPriceSub, { color: C.textSecondary }]}> нийт</Text>
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: Spacing.three,
  },
  backBtn: { width: 64 },
  backText: { fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700' },

  errorText: { color: '#DC2626', fontSize: 14, textAlign: 'center', marginTop: Spacing.four },

  emptyBox: {
    borderRadius: 16, padding: Spacing.four,
    alignItems: 'center', gap: Spacing.two, marginTop: Spacing.four,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  card: { borderRadius: 16, overflow: 'hidden' },
  imageWrap: { position: 'relative' },
  cardImage: { width: '100%', height: 160 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  statusBadge: {
    position: 'absolute', top: Spacing.two, right: Spacing.two,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardBody: { padding: Spacing.three, gap: Spacing.one },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardLocation: { fontSize: 13 },
  cardDate: { fontSize: 13 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardPrice: { fontSize: 16, fontWeight: '700' },
  cardPriceSub: { fontSize: 13, fontWeight: '400' },
});
