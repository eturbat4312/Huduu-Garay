import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  createFavorite,
  deleteFavorite,
  fetchCategories,
  fetchListings,
  resolveMediaUrl,
} from '@/lib/api';
import type { ListingCategory, ListingFilters, ListingSummary } from '@/types/api';

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

const UB_REGION = {
  latitude: 47.918,
  longitude: 106.917,
  latitudeDelta: 0.4,
  longitudeDelta: 0.4,
};

const EMPTY_FILTERS: ListingFilters = {
  category: '',
  search: '',
  location: '',
  priceMin: null,
  priceMax: null,
  amenities: [],
};

type ListingSection = {
  id: string;
  title: string;
  category?: string;
  items: ListingSummary[];
};

function formatPrice(value: number) {
  if (value >= 1_000_000) return `₮${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₮${Math.round(value / 1_000)}K`;
  return `₮${value}`;
}

function listingHref(id: number) {
  return {
    pathname: '/listing/[id]',
    params: { id: String(id) },
  } as unknown as Href;
}

export default function DiscoveryScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';
  const { isAuthenticated } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  const [draftFilters, setDraftFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchListings(appliedFilters)
      .then((data) => {
        if (!isMounted) return;
        setListings([...data].sort((a, b) => b.id - a.id));
        setSelectedId((current) =>
          current != null && data.some((item) => item.id === current) ? current : null,
        );
        setError(null);
      })
      .catch((err: unknown) => {
        if (isMounted) setError(err instanceof Error ? err.message : 'Алдаа гарлаа');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
        setIsRefreshing(false);
      });
    return () => {
      isMounted = false;
    };
  }, [appliedFilters, reloadKey]);

  useEffect(() => {
    let isMounted = true;
    fetchCategories()
      .then((data) => {
        if (isMounted) setCategories(data);
      })
      .catch(() => {
        if (isMounted) setCategories([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const mappableListings = useMemo(
    () => listings.filter((item) => item.location_lat != null && item.location_lng != null),
    [listings],
  );

  const selectedListing = useMemo(
    () => mappableListings.find((item) => item.id === selectedId) ?? null,
    [mappableListings, selectedId],
  );

  useEffect(() => {
    if (viewMode !== 'map' || mappableListings.length === 0) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        mappableListings.map((item) => ({
          latitude: item.location_lat!,
          longitude: item.location_lng!,
        })),
        {
          edgePadding: { top: 64, right: 44, bottom: 150, left: 44 },
          animated: true,
        },
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [mappableListings, viewMode]);

  const hasActiveFilters = Boolean(
    appliedFilters.category ||
      appliedFilters.search ||
      appliedFilters.location ||
      appliedFilters.priceMin != null ||
      appliedFilters.priceMax != null,
  );

  const searchTitle =
    [appliedFilters.location, appliedFilters.search, appliedFilters.category]
      .filter(Boolean)
      .join(' · ') || 'Хаана хоноё?';

  const carouselCardWidth = Math.min(
    210,
    Math.max(164, (Math.min(windowWidth, MaxContentWidth) - 48) / 2.05),
  );

  const listingSections = useMemo<ListingSection[]>(() => {
    if (hasActiveFilters) {
      return [{
        id: 'filtered',
        title: appliedFilters.category
          ? `${appliedFilters.category} төрлийн газрууд`
          : 'Хайлтын үр дүн',
        items: listings,
      }];
    }

    const sections: ListingSection[] = categories.flatMap((category) => {
      const items = listings.filter((item) => item.category?.name === category.name);
      if (items.length === 0) return [];
      return [{
        id: `category-${category.id}`,
        title: category.name,
        category: category.name,
        items,
      }];
    });
    const knownCategories = new Set(categories.map((category) => category.name));
    const otherListings = listings.filter(
      (item) => !item.category?.name || !knownCategories.has(item.category.name),
    );
    if (otherListings.length > 0) {
      sections.push({ id: 'other', title: 'Бусад онцлох газрууд', items: otherListings });
    }
    if (sections.length === 0 && listings.length > 0) {
      sections.push({ id: 'all', title: 'Танд санал болгох газрууд', items: listings });
    }
    return sections;
  }, [appliedFilters.category, categories, hasActiveFilters, listings]);

  const updateListing = (next: ListingSummary) => {
    setListings((current) => current.map((item) => (item.id === next.id ? next : item)));
  };

  const openFilters = () => {
    setDraftFilters({ ...appliedFilters });
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setIsLoading(true);
    setAppliedFilters({ ...draftFilters });
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setIsLoading(true);
    setAppliedFilters(EMPTY_FILTERS);
    setFiltersOpen(false);
  };

  const applyCategory = (category: string) => {
    const next = { ...appliedFilters, category };
    setDraftFilters(next);
    setIsLoading(true);
    setAppliedFilters(next);
  };

  const retry = () => {
    setIsLoading(true);
    setReloadKey((value) => value + 1);
  };

  const refresh = () => {
    setIsRefreshing(true);
    setReloadKey((value) => value + 1);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Байр хайх болон шүүлт хийх"
            onPress={openFilters}
            style={[
              styles.searchPill,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: isDark ? colors.backgroundSelected : '#D8DADF',
              },
            ]}>
            <Text style={styles.searchIcon}>⌕</Text>
            <View style={styles.searchCopy}>
              <Text style={[styles.searchTitle, { color: colors.text }]} numberOfLines={1}>
                {searchTitle}
              </Text>
              <Text style={[styles.searchSubtitle, { color: colors.textSecondary }]}>
                Байршил · Үнэ · Ангилал
              </Text>
            </View>
            <View style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}>
              <Text style={[styles.filterIcon, hasActiveFilters && styles.filterIconActive]}>☷</Text>
            </View>
          </Pressable>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}>
            <CategoryChip
              label="Бүгд"
              active={!appliedFilters.category}
              onPress={() => applyCategory('')}
            />
            {categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.name}
                icon={category.icon ?? undefined}
                active={appliedFilters.category === category.name}
                onPress={() => applyCategory(category.name)}
              />
            ))}
          </ScrollView>

          <View style={styles.resultsRow}>
            <View>
              <Text style={[styles.resultsTitle, { color: colors.text }]}>Олох газрууд</Text>
              <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
                {isLoading ? 'Хайж байна...' : `${listings.length} зар`}
              </Text>
            </View>
            <View
              style={[
                styles.modeSwitch,
                {
                  backgroundColor: colors.backgroundElement,
                  borderColor: isDark ? colors.backgroundSelected : '#D8DADF',
                },
              ]}>
              <ModeButton
                label="Жагсаалт"
                active={viewMode === 'list'}
                onPress={() => setViewMode('list')}
              />
              <ModeButton
                label="Зураг"
                active={viewMode === 'map'}
                onPress={() => setViewMode('map')}
              />
            </View>
          </View>
        </View>

        {isLoading ? (
          <StatusState colors={colors} icon={null} title="Газруудыг ачааллаж байна..." loading />
        ) : error ? (
          <StatusState
            colors={colors}
            icon="!"
            title="Мэдээлэл авч чадсангүй"
            subtitle={error}
            actionLabel="Дахин оролдох"
            onAction={retry}
          />
        ) : listings.length === 0 ? (
          <StatusState
            colors={colors}
            icon="⌕"
            title="Тохирох газар олдсонгүй"
            subtitle="Шүүлтээ өөрчлөөд дахин хайгаарай."
            actionLabel="Шүүлт цэвэрлэх"
            onAction={clearFilters}
          />
        ) : viewMode === 'map' ? (
          <View style={[styles.mapShell, { marginBottom: BottomTabInset }]}>
            <MapView
              ref={mapRef}
              mapType={MAPTILER_KEY ? 'none' : 'standard'}
              style={styles.map}
              initialRegion={UB_REGION}
              onPress={() => setSelectedId(null)}>
              {MAPTILER_KEY ? (
                <UrlTile
                  urlTemplate={`https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`}
                  maximumZ={19}
                  flipY={false}
                  tileSize={256}
                  zIndex={0}
                />
              ) : null}
              {mappableListings.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <Marker
                    key={`${item.id}-${isSelected ? 'selected' : 'default'}`}
                    coordinate={{
                      latitude: item.location_lat!,
                      longitude: item.location_lng!,
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                    zIndex={isSelected ? 2 : 1}
                    onPress={(event) => {
                      event.stopPropagation();
                      setSelectedId(item.id);
                    }}>
                    {isSelected ? (
                      <View style={styles.selectedMarker}>
                        <Text style={styles.selectedMarkerText}>
                          {formatPrice(Number(item.price_per_night ?? 0))}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.markerDot} />
                    )}
                  </Marker>
                );
              })}
            </MapView>

            <View style={styles.mapCountBadge} pointerEvents="none">
              <Text style={styles.mapCountText}>{mappableListings.length} газар</Text>
            </View>

            {mappableListings.length === 0 ? (
              <View style={[styles.mapMessage, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.mapMessageText, { color: colors.text }]}>Газрын зурагт тэмдэглэсэн зар алга.</Text>
              </View>
            ) : null}

            {selectedListing ? (
              <MapListingCard item={selectedListing} colors={colors} />
            ) : (
              <View style={[styles.mapHint, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.mapHintText, { color: colors.textSecondary }]}>
                  Цэг дээр дарж газрын мэдээллийг харна уу
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.listShell}>
            <FlatList
              data={listingSections}
              keyExtractor={(section) => section.id}
              showsVerticalScrollIndicator={false}
              refreshing={isRefreshing}
              onRefresh={refresh}
              contentContainerStyle={styles.listContent}
              renderItem={({ item: section }) => (
                <ListingCarouselSection
                  section={section}
                  cardWidth={carouselCardWidth}
                  colors={colors}
                  isAuthenticated={isAuthenticated}
                  onChange={updateListing}
                  onSeeAll={section.category ? () => applyCategory(section.category!) : undefined}
                />
              )}
            />
          </View>
        )}
      </SafeAreaView>

      <FilterModal
        visible={filtersOpen}
        filters={draftFilters}
        categories={categories}
        colors={colors}
        onChange={setDraftFilters}
        onClose={() => setFiltersOpen(false)}
        onClear={clearFilters}
        onApply={applyFilters}
      />
    </ThemedView>
  );
}

function CategoryChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: string;
  active: boolean;
  onPress: () => void;
}) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.categoryChip,
        {
          backgroundColor: active ? '#16A34A' : colors.backgroundElement,
          borderColor: active ? '#16A34A' : colors.backgroundSelected,
        },
      ]}>
      {icon ? <Text style={styles.categoryIcon}>{icon}</Text> : null}
      <Text
        style={[styles.categoryLabel, { color: active ? '#FFFFFF' : colors.text }]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ListingCarouselSection({
  section,
  cardWidth,
  colors,
  isAuthenticated,
  onChange,
  onSeeAll,
}: {
  section: ListingSection;
  cardWidth: number;
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  isAuthenticated: boolean;
  onChange: (listing: ListingSummary) => void;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.listingSection}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
          {section.title}
        </Text>
        {onSeeAll ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${section.title} бүгдийг харах`}
            onPress={onSeeAll}
            style={({ pressed }) => [
              styles.sectionArrow,
              { backgroundColor: colors.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.sectionArrowText, { color: colors.text }]}>›</Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={section.items}
        keyExtractor={(item) => `${section.id}-${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        ItemSeparatorComponent={() => <View style={styles.carouselGap} />}
        decelerationRate="fast"
        snapToInterval={cardWidth + 12}
        renderItem={({ item }) => (
          <ListingCard
            item={item}
            width={cardWidth}
            colors={colors}
            isAuthenticated={isAuthenticated}
            onChange={onChange}
          />
        )}
      />
    </View>
  );
}

function ListingCard({
  item,
  width,
  colors,
  isAuthenticated,
  onChange,
}: {
  item: ListingSummary;
  width: number;
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  isAuthenticated: boolean;
  onChange: (listing: ListingSummary) => void;
}) {
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const imageUrl = resolveMediaUrl(item.thumbnail);
  const location = [item.location_city, item.location_district, item.location_khoroo]
    .filter(Boolean)
    .join(', ');

  const toggleFavorite = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    try {
      if (item.is_favorited && item.favorite_id) {
        await deleteFavorite(item.favorite_id);
        onChange({ ...item, is_favorited: false, favorite_id: null });
      } else {
        const favorite = await createFavorite(item.id);
        onChange({ ...item, is_favorited: true, favorite_id: favorite.id });
      }
    } catch {
      // Network/API алдааны үед одоогийн төлөвийг хэвээр үлдээнэ.
    } finally {
      setFavoriteBusy(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${location}`}
      onPress={() => router.push(listingHref(item.id))}
      style={({ pressed }) => [styles.listingCard, { width }, pressed && styles.pressed]}>
      <View style={[styles.listingImageWrap, { width, height: width }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.listingImage, { width, height: width }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.listingImage, styles.imagePlaceholder, { width, height: width }]}>
            <Text style={styles.placeholderIcon}>⌂</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.is_favorited ? 'Хадгалснаас хасах' : 'Хадгалах'}
          disabled={favoriteBusy}
          onPress={(event) => {
            event.stopPropagation();
            void toggleFavorite();
          }}
          style={[styles.favoriteButton, favoriteBusy && styles.favoriteBusy]}>
          <Text style={[styles.favoriteIcon, item.is_favorited && styles.favoriteIconActive]}>
            {item.is_favorited ? '♥' : '♡'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.listingBody}>
        <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
          {location || 'Байршил оруулаагүй'}
        </Text>
        <Text style={[styles.priceLine, { color: colors.textSecondary }]} numberOfLines={1}>
          <Text style={[styles.price, { color: colors.text }]}>
            {`₮${Number(item.price_per_night ?? 0).toLocaleString('mn-MN')}`}
          </Text>
          {' / хоног'}
          {item.average_rating != null ? ` · ★ ${item.average_rating}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

function MapListingCard({
  item,
  colors,
}: {
  item: ListingSummary;
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
}) {
  const imageUrl = resolveMediaUrl(item.thumbnail);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(listingHref(item.id))}
      style={({ pressed }) => [
        styles.mapCard,
        { backgroundColor: colors.backgroundElement },
        pressed && styles.pressed,
      ]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.mapCardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.mapCardImage, styles.imagePlaceholder]}>
          <Text style={styles.mapPlaceholderIcon}>⌂</Text>
        </View>
      )}
      <View style={styles.mapCardBody}>
        <Text style={[styles.mapCardTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.mapCardLocation, { color: colors.textSecondary }]} numberOfLines={1}>
          {[item.location_city, item.location_district].filter(Boolean).join(', ')}
        </Text>
        <Text style={[styles.mapCardPrice, { color: colors.text }]}>
          ₮{Number(item.price_per_night ?? 0).toLocaleString('mn-MN')}
          <Text style={{ color: colors.textSecondary, fontWeight: '400' }}> / хоног</Text>
        </Text>
      </View>
      <Text style={[styles.mapCardArrow, { color: colors.textSecondary }]}>›</Text>
    </Pressable>
  );
}

