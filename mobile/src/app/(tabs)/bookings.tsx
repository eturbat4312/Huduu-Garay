import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchHostBookings, fetchMyBookings, resolveMediaUrl } from '@/lib/api';
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

// ─── Booking card (хоёр tab-д нийтлэг) ─────────────────────────────────────
function BookingCard({
  item,
  onPress,
  C,
}: {
  item: BookingSummary;
  onPress: () => void;
  C: (typeof Colors)['light'];
}) {
  const thumbUrl = resolveMediaUrl(item.listing.thumbnail);
  const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, color: '#6B7280' };
  return (
    <Pressable
      onPress={onPress}
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
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '22' }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
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
        <View style={styles.cardPriceRow}>
          <Text style={[styles.cardPrice, { color: C.text }]}>
            ₮{Number(item.total_price).toLocaleString()}
          </Text>
          <Text style={[styles.cardPriceSub, { color: C.textSecondary }]}> нийт</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ isHost, C }: { isHost: boolean; C: (typeof Colors)['light'] }) {
  return (
    <View style={[styles.emptyBox, { backgroundColor: C.backgroundElement }]}>
      <Text style={{ fontSize: 40 }}>{isHost ? '📋' : '🗓'}</Text>
      <Text style={[styles.emptyTitle, { color: C.text }]}>Захиалга байхгүй байна</Text>
      <Text style={[styles.emptySub, { color: C.textSecondary }]}>
        {isHost
          ? 'Таны зарлуудад одоогоор захиалга ирээгүй байна.'
          : 'Та одоогоор ямар нэгэн захиалга хийгээгүй байна.'}
      </Text>
      {!isHost && (
        <Pressable
          onPress={() => router.push('/(tabs)/' as never)}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.btnText}>Газрууд харах</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function BookingsScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isHost = user?.is_host ?? false;

  // 0 = Миний захиалга, 1 = Надад ирсэн
  const [activeTab, setActiveTab] = useState(0);

  const [myBookings, setMyBookings]     = useState<BookingSummary[]>([]);
  const [hostBookings, setHostBookings] = useState<BookingSummary[]>([]);
  const [myLoading, setMyLoading]       = useState(false);
  const [hostLoading, setHostLoading]   = useState(false);
  const [myError, setMyError]           = useState('');
  const [hostError, setHostError]       = useState('');
  const [myRefreshing, setMyRefreshing] = useState(false);
  const [hostRefreshing, setHostRefreshing] = useState(false);

  const loadMy = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated) return;
    if (isRefresh) setMyRefreshing(true); else setMyLoading(true);
    setMyError('');
    try {
      const data = await fetchMyBookings();
      setMyBookings(data);
    } catch {
      setMyError('Мэдээлэл татахад алдаа гарлаа.');
    } finally {
      setMyLoading(false);
      setMyRefreshing(false);
    }
  }, [isAuthenticated]);

  const loadHost = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated || !isHost) return;
    if (isRefresh) setHostRefreshing(true); else setHostLoading(true);
    setHostError('');
    try {
      const data = await fetchHostBookings();
      setHostBookings(data);
    } catch {
      setHostError('Мэдээлэл татахад алдаа гарлаа.');
    } finally {
      setHostLoading(false);
      setHostRefreshing(false);
    }
  }, [isAuthenticated, isHost]);

  // Tab-д focus орох бүрт хоёуланг нь refresh
  useFocusEffect(useCallback(() => {
    loadMy();
    if (isHost) loadHost();
  }, [loadMy, loadHost, isHost]));

  // ── Нэвтрээгүй ──────────────────────────────────────────────────────────
  if (!authLoading && !isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, { paddingBottom: BottomTabInset }]}>
          <Text style={[styles.pageTitle, { color: C.text }]}>Захиалгууд</Text>
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

  if (authLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, { paddingBottom: BottomTabInset }]}>
          <Text style={[styles.pageTitle, { color: C.text }]}>Захиалгууд</Text>
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16A34A" />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const currentLoading   = activeTab === 0 ? myLoading   : hostLoading;
  const currentRefreshing = activeTab === 0 ? myRefreshing : hostRefreshing;
  const currentError     = activeTab === 0 ? myError     : hostError;
  const currentData      = activeTab === 0 ? myBookings  : hostBookings;
  const onRefresh        = activeTab === 0 ? () => loadMy(true) : () => loadHost(true);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safe, { paddingBottom: BottomTabInset }]}>
        <Text style={[styles.pageTitle, { color: C.text }]}>Захиалгууд</Text>

        {/* Segment switcher — зөвхөн host байвал харуулна */}
        {isHost && (
          <View style={[styles.segmentWrap, { backgroundColor: C.backgroundElement }]}>
            <Pressable
              style={[styles.segmentBtn, activeTab === 0 && styles.segmentActive]}
              onPress={() => setActiveTab(0)}
            >
              <Text style={[styles.segmentText, activeTab === 0 && styles.segmentTextActive]}>
                Миний захиалга
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentBtn, activeTab === 1 && styles.segmentActive]}
              onPress={() => setActiveTab(1)}
            >
              <Text style={[styles.segmentText, activeTab === 1 && styles.segmentTextActive]}>
                Надад ирсэн
              </Text>
            </Pressable>
          </View>
        )}

        {currentLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16A34A" />
          </View>
        ) : currentError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{currentError}</Text>
            <Pressable onPress={onRefresh} style={[styles.btn, { marginTop: Spacing.two }]}>
              <Text style={styles.btnText}>Дахин оролдох</Text>
            </Pressable>
          </View>
        ) : currentData.length === 0 ? (
          <EmptyState isHost={activeTab === 1} C={C} />
        ) : (
          <FlatList
            data={currentData}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.three, paddingBottom: Spacing.four }}
            refreshControl={
              <RefreshControl
                refreshing={currentRefreshing}
                onRefresh={onRefresh}
                tintColor="#16A34A"
              />
            }
            renderItem={({ item }) => (
              <BookingCard
                item={item}
                C={C}
                onPress={() => {
                  if (activeTab === 0) {
                    router.push(`/booking/${item.id}` as never);
                  } else {
                    router.push(`/host-bookings/${item.id}` as never);
                  }
                }}
              />
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },

  pageTitle: {
    fontSize: 28, fontWeight: '700',
    marginTop: Spacing.three, marginBottom: Spacing.three,
  },

  // ── Segment ─────────────────────────────────────────────────
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: Spacing.three,
  },
  segmentBtn: {
    flex: 1, paddingVertical: 9,
    borderRadius: 10, alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#16A34A',
  },
  segmentText: {
    fontSize: 14, fontWeight: '600', color: '#6B7280',
  },
  segmentTextActive: {
    color: '#fff',
  },

  errorText: { color: '#DC2626', fontSize: 14, textAlign: 'center' },

  emptyBox: {
    borderRadius: 16, padding: Spacing.four,
    alignItems: 'center', gap: Spacing.two, marginTop: Spacing.four,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  btn: {
    height: 46, borderRadius: 12,
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
  cardDate: { fontSize: 13 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  cardPrice: { fontSize: 18, fontWeight: '700' },
  cardPriceSub: { fontSize: 13 },
});
