import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { MonthCalendar } from '@/components/month-calendar';
import { Colors, Spacing } from '@/constants/theme';
import { fetchAvailability, fetchHostBookings, fetchMyListings, resolveMediaUrl } from '@/lib/api';
import type { ListingSummary } from '@/types/api';

export default function MyListingsScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [bookingByDate, setBookingByDate] = useState<Map<string, number>>(new Map());
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([fetchMyListings(), fetchHostBookings()])
      .then(async ([myListings, bookings]) => {
        if (!active) return;
        setListings(myListings);
        const availability = await Promise.all(
          myListings.map((listing) => fetchAvailability(listing.id)),
        );
        if (!active) return;
        setAvailableDates(new Set(availability.flat().map((day) => day.date)));

        const nextBooked = new Set<string>();
        const nextBookingByDate = new Map<string, number>();
        for (const booking of bookings) {
          if (booking.is_cancelled_by_host || booking.status !== 'confirmed') continue;
          const current = new Date(`${booking.check_in}T00:00:00`);
          const end = new Date(`${booking.check_out}T00:00:00`);
          while (current < end) {
            const date = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
            nextBooked.add(date);
            nextBookingByDate.set(date, booking.id);
            current.setDate(current.getDate() + 1);
          }
        }
        setBookedDates(nextBooked);
        setBookingByDate(nextBookingByDate);
      })
      .catch(() => {
        if (active) setError('Мэдээлэл татахад алдаа гарлаа.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []));

  const previousMonth = () => {
    if (calendarMonth === 0) {
      setCalendarYear((year) => year - 1);
      setCalendarMonth(11);
    } else {
      setCalendarMonth((month) => month - 1);
    }
  };

  const nextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarYear((year) => year + 1);
      setCalendarMonth(0);
    } else {
      setCalendarMonth((month) => month + 1);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>

        {/* Гарчиг мөр */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: C.textSecondary }]}>‹ Буцах</Text>
          </Pressable>
          <Text style={[styles.title, { color: C.text }]}>Миний зарууд</Text>
          <Pressable
            onPress={() => router.push('/create-listing' as never)}
            style={styles.addBtn}>
            <Text style={styles.addBtnText}>＋ Нэмэх</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16A34A" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : listings.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.backgroundElement }]}>
            <Text style={{ fontSize: 40 }}>🏡</Text>
            <Text style={[styles.emptyTitle, { color: C.text }]}>Зар байхгүй байна</Text>
            <Text style={[styles.emptySub, { color: C.textSecondary }]}>
              Та одоогоор зарласан орон сууц байхгүй байна.
            </Text>
          </View>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.three, paddingBottom: Spacing.five }}
            ListHeaderComponent={(
              <View style={[styles.calendarCard, { backgroundColor: C.backgroundElement }]}>
                <Text style={[styles.calendarTitle, { color: C.text }]}>📅 Нэгдсэн хуваарь</Text>
                <View style={styles.calendarLegend}>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} /><Text style={{ color: C.textSecondary, fontSize: 12 }}>Боломжтой</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#F87171' }]} /><Text style={{ color: C.textSecondary, fontSize: 12 }}>Захиалгатай</Text></View>
                </View>
                <View style={styles.calendarNavigation}>
                  <Pressable onPress={previousMonth} style={styles.calendarButton}><Text style={{ color: C.text, fontSize: 18 }}>‹</Text></Pressable>
                  <Text style={{ color: C.textSecondary, fontSize: 12 }}>Улаан өдрийг дарж захиалгыг нээнэ</Text>
                  <Pressable onPress={nextMonth} style={styles.calendarButton}><Text style={{ color: C.text, fontSize: 18 }}>›</Text></Pressable>
                </View>
                <MonthCalendar
                  year={calendarYear}
                  month={calendarMonth}
                  selected={availableDates}
                  bookedDates={bookedDates}
                  onPressDate={(date) => {
                    const bookingId = bookingByDate.get(date);
                    if (bookingId) router.push(`/host-bookings/${bookingId}` as never);
                  }}
                  textColor={C.text}
                />
              </View>
            )}
            renderItem={({ item }) => {
              const thumbUrl = resolveMediaUrl(item.thumbnail);
              const moderationLabels: Record<string, string> = {
                pending_review: 'Админ шалгаж байна',
                changes_requested: 'Засвар шаардлагатай',
                rejected: 'Татгалзсан',
                suspended: 'Түр хаасан',
              };
              const moderationLabel = moderationLabels[item.status];
              return (
                <Pressable
                  onPress={() => router.push(`/listing/${item.id}` as never)}
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: C.backgroundElement },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {thumbUrl ? (
                    <Image source={{ uri: thumbUrl }} style={styles.cardImage} />
                  ) : (
                    <View style={[styles.cardImage, styles.imagePlaceholder, { backgroundColor: C.backgroundSelected }]}>
                      <Text style={{ fontSize: 36 }}>🏠</Text>
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    {moderationLabel ? (
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>{moderationLabel}</Text>
                      </View>
                    ) : null}
                    <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.cardLocation, { color: C.textSecondary }]} numberOfLines={1}>
                      📍 {item.location_city}, {item.location_district}
                    </Text>
                    <View style={styles.cardFooter}>
                      <Text style={[styles.cardPrice, { color: C.text }]}>
                        ₮{Number(item.price_per_night).toLocaleString()}
                        <Text style={[styles.cardPriceSub, { color: C.textSecondary }]}> / шөнө</Text>
                      </Text>
                      {item.average_rating !== null && (
                        <Text style={[styles.rating, { color: C.textSecondary }]}>
                          ⭐ {item.average_rating.toFixed(1)}
                        </Text>
                      )}
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

  calendarCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  calendarTitle: { fontSize: 17, fontWeight: '700' },
  calendarLegend: { flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  calendarNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarButton: {
    width: 38, height: 34, borderRadius: 10, backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },

  card: { borderRadius: 16, overflow: 'hidden' },
  cardImage: { width: '100%', height: 180 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: Spacing.three, gap: Spacing.one },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  statusBadgeText: { color: '#78350F', fontSize: 12, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardLocation: { fontSize: 13 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardPrice: { fontSize: 16, fontWeight: '700' },
  cardPriceSub: { fontSize: 13, fontWeight: '400' },
  rating: { fontSize: 13 },
  addBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