function StatusState({
  colors,
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  loading = false,
}: {
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  icon: string | null;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.statusState}>
      {loading ? <ActivityIndicator size="large" color="#16A34A" /> : null}
      {icon ? <Text style={[styles.statusIcon, { color: colors.textSecondary }]}>{icon}</Text> : null}
      <Text style={[styles.statusTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.statusAction}>
          <Text style={styles.statusActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FilterModal({
  visible,
  filters,
  categories,
  colors,
  onChange,
  onClose,
  onClear,
  onApply,
}: {
  visible: boolean;
  filters: ListingFilters;
  categories: ListingCategory[];
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  onChange: (filters: ListingFilters) => void;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
}) {
  const borderColor = colors.backgroundSelected;
  const setPrice = (key: 'priceMin' | 'priceMax', value: string) => {
    const digits = value.replace(/[^0-9]/g, '');
    onChange({ ...filters, [key]: digits ? Number(digits) : null });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <ThemedView style={styles.modalContainer}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <Text style={[styles.modalClose, { color: colors.text }]}>×</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Хайлт ба шүүлт</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContent}>
            <FilterField
              label="Түлхүүр үг"
              value={filters.search ?? ''}
              placeholder="Жишээ: голын эрэг, цэвэрхэн байр"
              colors={colors}
              onChangeText={(search) => onChange({ ...filters, search })}
            />
            <FilterField
              label="Байршил"
              value={filters.location ?? ''}
              placeholder="Хот, аймаг эсвэл дүүрэг"
              colors={colors}
              onChangeText={(location) => onChange({ ...filters, location })}
            />

            <View>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Нэг хоногийн үнэ</Text>
              <View style={styles.priceFields}>
                <TextInput
                  value={filters.priceMin?.toString() ?? ''}
                  onChangeText={(value) => setPrice('priceMin', value)}
                  keyboardType="number-pad"
                  placeholder="Доод үнэ"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, styles.priceInput, { color: colors.text, borderColor }]}
                />
                <Text style={[styles.priceDivider, { color: colors.textSecondary }]}>—</Text>
                <TextInput
                  value={filters.priceMax?.toString() ?? ''}
                  onChangeText={(value) => setPrice('priceMax', value)}
                  keyboardType="number-pad"
                  placeholder="Дээд үнэ"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, styles.priceInput, { color: colors.text, borderColor }]}
                />
              </View>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Ангилал</Text>
              <View style={styles.modalCategories}>
                <CategoryChip
                  label="Бүгд"
                  active={!filters.category}
                  onPress={() => onChange({ ...filters, category: '' })}
                />
                {categories.map((category) => (
                  <CategoryChip
                    key={category.id}
                    label={category.name}
                    icon={category.icon ?? undefined}
                    active={filters.category === category.name}
                    onPress={() => onChange({ ...filters, category: category.name })}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
            <Pressable accessibilityRole="button" onPress={onClear} style={styles.clearButton}>
              <Text style={[styles.clearButtonText, { color: colors.text }]}>Цэвэрлэх</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onApply} style={styles.applyButton}>
              <Text style={styles.applyButtonText}>Газрууд харах</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

function FilterField({
  label,
  value,
  placeholder,
  colors,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  onChangeText: (value: string) => void;
}) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        returnKeyType="search"
        style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  searchPill: {
    minHeight: 64,
    borderRadius: 32,
    borderWidth: 1,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  searchIcon: { color: '#16A34A', fontSize: 28, lineHeight: 30, fontWeight: '700' },
  searchCopy: { flex: 1, gap: 2 },
  searchTitle: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  searchSubtitle: { fontSize: 12, lineHeight: 16 },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  filterButtonActive: { backgroundColor: '#16A34A' },
  filterIcon: { fontSize: 18, color: '#6B7280', transform: [{ rotate: '90deg' }] },
  filterIconActive: { color: '#FFFFFF' },
  categoryRow: { gap: Spacing.two, paddingVertical: 12, paddingRight: Spacing.three },
  categoryChip: {
    height: 38,
    maxWidth: 180,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  categoryIcon: { fontSize: 15 },
  categoryLabel: { fontSize: 13, fontWeight: '600' },
  resultsRow: {
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  resultsTitle: { fontSize: 20, lineHeight: 24, fontWeight: '800' },
  resultsCount: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  modeSwitch: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeButton: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center' },
  modeButtonActive: { backgroundColor: '#16A34A' },
  modeButtonText: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  modeButtonTextActive: { color: '#FFFFFF' },
  listShell: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.four,
    gap: 30,
  },
  listingSection: { width: '100%', gap: 12 },
  sectionHeader: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionTitle: { flex: 1, fontSize: 21, lineHeight: 27, fontWeight: '800' },
  sectionArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionArrowText: { fontSize: 30, lineHeight: 32, fontWeight: '400', marginTop: -2 },
  carouselContent: { paddingHorizontal: Spacing.three },
  carouselGap: { width: 12 },
  listingCard: { flexShrink: 0 },
  listingImageWrap: { position: 'relative', borderRadius: 16, overflow: 'hidden' },
  listingImage: { backgroundColor: '#DDE7DF' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDE7DF' },
  placeholderIcon: { fontSize: 42, color: '#6C8A72' },
  favoriteButton: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBusy: { opacity: 0.55 },
  favoriteIcon: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  favoriteIconActive: { color: '#E11D48' },
  listingBody: { paddingTop: 8, paddingHorizontal: 4, gap: 1 },
  listingTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  location: { fontSize: 13, lineHeight: 18 },
  priceLine: { fontSize: 13, lineHeight: 18 },
  price: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  mapShell: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    position: 'relative',
  },
  map: { flex: 1, borderRadius: 18, overflow: 'hidden' },
  markerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#16A34A',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 4,
    elevation: 4,
  },
  selectedMarker: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  selectedMarkerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  mapCountBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(17,24,39,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mapCountText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  mapMessage: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    top: '45%',
    borderRadius: 14,
    padding: 14,
  },
  mapMessageText: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  mapHint: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    bottom: 12,
    minHeight: 44,
    borderRadius: 15,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  mapHintText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  mapCard: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    bottom: 12,
    height: 106,
    borderRadius: 16,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  mapCardImage: { width: 96, height: 90, borderRadius: 12, backgroundColor: '#DDE7DF' },
  mapPlaceholderIcon: { color: '#6C8A72', fontSize: 32 },
  mapCardBody: { flex: 1, gap: 4 },
  mapCardTitle: { fontSize: 14, fontWeight: '800' },
  mapCardLocation: { fontSize: 12 },
  mapCardPrice: { fontSize: 13, fontWeight: '800' },
  mapCardArrow: { fontSize: 28, paddingRight: 4 },
  statusState: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  statusIcon: { fontSize: 40, fontWeight: '300' },
  statusTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  statusSubtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  statusAction: {
    marginTop: Spacing.two,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modalContainer: { flex: 1 },
  modalSafeArea: { flex: 1 },
  modalHeader: {
    height: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalClose: { fontSize: 30, lineHeight: 32, fontWeight: '300' },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalHeaderSpacer: { width: 20 },
  modalContent: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.four,
  },
  fieldLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  priceFields: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInput: { flex: 1 },
  priceDivider: { fontSize: 16 },
  modalCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  modalFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  clearButton: { minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' },
  clearButtonText: { fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  applyButton: {
    flex: 1,
    maxWidth: 280,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
