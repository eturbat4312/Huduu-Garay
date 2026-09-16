import { useEffect, useMemo, useRef, useState } from "react";
import type { Href } from "expo-router";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, UrlTile } from "react-native-maps";
import { router } from "expo-router";

import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Colors, Spacing } from "@/constants/theme";
import {
  createFavorite,
  deleteFavorite,
  fetchCategories,
  fetchListings,
  resolveMediaUrl,
} from "@/lib/api";
import type {
  ListingCategory,
  ListingFilters,
  ListingSummary,
} from "@/types/api";

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

const SCREEN_WIDTH = Dimensions.get("window").width;
// 2 карт + 3 дахийн ирмэг харагдахаар
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.three * 2 - Spacing.two) / 2.15;

const emptyFilters: ListingFilters = {
  category: "",
  search: "",
  location: "",
  priceMin: null,
  priceMax: null,
  amenities: [],
};

export default function HomeScreen() {
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const C = Colors[scheme];
  const isDark = scheme === "dark";

  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  const [filters, setFilters] = useState<ListingFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<ListingFilters>(emptyFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const homeMapRef = useRef<MapView>(null);

  useEffect(() => {
    let isMounted = true;
    fetchListings(appliedFilters)
      .then((data) => {
        if (isMounted) {
          setListings(
            [...data].sort((a, b) => {
              const ca = "created_at" in a ? Date.parse(String(a.created_at)) : 0;
              const cb = "created_at" in b ? Date.parse(String(b.created_at)) : 0;
              return cb - ca || b.id - a.id;
            })
          );
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) setError(err instanceof Error ? err.message : "Алдаа гарлаа");
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [appliedFilters]);

  useEffect(() => {
    let isMounted = true;
    fetchCategories()
      .then((data) => { if (isMounted) setCategories(data); })
      .catch(() => { if (isMounted) setCategories([]); });
    return () => { isMounted = false; };
  }, []);

  // Ангиллаар бүлэглэх
  const sections = useMemo(() => {
    if (appliedFilters.category) {
      // Шүүлт тохируулсан бол нэг бүлэг
      return [{ id: "filtered", name: appliedFilters.category, icon: "", items: listings }];
    }
    const result: { id: string; name: string; icon: string; items: ListingSummary[] }[] = [];
    categories.forEach((cat) => {
      const items = listings.filter((l) => l.category?.name === cat.name);
      if (items.length > 0) {
        result.push({ id: String(cat.id), name: cat.name, icon: cat.icon ?? "", items });
      }
    });
    // Ангилалгүй зарууд
    const uncategorized = listings.filter(
      (l) => !l.category || !categories.find((c) => c.name === l.category?.name)
    );
    if (uncategorized.length > 0) {
      result.push({ id: "other", name: "Бусад", icon: "🏠", items: uncategorized });
    }
    // Ангилал байхгүй бол бүгдийг нэг бүлэгт
    if (result.length === 0 && listings.length > 0) {
      result.push({ id: "all", name: "Бүх зарууд", icon: "", items: listings });
    }
    return result;
  }, [listings, categories, appliedFilters.category]);

  const mappableListings = useMemo(
    () => listings.filter((l) => l.location_lat != null && l.location_lng != null),
    [listings]
  );

  // Зарууд ачаалагдсаны дараа preview map-д auto-fit
  useEffect(() => {
    if (mappableListings.length === 0) return;
    const timer = setTimeout(() => {
      homeMapRef.current?.fitToCoordinates(
        mappableListings.map((l) => ({
          latitude: l.location_lat!,
          longitude: l.location_lng!,
        })),
        { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true },
      );
    }, 600);
    return () => clearTimeout(timer);
  }, [mappableListings]);

  const applyCategory = (category: string) => {
    const next = { ...filters, category };
    setFilters(next);
    setAppliedFilters(next);
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    setSearchExpanded(false);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setSearchExpanded(false);
  };

  const hasActiveFilters =
    !!filters.search || !!filters.location || filters.priceMin !== null || filters.priceMax !== null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { paddingBottom: BottomTabInset }]}>

        {/* Backdrop */}
        {searchExpanded && (
          <Pressable style={styles.backdrop} onPress={() => setSearchExpanded(false)} />
        )}

        {/* Хайлтын pill */}
        <Pressable
          onPress={() => setSearchExpanded((v) => !v)}
          style={[
            styles.searchPill,
            { backgroundColor: C.backgroundElement, borderColor: isDark ? C.backgroundSelected : "#E0E1E6" },
          ]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <View style={styles.searchPillText}>
            <Text style={[styles.searchPillLabel, { color: C.text }]} numberOfLines={1}>
              {hasActiveFilters
                ? [filters.search, filters.location].filter(Boolean).join(" · ") || "Шүүлттэй"
                : "Хаана хоноё?"}
            </Text>
            <Text style={[styles.searchPillSub, { color: C.textSecondary }]}>
              Хаягаар, Аймгаар · Үнийн хэмжээ хайх
            </Text>
          </View>
          {hasActiveFilters && (
            <Pressable onPress={(e) => { e.stopPropagation(); clearFilters(); }} hitSlop={8} style={styles.clearPill}>
              <Text style={{ color: C.textSecondary, fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
        </Pressable>

        {/* Нэмэлт шүүлт */}
        {searchExpanded && (
          <View style={[styles.expandedFilters, { backgroundColor: C.backgroundElement, borderColor: isDark ? C.backgroundSelected : "#E0E1E6" }]}>
            <TextInput
              value={filters.search}
              onChangeText={(s) => setFilters((f) => ({ ...f, search: s }))}
              placeholder="Гарчиг хайх..."
              placeholderTextColor={C.textSecondary}
              style={[styles.filterInput, { color: C.text, borderColor: isDark ? C.backgroundSelected : "#E0E1E6" }]}
            />
            <TextInput
              value={filters.location}
              onChangeText={(s) => setFilters((f) => ({ ...f, location: s }))}
              placeholder="Аймаг, Хот (жишээ: Архангай)"
              placeholderTextColor={C.textSecondary}
              style={[styles.filterInput, { color: C.text, borderColor: isDark ? C.backgroundSelected : "#E0E1E6" }]}
            />
            <View style={{ flexDirection: "row", gap: Spacing.two }}>
              <TextInput
                value={filters.priceMin?.toString() ?? ""}
                onChangeText={(v) => setFilters((f) => ({ ...f, priceMin: v ? Number(v) : null }))}
                keyboardType="numeric"
                placeholder="Мин ₮"
                placeholderTextColor={C.textSecondary}
                style={[styles.filterInput, { flex: 1, color: C.text, borderColor: isDark ? C.backgroundSelected : "#E0E1E6" }]}
              />
              <TextInput
                value={filters.priceMax?.toString() ?? ""}
                onChangeText={(v) => setFilters((f) => ({ ...f, priceMax: v ? Number(v) : null }))}
                keyboardType="numeric"
                placeholder="Макс ₮"
                placeholderTextColor={C.textSecondary}
                style={[styles.filterInput, { flex: 1, color: C.text, borderColor: isDark ? C.backgroundSelected : "#E0E1E6" }]}
              />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Pressable onPress={clearFilters}>
                <Text style={{ color: C.textSecondary, fontSize: 14, textDecorationLine: "underline" }}>Цэвэрлэх</Text>
              </Pressable>
              <Pressable onPress={applyFilters} style={styles.applyBtn}>
                <Text style={styles.applyBtnText}>🔍 Хайх</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Ангиллын таб */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroller}
          contentContainerStyle={styles.catRow}
        >
          <CategoryPill label="Бүгд" active={!filters.category} onPress={() => applyCategory("")} />
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

        {/* Газрын зураг preview */}
        {!isLoading && mappableListings.length > 0 && (
          <View style={styles.mapPreviewWrap}>
            <View style={styles.mapPreviewHeader}>
              <Text style={[styles.mapPreviewTitle, { color: C.text }]}>🗺 Газрын зурган дээр</Text>
              <Pressable onPress={() => router.push('/(tabs)/map' as never)}>
                <Text style={styles.mapPreviewLink}>Бүгдийг харах →</Text>
              </Pressable>
            </View>
            <View style={styles.mapPreviewBox}>
              <MapView
                ref={homeMapRef}
                mapType="none"
                style={{ flex: 1 }}
                scrollEnabled={true}
                zoomEnabled={true}
                pitchEnabled={false}
                rotateEnabled={false}
                initialRegion={{
                  latitude: 47.918,
                  longitude: 106.917,
                  latitudeDelta: 0.35,
                  longitudeDelta: 0.35,
                }}
              >
                <UrlTile
                  urlTemplate={`https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`}
                  maximumZ={19}
                  flipY={false}
                  tileSize={256}
                  zIndex={0}
                />
                {mappableListings.map((item) => (
                  <Marker
                    key={item.id}
                    coordinate={{ latitude: item.location_lat!, longitude: item.location_lng! }}
                    tracksViewChanges={false}
                    onPress={() => router.push(`/listing/${item.id}` as never)}
                  >
                    <View style={styles.mapPin}>
                      <Text style={styles.mapPinText}>
                        {'₮'}{Math.round(Number(item.price_per_night) / 1000)}{'К'}
                      </Text>
                    </View>
                  </Marker>
                ))}
              </MapView>
            </View>
          </View>
        )}

        {/* Агуулга */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#16A34A" />
            <Text style={{ color: C.textSecondary, marginTop: 8 }}>Ачааллаж байна...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 32 }}>🔌</Text>
            <Text style={{ color: C.text, fontWeight: "600" }}>Холболт шалгана уу</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13 }}>{error}</Text>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 40 }}>🏡</Text>
            <Text style={{ color: C.text, fontWeight: "600" }}>Зар олдсонгүй</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13 }}>Шүүлтийг өөрчилж дахин хайна уу.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sectionsContent}>
            {sections.map((section) => {
              const isFiltered = !!appliedFilters.category;
              const renderCard = (item: ListingSummary) => {
                const thumbnailUrl = resolveMediaUrl(item.thumbnail);
                const location = [item.location_city, item.location_district]
                  .filter(Boolean).join(", ") || "Байршил байхгүй";
                return (
                  <ListingCard
                    key={item.id}
                    item={item}
                    location={location}
                    thumbnailUrl={thumbnailUrl}
                    onChange={(next) =>
                      setListings((cur) => cur.map((l) => (l.id === next.id ? next : l)))
                    }
                  />
                );
              };
              return (
                <View key={section.id} style={styles.section}>
                  {/* Гарчиг + "Бүгдийг харах" товч */}
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: C.text }]}>
                      {section.icon ? `${section.icon} ` : ""}{section.name}
                    </Text>
                    {!isFiltered && (
                      <Pressable onPress={() => applyCategory(section.name)} style={styles.seeAllBtn}>
                        <Text style={styles.seeAllText}>Бүгдийг харах →</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Шүүлттэй үед: босоо жагсаалт бүтэн өргөнтэй */}
                  {isFiltered ? (
                    <View style={styles.verticalList}>
                      {section.items.map((item) => (
                        <FullWidthCard
                          key={item.id}
                          item={item}
                          onChange={(next) =>
                            setListings((cur) => cur.map((l) => (l.id === next.id ? next : l)))
                          }
                        />
                      ))}
                    </View>
                  ) : (
                    /* Шүүлтгүй үед: хажуу тийш гүйдэг 2 баганатай */
                    <FlatList
                      data={section.items}
                      keyExtractor={(item) => String(item.id)}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      snapToInterval={CARD_WIDTH + Spacing.two}
                      snapToAlignment="start"
                      decelerationRate="fast"
                      contentContainerStyle={styles.cardRow}
                      renderItem={({ item }) => renderCard(item)}
                    />
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.three },

  // Backdrop
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },

  // Search pill
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 40,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
    zIndex: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: Spacing.two,
  },
  searchIcon: { fontSize: 18 },
  searchPillText: { flex: 1, gap: 2 },
  searchPillLabel: { fontSize: 15, fontWeight: "600" },
  searchPillSub: { fontSize: 12 },
  clearPill: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },

  // Expanded filters
  expandedFilters: {
    borderWidth: 1, borderRadius: 16,
    padding: Spacing.three, marginBottom: Spacing.two,
    gap: Spacing.two, zIndex: 2,
  },
  filterInput: {
    height: 44, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: Spacing.three, fontSize: 15,
  },
  applyBtn: {
    backgroundColor: "#16A34A", borderRadius: 10,
    paddingHorizontal: Spacing.four, paddingVertical: 10,
  },
  applyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Category tabs
  catScroller: { flexGrow: 0, flexShrink: 0, marginBottom: Spacing.two },
  catRow: { gap: Spacing.one, paddingBottom: 2 },

  // Map preview
  mapPreviewWrap: { marginBottom: Spacing.two },
  mapPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.two,
  },
  mapPreviewTitle: { fontSize: 16, fontWeight: "700" },
  mapPreviewLink: { fontSize: 13, fontWeight: "600", color: "#16A34A" },
  mapPreviewBox: { width: "100%", height: 210, borderRadius: 14, overflow: "hidden" },
  mapPin: {
    backgroundColor: "#16A34A",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  mapPinText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  mapOverlayBtn: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },
  mapOverlayBtnInner: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "rgba(22,163,74,0.9)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  mapOverlayBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Sections
  sectionsContent: { paddingBottom: Spacing.five },
  section: { marginBottom: Spacing.four },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.two },
  cardRow: { gap: Spacing.two },

  // Center placeholder
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.two },

  // Card
  card: { width: CARD_WIDTH, borderRadius: 14, overflow: "hidden" },
  pressed: { opacity: 0.88 },
  imageWrapper: { position: "relative", borderRadius: 14, overflow: "hidden" },
  cardImage: { width: CARD_WIDTH, height: CARD_WIDTH * 0.72, backgroundColor: "#DDE7DF" },
  cardImagePlaceholder: {
    width: CARD_WIDTH, height: CARD_WIDTH * 0.72,
    backgroundColor: "#DDE7DF", alignItems: "center", justifyContent: "center",
  },
  heartBtn: {
    position: "absolute", top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  heartBusy: { opacity: 0.5 },
  cardBody: { paddingTop: 8, gap: 2 },
  cardTitle: { fontSize: 13, fontWeight: "600" },
  cardLocation: { fontSize: 12 },
  cardPrice: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  cardRating: { fontSize: 12 },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.two,
  },
  seeAllBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  seeAllText: { fontSize: 13, fontWeight: "600", color: "#16A34A" },

  // Vertical list (filtered mode)
  verticalList: { gap: Spacing.three },

  // Full-width card (filtered mode)
  fullCard: { borderRadius: 14, overflow: "hidden" },
  fullCardImage: { width: "100%", height: 220, backgroundColor: "#DDE7DF" },
  fullCardPlaceholder: {
    width: "100%", height: 220, backgroundColor: "#DDE7DF",
    alignItems: "center", justifyContent: "center",
  },
  fullCardBody: { paddingTop: 10, gap: 3 },
  fullCardTitle: { fontSize: 15, fontWeight: "600" },
  fullCardLocation: { fontSize: 14 },
  fullCardPrice: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  fullCardRating: { fontSize: 13 },
});

