import { useEffect, useState } from 'react';
import type { Href } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapView, { Callout, Marker, UrlTile } from 'react-native-maps';

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import {
  createFavorite,
  deleteFavorite,
  fetchCategories,
  fetchListings,
  resolveMediaUrl,
} from '@/lib/api';
import type { ListingCategory, ListingFilters, ListingSummary } from '@/types/api';

// Монгол улсын төв координат
const INITIAL_REGION = {
  latitude: 47.918,
  longitude: 106.917,
  latitudeDelta: 0.4,
  longitudeDelta: 0.4,
};

const emptyFilters: ListingFilters = {
  category: '',
  search: '',
  location: '',
  priceMin: null,
  priceMax: null,
  amenities: [],
};

export default function ExploreScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const isDark = scheme === 'dark';

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  const [filters, setFilters] = useState<ListingFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<ListingFilters>(emptyFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchListings(appliedFilters)
      .then((data) => {
        if (isMounted) { setListings(data); setError(null); }
      })
      .catch((err: unknown) => {
        if (isMounted) setError(err instanceof Error ? err.message : 'Алдаа гарлаа');
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [appliedFilters]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const applyCategory = (category: string) => {
    const next = { ...filters, category };
    setFilters(next);
    setAppliedFilters(next);
  };

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    setSearchExpanded(false);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setSearchExpanded(false);
  };

  const hasActiveFilters =
    !!filters.search || !!filters.location ||
    filters.priceMin !== null || filters.priceMax !== null;

  const mappableListings = listings.filter(
    (l) => l.location_lat != null && l.location_lng != null,
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        style={[
          styles.safe,
          { paddingBottom: viewMode === 'map' ? 0 : BottomTabInset },
        ]}>

        {/* ── Backdrop ── */}
        {searchExpanded && (
          <Pressable style={styles.backdrop} onPress={() => setSearchExpanded(false)} />
        )}

        {/* ── Хайлтын pill ── */}
        <Pressable
          onPress={() => setSearchExpanded((v) => !v)}
          style={[
            styles.searchPill,
            { backgroundColor: C.backgroundElement, borderColor: isDark ? C.backgroundSelected : '#E0E1E6' },
          ]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <View style={styles.searchPillText}>
            <Text style={[styles.searchPillLabel, { color: C.text }]} numberOfLines={1}>
              {hasActiveFilters
                ? [filters.search, filters.location].filter(Boolean).join(' · ') || 'Шүүлттэй'
                : 'Хаана хоноё?'}
            </Text>
            <Text style={[styles.searchPillSub, { color: C.textSecondary }]}>
              Байршил · Үнэ · Ангилал
            </Text>
          </View>
          {hasActiveFilters && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); clearFilters(); }}
              hitSlop={8}
              style={styles.clearPill}>
              <Text style={{ color: C.textSecondary, fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
        </Pressable>

        {/* ── Нэмэлт шүүлт ── */}
        {searchExpanded && (
          <View
            style={[
              styles.expandedFilters,
              { backgroundColor: C.backgroundElement, borderColor: isDark ? C.backgroundSelected : '#E0E1E6' },
            ]}>
            <TextInput
              value={filters.search}
              onChangeText={(s) => setFilters((f) => ({ ...f, search: s }))}
              placeholder="Гарчиг хайх..."
              placeholderTextColor={C.textSecondary}
              style={[styles.filterInput, { color: C.text, borderColor: isDark ? C.backgroundSelected : '#E0E1E6' }]}
            />
            <TextInput
              value={filters.location}
              onChangeText={(s) => setFilters((f) => ({ ...f, location: s }))}
              placeholder="Аймаг, Хот (жишээ: Архангай)"
              placeholderTextColor={C.textSecondary}
              style={[styles.filterInput, { color: C.text, borderColor: isDark ? C.backgroundSelected : '#E0E1E6' }]}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <TextInput
                value={filters.priceMin?.toString() ?? ''}
                onChangeText={(v) => setFilters((f) => ({ ...f, priceMin: v ? Number(v) : null }))}
                keyboardType="numeric"
                placeholder="Мин ₮"
                placeholderTextColor={C.textSecondary}
                style={[styles.filterInput, { flex: 1, color: C.text, borderColor: isDark ? C.backgroundSelected : '#E0E1E6' }]}
              />
              <TextInput
                value={filters.priceMax?.toString() ?? ''}
                onChangeText={(v) => setFilters((f) => ({ ...f, priceMax: v ? Number(v) : null }))}
                keyboardType="numeric"
                placeholder="Макс ₮"
                placeholderTextColor={C.textSecondary}
                style={[styles.filterInput, { flex: 1, color: C.text, borderColor: isDark ? C.backgroundSelected : '#E0E1E6' }]}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable onPress={clearFilters}>
                <Text style={{ color: C.textSecondary, fontSize: 14, textDecorationLine: 'underline' }}>
                  Цэвэрлэх
                </Text>
              </Pressable>
              <Pressable onPress={applyFilters} style={styles.applyBtn}>
                <Text style={styles.applyBtnText}>🔍 Хайх</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Ангилал + List/Map toggle ── */}
        <View style={styles.toolbar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={styles.catRow}>
            <CategoryPill label="Бүгд" active={!filters.category} onPress={() => applyCategory('')} />
            {categories.map((cat) => (
              <CategoryPill
                key={cat.id}
                label={cat.name}
                icon={cat.icon ?? undefined}
                active={filters.category === cat.name}
                onPress={() => applyCategory(cat.name)}
              />
            ))}
          </ScrollView>

          <View style={[styles.viewToggle, { backgroundColor: C.backgroundElement, borderColor: isDark ? C.backgroundSelected : '#E0E1E6' }]}>
            <Pressable
              onPress={() => setViewMode('list')}
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}>
              <Text style={[styles.toggleIcon, viewMode === 'list' && styles.toggleIconActive]}>
                ☰
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('map')}
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}>
              <Text style={[styles.toggleIcon, viewMode === 'map' && styles.toggleIconActive]}>
                🗺
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Агуулга ── */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16A34A" />
            <Text style={{ color: C.textSecondary, marginTop: 8 }}>Ачааллаж байна...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 32 }}>🔌</Text>
            <Text style={{ color: C.text, fontWeight: '600' }}>Холболт шалгана уу</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13 }}>{error}</Text>
          </View>
        ) : viewMode === 'map' ? (
          /* ── MAP MODE ── */
          <View style={styles.mapWrapper}>
            <MapView
              mapType="none"
              style={styles.map}
              initialRegion={INITIAL_REGION}>
              <UrlTile
                urlTemplate={`https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`}
                maximumZ={19}
                flipY={false}
                tileSize={256}
                zIndex={0}
              />
              {mappableListings.map((item) => {
                const price = Number(item.price_per_night ?? 0);
                const priceLabel =
                  price >= 1_000_000
                    ? `₮${(price / 1_000_000).toFixed(1)}M`
                    : price >= 1_000
                    ? `₮${Math.round(price / 1_000)}K`
                    : `₮${price}`;
                return (
                  <Marker
                    key={item.id}
                    coordinate={{
                      latitude: item.location_lat!,
                      longitude: item.location_lng!,
                    }}
                    tracksViewChanges={false}>
                    {/* Үнийн badge */}
                    <View style={styles.priceBadge}>
                      <Text style={styles.priceBadgeText}>{priceLabel}</Text>
                    </View>

                    <Callout
                      onPress={() =>
                        router.push({
                          pathname: '/listing/[id]',
                          params: { id: String(item.id) },
                        } as unknown as Href)
                      }
                      tooltip={false}>
                      <View style={styles.callout}>
                        <Text style={styles.calloutTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={styles.calloutLocation} numberOfLines={1}>
                          {[item.location_city, item.location_district]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                        <Text style={styles.calloutPrice}>
                          ₮{price.toLocaleString('mn-MN')} / хоног
                        </Text>
                        <Text style={styles.calloutTap}>Дэлгэрэнгүй харах →</Text>
                      </View>
                    </Callout>
                  </Marker>
                );
              })}
            </MapView>

            {/* Координатгүй зар байгаа бол анхааруулга */}
            {mappableListings.length === 0 && !isLoading && (
              <View style={styles.mapEmptyOverlay}>
                <Text style={styles.mapEmptyText}>
                  📍 Газрын зургийн байршилтай зар байхгүй байна
                </Text>
              </View>
            )}

            {/* Зарын тоо */}
            {mappableListings.length > 0 && (
              <View style={styles.mapCountBadge}>
                <Text style={styles.mapCountText}>
                  {mappableListings.length} зар харагдаж байна
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* ── LIST MODE ── */
          listings.length === 0 ? (
            <View style={styles.center}>
              <Text style={{ fontSize: 40 }}>🏡</Text>
              <Text style={{ color: C.text, fontWeight: '600' }}>Зар олдсонгүй</Text>
              <Text style={{ color: C.textSecondary, fontSize: 13 }}>
                Шүүлтийг өөрчилж дахин хайна уу.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}>
              {listings.map((item) => (
                <ExploreCard
                  key={item.id}
                  item={item}
                  onChange={(next) =>
                    setListings((cur) => cur.map((l) => (l.id === next.id ? next : l)))
                  }
                />
              ))}
            </ScrollView>
          )
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── CategoryPill ─────────────────────────────────────────────────────────────

function CategoryPill({
  label, icon, active, onPress,
}: {
  label: string; icon?: string; active: boolean; onPress: () => void;
}) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 2,
        borderBottomColor: active ? '#16A34A' : 'transparent',
      }}>
      {icon ? <Text style={{ fontSize: 18, marginBottom: 2 }}>{icon}</Text> : null}
      <Text style={{ fontSize: 12, fontWeight: active ? '700' : '500', color: active ? C.text : C.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── ExploreCard (бүтэн өргөнтэй карт) ──────────────────────────────────────

function ExploreCard({
  item, onChange,
}: {
  item: ListingSummary; onChange: (l: ListingSummary) => void;
}) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const [busy, setBusy] = useState(false);
  const price = Number(item.price_per_night ?? 0);
  const thumbnailUrl = resolveMediaUrl(item.thumbnail);
  const location = [item.location_city, item.location_district]
    .filter(Boolean).join(', ') || 'Байршил байхгүй';

  const toggleFavorite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (item.is_favorited && item.favorite_id) {
        await deleteFavorite(item.favorite_id);
        onChange({ ...item, is_favorited: false, favorite_id: null });
      } else {
        const fav = await createFavorite(item.id);
        onChange({ ...item, is_favorited: true, favorite_id: fav.id });
      }
    } catch { onChange(item); }
    finally { setBusy(false); }
  };

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/listing/[id]',
          params: { id: String(item.id) },
        } as unknown as Href)
      }
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardImageWrapper}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={{ fontSize: 40 }}>🏡</Text>
          </View>
        )}
        <Pressable
          onPress={(e) => { e.stopPropagation(); toggleFavorite(); }}
          disabled={busy}
          style={[styles.heartBtn, busy && { opacity: 0.5 }]}
          accessibilityRole="button">
          <Text style={{ fontSize: 20, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
            {item.is_favorited ? '❤️' : '🤍'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.cardLocation, { color: C.textSecondary }]} numberOfLines={1}>
          {location}
        </Text>
        {item.average_rating != null && (
          <Text style={[styles.cardRating, { color: C.textSecondary }]}>
            ★ {item.average_rating}
          </Text>
        )}
        <Text style={[styles.cardPrice, { color: C.text }]}>
          ₮{price.toLocaleString('mn-MN')}
          <Text style={{ fontWeight: '400', color: C.textSecondary }}> / хоног</Text>
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: Spacing.three },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 },

  // Search pill
  searchPill: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 40,
    paddingHorizontal: Spacing.three, paddingVertical: 12,
    marginTop: Spacing.two, marginBottom: Spacing.two,
    zIndex: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    gap: Spacing.two,
  },
  searchIcon: { fontSize: 18 },
  searchPillText: { flex: 1, gap: 2 },
  searchPillLabel: { fontSize: 15, fontWeight: '600' },
  searchPillSub: { fontSize: 12 },
  clearPill: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },

  // Expanded filters
  expandedFilters: {
    borderWidth: 1, borderRadius: 16,
    padding: Spacing.three, marginBottom: Spacing.two,
    gap: Spacing.two, zIndex: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  filterInput: {
    height: 44, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: Spacing.three, fontSize: 15,
  },
  applyBtn: {
    backgroundColor: '#16A34A', borderRadius: 10,
    paddingHorizontal: Spacing.four, paddingVertical: 10,
  },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Toolbar (ангилал + toggle)
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: Spacing.two, gap: Spacing.two,
  },
  catRow: { gap: Spacing.one, paddingBottom: 2 },
  viewToggle: {
    flexDirection: 'row', borderRadius: 10,
    borderWidth: 1, overflow: 'hidden',
  },
  toggleBtn: {
    paddingHorizontal: 10, paddingVertical: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBtnActive: { backgroundColor: '#16A34A' },
  toggleIcon: { fontSize: 15, color: '#6B7280' },
  toggleIconActive: { color: '#fff' },

  // Center placeholder
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },

  // Map
  mapWrapper: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  map: { flex: 1 },
  priceBadge: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  priceBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  callout: { width: 220, padding: 10, gap: 3 },
  calloutTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  calloutLocation: { fontSize: 12, color: '#6B7280' },
  calloutPrice: { fontSize: 13, fontWeight: '600', color: '#16A34A', marginTop: 2 },
  calloutTap: { fontSize: 12, color: '#16A34A', marginTop: 4, textDecorationLine: 'underline' },
  mapEmptyOverlay: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  mapEmptyText: { color: '#374151', fontSize: 13, textAlign: 'center' },
  mapCountBadge: {
    position: 'absolute', top: 12, alignSelf: 'center',
    backgroundColor: 'rgba(22,163,74,0.9)', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  mapCountText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // List card
  listContent: { gap: Spacing.three, paddingBottom: Spacing.five },
  card: { borderRadius: 14, overflow: 'hidden' },
  pressed: { opacity: 0.88 },
  cardImageWrapper: { position: 'relative' },
  cardImage: { width: '100%', height: 220, backgroundColor: '#DDE7DF' },
  cardImagePlaceholder: {
    width: '100%', height: 220, backgroundColor: '#DDE7DF',
    alignItems: 'center', justifyContent: 'center',
  },
  heartBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { paddingTop: 10, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardLocation: { fontSize: 14 },
  cardRating: { fontSize: 13 },
  cardPrice: { fontSize: 15, fontWeight: '700', marginTop: 2 },
});
