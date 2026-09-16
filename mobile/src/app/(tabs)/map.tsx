/**
 * Map tab — Бүх зарыг газрын зураг дээр харуулах
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Href } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapView, { Callout, Marker, UrlTile } from 'react-native-maps';
import type { Region } from 'react-native-maps';

import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { fetchListings } from '@/lib/api';
import type { ListingFilters, ListingSummary } from '@/types/api';

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

// Улаанбаатар хот — анхны харагдах байршил
const UB_REGION: Region = {
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

export default function MapScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const C = Colors[scheme];
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();

  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const mapRef = useRef<MapView>(null);

  const filters: ListingFilters = { ...emptyFilters, search: appliedSearch };

  useEffect(() => {
    let isMounted = true;
    fetchListings(filters)
      .then((data) => {
        if (isMounted) { setListings(data); setError(null); }
      })
      .catch((err: unknown) => {
        if (isMounted) setError(err instanceof Error ? err.message : 'Алдаа гарлаа');
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch]);

  const mappableListings = useMemo(
    () => listings.filter((l) => l.location_lat != null && l.location_lng != null),
    [listings],
  );

  // Зарууд ачаалагдсаны дараа тэдгээрт тохируулан zoom хийх
  useEffect(() => {
    if (mappableListings.length === 0) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        mappableListings.map((l) => ({
          latitude: l.location_lat!,
          longitude: l.location_lng!,
        })),
        {
          edgePadding: { top: 100, right: 60, bottom: 80, left: 60 },
          animated: true,
        },
      );
    }, 500); // map render хүлээх
    return () => clearTimeout(timer);
  }, [mappableListings]);

  const handleSearch = () => {
    setIsLoading(true);
    setAppliedSearch(searchText.trim());
  };
  const handleClear = () => {
    setIsLoading(true);
    setSearchText('');
    setAppliedSearch('');
  };

  return (
    <ThemedView style={styles.container}>
      {/* ── Full-screen Map (flex:1 — tiles ачааллагдана) ── */}
      <MapView
        ref={mapRef}
        mapType="none"
        style={styles.map}
        initialRegion={UB_REGION}>
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
          const isSelected = item.id === selectedId;

          return (
            <Marker
              key={item.id}
              coordinate={{
                latitude: item.location_lat!,
                longitude: item.location_lng!,
              }}
              tracksViewChanges={false}
              onPress={() => setSelectedId(item.id)}>
              <View style={[styles.priceBadge, isSelected && styles.priceBadgeSelected]}>
                <Text style={[styles.priceBadgeText, isSelected && styles.priceBadgeTextSelected]}>
                  {priceLabel}
                </Text>
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
                    {[item.location_city, item.location_district].filter(Boolean).join(', ')}
                  </Text>
                  <Text style={styles.calloutPrice}>
                    ₮{price.toLocaleString('mn-MN')} / хоног
                  </Text>
                  {item.average_rating != null && (
                    <Text style={styles.calloutRating}>★ {item.average_rating}</Text>
                  )}
                  <Text style={styles.calloutTap}>Дэлгэрэнгүй харах →</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* ── Overlay: search bar + badge (position: absolute, map-ын дээр) ── */}
      <View
        style={[styles.overlay, { top: insets.top + 8 }]}
        pointerEvents="box-none">
        {/* Search bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark
                ? 'rgba(30,30,30,0.95)'
                : 'rgba(255,255,255,0.96)',
              borderColor: isDark ? '#374151' : '#E0E1E6',
            },
          ]}
          pointerEvents="auto">
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholder="Газрын зураг дээр хайх..."
            placeholderTextColor={C.textSecondary}
            style={[styles.searchInput, { color: C.text }]}
          />
          {searchText.length > 0 && (
            <Pressable onPress={handleClear} hitSlop={8} style={styles.clearBtn}>
              <Text style={{ color: C.textSecondary, fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
          {searchText.trim() !== appliedSearch && searchText.trim() !== '' && (
            <Pressable onPress={handleSearch} style={styles.searchApplyBtn}>
              <Text style={styles.searchApplyBtnText}>Хайх</Text>
            </Pressable>
          )}
        </View>

        {/* Count / loading / error badge */}
        {isLoading ? (
          <View style={[styles.badge, styles.badgeRow]} pointerEvents="none">
            <ActivityIndicator size="small" color="#16A34A" />
            <Text style={[styles.badgeText, { color: C.textSecondary }]}>
              Ачааллаж байна...
            </Text>
          </View>
        ) : error ? (
          <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]} pointerEvents="none">
            <Text style={[styles.badgeText, { color: '#DC2626' }]}>🔌 {error}</Text>
          </View>
        ) : (
          <View style={[styles.badge, styles.badgeGreen]} pointerEvents="none">
            <Text style={[styles.badgeText, { color: '#fff' }]}>
              📍 {mappableListings.length} зар
            </Text>
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  // Overlay — map-ын дээр position absolute
  overlay: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
    zIndex: 10,
  },

  searchBar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 40,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    gap: Spacing.two,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15 },
  clearBtn: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  searchApplyBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchApplyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  badge: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  badgeGreen: { backgroundColor: 'rgba(22,163,74,0.92)' },
  badgeText: { fontSize: 13, fontWeight: '600' },

  // Markers
  priceBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#16A34A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  priceBadgeSelected: { backgroundColor: '#16A34A', borderColor: '#fff' },
  priceBadgeText: { color: '#16A34A', fontSize: 12, fontWeight: '700' },
  priceBadgeTextSelected: { color: '#fff' },

  callout: { width: 220, padding: 10, gap: 3 },
  calloutTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  calloutLocation: { fontSize: 12, color: '#6B7280' },
  calloutPrice: { fontSize: 13, fontWeight: '600', color: '#16A34A', marginTop: 2 },
  calloutRating: { fontSize: 12, color: '#F59E0B' },
  calloutTap: {
    fontSize: 12,
    color: '#16A34A',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
});
