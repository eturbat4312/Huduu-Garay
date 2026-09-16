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
import { deleteFavorite, fetchFavorites, resolveMediaUrl } from '@/lib/api';
import type { FavoriteListItem } from '@/types/api';

export default function FavoritesScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchFavorites()
      .then(setFavorites)
      .catch(() => setError('Мэдээлэл татахад алдаа гарлаа.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function handleRemove(favoriteId: number) {
    setRemoving(favoriteId);
    try {
      await deleteFavorite(favoriteId);
      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
    } catch {
      // алдаа гарсан ч UI өөрчлөхгүй
    } finally {
      setRemoving(null);
    }
  }

  // ── Нэвтрээгүй ──────────────────────────────────────────────────────────
  if (!authLoading && !isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, { paddingBottom: BottomTabInset }]}>
          <Text style={[styles.title, { color: C.text }]}>Хадгалсан</Text>
          <View style={[styles.emptyBox, { backgroundColor: C.backgroundElement }]}>
            <Text style={{ fontSize: 40 }}>🔒</Text>
            <Text style={[styles.emptyTitle, { color: C.text }]}>Нэвтрэх шаардлагатай</Text>
            <Text style={[styles.emptySub, { color: C.textSecondary }]}>
              Дуртай газруудаа харахын тулд нэвтрэн орно уу.
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

  if (authLoading || loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safe, { paddingBottom: BottomTabInset }]}>
          <Text style={[styles.title, { color: C.text }]}>Хадгалсан</Text>
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
        <Text style={[styles.title, { color: C.text }]}>Хадгалсан</Text>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : favorites.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.backgroundElement }]}>
            <Text style={{ fontSize: 40 }}>❤️</Text>
            <Text style={[styles.emptyTitle, { color: C.text }]}>Хадгалсан газар байхгүй</Text>
            <Text style={[styles.emptySub, { color: C.textSecondary }]}>
              Газрууд харахдаа ❤️ дарж хадгалаарай.
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
            data={favorites}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.three, paddingBottom: Spacing.four }}
            renderItem={({ item }) => {
              const listing = item.listing;
              const thumbUrl = resolveMediaUrl(listing.thumbnail);
              const isRemoving = removing === item.id;
              return (
                <Pressable
                  onPress={() => router.push(`/listing/${listing.id}` as never)}
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: C.backgroundElement },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {/* Зураг */}
                  <View style={styles.imageWrap}>
                    {thumbUrl ? (
                      <Image source={{ uri: thumbUrl }} style={styles.cardImage} />
                    ) : (
                      <View style={[styles.cardImage, styles.imagePlaceholder, { backgroundColor: C.backgroundSelected }]}>
                        <Text style={{ fontSize: 32 }}>🏠</Text>
                      </View>
                    )}
                    {/* Хасах товч */}
                    <Pressable
                      onPress={() => handleRemove(item.id)}
                      style={({ pressed }) => [styles.removeBtnWrap, pressed && { opacity: 0.7 }]}
                    >
                      {isRemoving ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                      ) : (
                        <Text style={styles.removeIcon}>❤️</Text>
                      )}
                    </Pressable>
                  </View>

                  {/* Мэдээлэл */}
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={1}>
                      {listing.title}
                    </Text>
                    <Text style={[styles.cardLocation, { color: C.textSecondary }]} numberOfLines={1}>
                      📍 {listing.location_city}, {listing.location_district}
                    </Text>
                    <View style={styles.cardPriceRow}>
                      <Text style={[styles.cardPrice, { color: C.text }]}>
                        ₮{Number(listing.price_per_night).toLocaleString()}
                      </Text>
                      <Text style={[styles.cardPriceSub, { color: C.textSecondary }]}> / шөнө</Text>
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
  imageWrap: { position: 'relative' },
  cardImage: { width: '100%', height: 180 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  removeBtnWrap: {
    position: 'absolute', top: Spacing.two, right: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  removeIcon: { fontSize: 18 },
  cardBody: { padding: Spacing.three, gap: Spacing.one },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardLocation: { fontSize: 13 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  cardPrice: { fontSize: 18, fontWeight: '700' },
  cardPriceSub: { fontSize: 13 },
});
