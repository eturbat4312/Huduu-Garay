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
import { fetchMyListings, resolveMediaUrl } from '@/lib/api';
import type { ListingSummary } from '@/types/api';

export default function MyListingsScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyListings()
      .then(setListings)
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
