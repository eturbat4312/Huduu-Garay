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
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchMyBookings, resolveMediaUrl } from '@/lib/api';
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

export default function BookingsScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    fetchMyBookings()
      .then(setBookings)
      .catch(() => setError('Мэдээлэл татахад алдаа гарлаа.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  // ── Нэвтрээгүй ──────────────────────────────────────────────────────────
  if (!authLoading && !isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, { paddingBottom: BottomTabInset }]}>
          <Text style={[styles.title, { color: C.text }]}>Захиалгууд</Text>
          <View style={[styles.emptyBox, { backgroundColor: C.backgroundElement }]}>
            <Text style={{ fontSize: 40 }}>🔒</Text>
            <Text style={[styles.emptyTitle, { color: C.text }]}>Нэвтрэх шаардлагатай</Text>
            <Text style={[styles.emptySub, { color: C.textSecondary }]}>
              Захиалгуудаа харахын тулд нэвтрэн орно уу.
            </Text>
            <Pressable
              onPress={() => router.push('/login')}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.btnText}>Нэвтрэх</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── Ачаалж байна ──────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, { paddingBottom: BottomTabInset }]}>
          <Text style={[styles.title, { color: C.text }]}>Захиалгууд</Text>
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16A34A" />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safe, { paddingBottom: BottomTabInset }]}>
        <Text style={[styles.title, { color: C.text }]}>Захиалгууд</Text>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : bookings.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.backgroundElement }]}>
            <Text style={{ fontSize: 40 }}>🗓</Text>
            <Text style={[styles.emptyTitle, { color: C.text }]}>Захиалга байхгүй байна</Text>
            <Text style={[styles.emptySub, { color: C.textSecondary }]}>
              Та одоогоор ямар нэгэн захиалга хийгээгүй байна.
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/' as never)}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.btnText}>Газрууд харах</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.three, paddingBottom: Spacing.four }}
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
                  {/* Зураг */}
                  <View style={styles.cardImageWrap}>
                    {thumbUrl ? (
                      <Image source={{ uri: thumbUrl }} style={styles.cardImage} />
                    ) : (
                      <View style={[styles.cardImage, styles.imagePlaceholder, { backgroundColor: C.backgroundSelected }]}>
                        <Text style={{ fontSize: 28 }}>🏠</Text>
                      </View>
                    )}
                    {/* Статус badge */}
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
                    <View style={styles.cardDateRow}>
                      <Text style={[styles.cardDate, { color: C.textSecondary }]}>
                        📅 {formatDate(item.check_in)} — {formatDate(item.check_out)}
                      </Text>
                    </View>
                    <View style={styles.cardPriceRow}>
                      <Text style={[styles.cardPrice, { color: C.text }]}>
                        ₮{Number(item.total_price).toLocaleString()}
                      </Text>
                      <Text style={[styles.cardPriceSub, { color: C.textSecondary }]}> нийт</Text>
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
  title: { fontSize: 28, fontWeight: '700', marginTop: Spacing.three, marginBottom: Spacing.three },
  errorText: { color: '#DC2626', fontSize: 14, textAlign: 'center', marginTop: Spacing.four },

  emptyBox: {
    borderRadius: 16, padding: Spacing.four,
    alignItems: 'center', gap: Spacing.two, marginTop: Spacing.four,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  btn: {
    marginTop: Spacing.two, height: 46, borderRadius: 12,
    paddingHorizontal: Spacing.four, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  card: { borderRadius: 16, overflow: 'hidden' },
  cardImageWrap: { position: 'relative' },
  cardImage: { width: '100%', height: 180 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  statusBadge: {
    position: 'absolute', top: Spacing.two, right: Spacing.two,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardBody: { padding: Spacing.three, gap: Spacing.one },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardLocation: { fontSize: 13 },
  cardDateRow: { marginTop: 2 },
  cardDate: { fontSize: 13 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  cardPrice: { fontSize: 18, fontWeight: '700' },
  cardPriceSub: { fontSize: 13 },
});