// ─── CategoryPill ─────────────────────────────────────────────────────────────

function CategoryPill({ label, icon, active, onPress }: {
  label: string; icon?: string; active: boolean; onPress: () => void;
}) {
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const C = Colors[scheme];
  return (
    <Pressable
      onPress={onPress}
      style={{ alignItems: "center", paddingHorizontal: 12, paddingVertical: 8,
        borderBottomWidth: 2, borderBottomColor: active ? "#16A34A" : "transparent" }}
    >
      {icon ? <Text style={{ fontSize: 18, marginBottom: 2 }}>{icon}</Text> : null}
      <Text style={{ fontSize: 12, fontWeight: active ? "700" : "500",
        color: active ? C.text : C.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── ListingCard ──────────────────────────────────────────────────────────────

function ListingCard({ item, location, thumbnailUrl, onChange }: {
  item: ListingSummary; location: string;
  thumbnailUrl: string | null; onChange: (l: ListingSummary) => void;
}) {
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const C = Colors[scheme];
  const [busy, setBusy] = useState(false);
  const price = Number(item.price_per_night ?? 0);

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
      onPress={() => router.push({ pathname: "/listing/[id]", params: { id: String(item.id) } } as unknown as Href)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrapper}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={{ fontSize: 36 }}>🏡</Text>
          </View>
        )}
        <Pressable
          onPress={(e) => { e.stopPropagation(); toggleFavorite(); }}
          disabled={busy}
          style={[styles.heartBtn, busy && styles.heartBusy]}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 18, textShadowColor: "rgba(0,0,0,0.35)",
            textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
            {item.is_favorited ? "❤️" : "🤍"}
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
        {item.average_rating !== null && item.average_rating !== undefined && (
          <Text style={[styles.cardRating, { color: C.textSecondary }]}>
            ★ {item.average_rating}
          </Text>
        )}
        <Text style={[styles.cardPrice, { color: C.text }]}>
          ₮{price.toLocaleString("mn-MN")}
          <Text style={{ fontWeight: "400", color: C.textSecondary }}> / хоног</Text>
        </Text>
      </View>
    </Pressable>
  );
}

// ─── FullWidthCard (шүүлттэй үед бүтэн өргөнтэй карт) ───────────────────────

function FullWidthCard({ item, onChange }: {
  item: ListingSummary; onChange: (l: ListingSummary) => void;
}) {
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const C = Colors[scheme];
  const [busy, setBusy] = useState(false);
  const price = Number(item.price_per_night ?? 0);
  const thumbnailUrl = resolveMediaUrl(item.thumbnail);
  const location = [item.location_city, item.location_district, item.location_khoroo]
    .filter(Boolean).join(", ") || "Байршил байхгүй";

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
      onPress={() => router.push({ pathname: "/listing/[id]", params: { id: String(item.id) } } as unknown as Href)}
      style={({ pressed }) => [styles.fullCard, pressed && styles.pressed]}
    >
      <View style={[styles.imageWrapper, { borderRadius: 14 }]}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.fullCardImage} resizeMode="cover" />
        ) : (
          <View style={styles.fullCardPlaceholder}>
            <Text style={{ fontSize: 48 }}>🏡</Text>
          </View>
        )}
        <Pressable
          onPress={(e) => { e.stopPropagation(); toggleFavorite(); }}
          disabled={busy}
          style={[styles.heartBtn, busy && styles.heartBusy]}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 20, textShadowColor: "rgba(0,0,0,0.35)",
            textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
            {item.is_favorited ? "❤️" : "🤍"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.fullCardBody}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.fullCardTitle, { color: C.text, flex: 1, marginRight: 8 }]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.average_rating !== null && item.average_rating !== undefined && (
            <Text style={[styles.fullCardRating, { color: C.textSecondary }]}>★ {item.average_rating}</Text>
          )}
        </View>
        <Text style={[styles.fullCardLocation, { color: C.textSecondary }]} numberOfLines={1}>
          {location}
        </Text>
        <Text style={[styles.fullCardPrice, { color: C.text }]}>
          ₮{price.toLocaleString("mn-MN")}
          <Text style={{ fontWeight: "400", color: C.textSecondary }}> / хоног</Text>
        </Text>
      </View>
    </Pressable>
  );
}
