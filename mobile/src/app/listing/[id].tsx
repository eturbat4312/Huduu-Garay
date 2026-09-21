import type { Href } from 'expo-router';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { CHECK_IN_TIME, CHECK_OUT_TIME } from '@/constants/booking-times';
import { useAuth } from '@/context/auth';
import {
  createFavorite,
  createReview,
  deleteFavorite,
  deleteListing,
  fetchAvailability,
  fetchListing,
  fetchReviewEligibility,
  fetchReviews,
  resolveMediaUrl,
} from '@/lib/api';
import {
  compareYmd,
  datesBetweenNights,
  isDateString,
  normalizeCheckout,
  todayYmd,
} from '@/lib/dates';
import type { ListingDetail, Review, ReviewEligibility } from '@/types/api';

type LoadedReviewEligibility = ReviewEligibility & {
  listingId: string;
  userId: number;
};

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

// ─── Calendar picker ────────────────────────────────────────────────────────

const MONTH_NAMES = [
  '1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар',
  '7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар',
];
const WEEK_DAYS = ['Да','Мя','Лх','Пү','Ба','Бя','Ня']; // Monday start

function CalendarPicker({
  checkIn,
  checkOut,
  normalizedCheckOut,
  availableDates,
  onSetCheckIn,
  onSetCheckOut,
  onReset,
}: {
  checkIn: string;
  checkOut: string;
  normalizedCheckOut: string;
  availableDates: Set<string>;
  onSetCheckIn: (d: string) => void;
  onSetCheckOut: (d: string) => void;
  onReset: () => void;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const C = Colors[scheme];
  const today = todayYmd();

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Monday-start offset: Sun(0)→6, Mon(1)→0, ..., Sat(6)→5
  const rawFirst = new Date(viewYear, viewMonth, 1).getDay();
  const firstOffset = (rawFirst + 6) % 7;

  const dayYmd = (d: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const handleDayPress = (d: number) => {
    const date = dayYmd(d);
    if (compareYmd(date, today) < 0) return; // past

    if (!checkIn || (checkIn && checkOut)) {
      // No selection yet OR both already set → start fresh with new checkIn
      onReset();
      onSetCheckIn(date);
    } else {
      // checkIn set, checkOut not yet
      if (compareYmd(date, checkIn) > 0) {
        onSetCheckOut(date);
      } else {
        // Same day or before checkIn → reset and set new checkIn
        onReset();
        onSetCheckIn(date);
      }
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Can we go back? Only if current view is after today's month
  const todayDate = new Date();
  const canGoPrev = viewYear > todayDate.getFullYear() ||
    (viewYear === todayDate.getFullYear() && viewMonth > todayDate.getMonth());

  // Build cell array: nulls for empty leading cells, then day numbers
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      {/* Month navigation */}
      <View style={calStyles.monthHeader}>
        <Pressable
          onPress={canGoPrev ? prevMonth : undefined}
          style={[calStyles.navBtn, !canGoPrev && { opacity: 0.3 }]}
        >
          <Text style={{ color: C.text, fontSize: 18 }}>‹</Text>
        </Pressable>
        <Text style={[calStyles.monthTitle, { color: C.text }]}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={nextMonth} style={calStyles.navBtn}>
          <Text style={{ color: C.text, fontSize: 18 }}>›</Text>
        </Pressable>
      </View>

      {/* Week day headers */}
      <View style={calStyles.weekRow}>
        {WEEK_DAYS.map(d => (
          <View key={d} style={calStyles.weekCell}>
            <Text style={[calStyles.weekLabel, { color: C.textSecondary }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <View key={`e${idx}`} style={calStyles.cell} />;
          }

          const date = dayYmd(day);
          const isPast = compareYmd(date, today) < 0;
          const isAvailable = availableDates.has(date);
          const isCheckIn = date === checkIn;
          const isCheckOut = date === normalizedCheckOut && !!checkOut;

          // Is this date inside the selected range (between checkIn and checkOut)?
          const isInRange =
            !!checkIn && !!checkOut &&
            compareYmd(date, checkIn) > 0 &&
            compareYmd(date, normalizedCheckOut) < 0;

          // Available dates use the same green hierarchy as the web calendar.
          let circleBg = 'transparent';
          if (!isPast && isAvailable) circleBg = '#BBF7D0';
          if (isCheckIn || isCheckOut) circleBg = '#16A34A';

          // Range strip background (full cell width, half for edge cells)
          // Left half strip for checkOut, right half strip for checkIn
          // (simplified: just full strip on in-range days)

          // Text color
          let textColor: string = C.text;
          if (isPast) textColor = C.textSecondary;
          if (isCheckIn || isCheckOut) textColor = '#FFFFFF';
          else if (!isPast && isAvailable) textColor = '#14532D';
          if (isInRange && !isCheckIn && !isCheckOut) textColor = '#166534';

          return (
            <Pressable
              key={date}
              style={calStyles.cell}
              onPress={() => handleDayPress(day)}
              disabled={isPast}
            >
              {/* Range strip */}
              {isInRange && (
                <View style={[calStyles.strip, { backgroundColor: '#DCFCE7' }]} />
              )}
              {/* Right-side strip for checkIn */}
              {isCheckIn && !!checkOut && (
                <View style={calStyles.stripRight} />
              )}
              {/* Left-side strip for checkOut */}
              {isCheckOut && (
                <View style={calStyles.stripLeft} />
              )}

              {/* Day circle */}
              <View style={[calStyles.circle, { backgroundColor: circleBg }]}>
                <Text style={[calStyles.dayText, { color: textColor }]}>{day}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Legend */}
      <View style={calStyles.legend}>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendCircle, { backgroundColor: '#BBF7D0' }]} />
          <Text style={[calStyles.legendText, { color: C.textSecondary }]}>Боломжтой</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendCircle, { backgroundColor: '#16A34A' }]} />
          <Text style={[calStyles.legendText, { color: C.textSecondary }]}>Сонгосон</Text>
        </View>
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  navBtn: {
    padding: Spacing.two,
    minWidth: 36,
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    position: 'relative',
    height: 40,
  },
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 28,
    marginTop: -14,
  },
  stripRight: {
    position: 'absolute',
    left: '50%',
    right: 0,
    top: '50%',
    height: 28,
    marginTop: -14,
    backgroundColor: '#DCFCE7',
  },
  stripLeft: {
    position: 'absolute',
    left: 0,
    right: '50%',
    top: '50%',
    height: 28,
    marginTop: -14,
    backgroundColor: '#DCFCE7',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontSize: 11,
  },
  legendCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

// ─── Main screen ────────────────────────────────────────────────────────────

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const C = Colors[scheme];
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useAuth();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteId, setFavoriteId] = useState<number | null>(null);
  const routeError = id ? null : 'Зарын дугаар олдсонгүй';

  // ── Reviews ──
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewEligibility, setReviewEligibility] = useState<LoadedReviewEligibility | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchReviews(id).then(setReviews).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;

    let isMounted = true;
    const listingId = String(id);
    const userId = user.id;
    fetchReviewEligibility(id)
      .then((result) => {
        if (isMounted) setReviewEligibility({ ...result, listingId, userId });
      })
      .catch(() => {
        if (isMounted) {
          setReviewEligibility({
            can_review: false,
            reason: '',
            reason_code: 'no_completed_stay',
            booking_id: null,
            listingId,
            userId,
          });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [id, user]);

  const handleSubmitReview = async () => {
    if (reviewRating === 0) return Alert.alert('Алдаа', 'Үнэлгээ сонгоно уу.');
    if (!reviewComment.trim()) return Alert.alert('Алдаа', 'Сэтгэгдэл бичнэ үү.');
    setSubmittingReview(true);
    try {
      const r = await createReview(id!, { rating: reviewRating, comment: reviewComment.trim() });
      setReviews((prev) => [r, ...prev]);
      setReviewRating(0);
      setReviewComment('');
      setReviewEligibility((current) =>
        current ? { ...current, can_review: false, booking_id: null } : current,
      );
      if (user) {
        const listingId = String(id);
        const userId = user.id;
        fetchReviewEligibility(id!)
          .then((result) => setReviewEligibility({ ...result, listingId, userId }))
          .catch(() => {});
      }
      Alert.alert('Амжилттай', 'Сэтгэгдэл амжилттай нийтлэгдлээ.');
    } catch (e: unknown) {
      const err = e as { message?: string };
      Alert.alert('Алдаа', err.message ?? 'Сэтгэгдэл илгээхэд алдаа гарлаа.');
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (!id) {
      return;
    }

    let isMounted = true;

    Promise.all([fetchListing(id), fetchAvailability(id)])
      .then(([listingData, availabilityData]) => {
        if (isMounted) {
          setListing(listingData);
          setCurrentImageIndex(0);
          setAvailableDates(new Set(availabilityData.map((day) => day.date.trim())));
          setIsFavorited(listingData.is_favorited ?? false);
          setFavoriteId(listingData.favorite_id ?? null);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Алдаа гарлаа');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const imageUrls = useMemo(() => {
    const urls = (listing?.images ?? [])
      .map((image) => resolveMediaUrl(image.image))
      .filter((url): url is string => Boolean(url));
    const fallback = resolveMediaUrl(listing?.thumbnail);
    if (urls.length === 0 && fallback) urls.push(fallback);
    return urls;
  }, [listing]);

  const handleImageScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageWidth = event.nativeEvent.layoutMeasurement.width;
    if (!pageWidth) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setCurrentImageIndex(Math.max(0, Math.min(nextIndex, imageUrls.length - 1)));
  };

  const normalizedCheckOut = useMemo(() => {
    if (!isDateString(checkIn) || !isDateString(checkOut)) {
      return checkOut;
    }

    return normalizeCheckout(checkIn, checkOut);
  }, [checkIn, checkOut]);

  const selectedNights = useMemo(() => {
    if (!isDateString(checkIn) || !isDateString(normalizedCheckOut)) {
      return [];
    }

    if (compareYmd(checkIn, normalizedCheckOut) >= 0) {
      return [];
    }

    return datesBetweenNights(checkIn, normalizedCheckOut);
  }, [checkIn, normalizedCheckOut]);

  const totalPrice = selectedNights.length * Number(listing?.price_per_night ?? 0);
  const canReview =
    !!user &&
    reviewEligibility?.listingId === String(id) &&
    reviewEligibility.userId === user.id &&
    reviewEligibility.can_review;

  const validateSelectedRange = () => {
    if (!isDateString(checkIn) || !isDateString(checkOut)) {
      return 'Орох болон гарах өдрөө сонгоно уу.';
    }

    if (compareYmd(checkIn, todayYmd()) < 0) {
      return 'Өнгөрсөн өдрөөр захиалга хийх боломжгүй.';
    }

    if (compareYmd(checkIn, normalizedCheckOut) >= 0) {
      return 'Гарах өдөр орох өдрөөс хойш байх ёстой.';
    }

    if (selectedNights.length === 0) {
      return 'Хамгийн багадаа 1 хоног сонгоно уу.';
    }

    const unavailableDate = selectedNights.find((date) => !availableDates.has(date));
    if (unavailableDate) {
      return `${unavailableDate} өдөр боломжгүй байна. Зөвхөн боломжтой өдрүүдээс сонгоно уу.`;
    }

    return null;
  };

  const isOwner = !!user && !!listing?.host?.id && user.id === listing.host.id;
  const isLoggedIn = !!user;

  const handleFavorite = async () => {
    if (!listing) return;
    try {
      if (isFavorited && favoriteId) {
        await deleteFavorite(favoriteId);
        setIsFavorited(false);
        setFavoriteId(null);
      } else {
        const res = await createFavorite(listing.id);
        setIsFavorited(true);
        setFavoriteId(res.id);
      }
    } catch {}
  };

  const handleDelete = () => {
    Alert.alert(
      'Зар устгах',
      'Та энэ зарыг устгахдаа итгэлтэй байна уу?',
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Устгах',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteListing(Number(id));
              router.back();
            } catch (err: unknown) {
              const status = (err as { status?: number })?.status;
              if (status === 409) {
                Alert.alert('Устгах боломжгүй', 'Идэвхтэй захиалга байгаа тул устгах боломжгүй.');
              } else {
                Alert.alert('Алдаа', 'Устгахад алдаа гарлаа.');
              }
            }
          },
        },
      ],
    );
  };

  const handleContinueToCheckout = () => {
    const validationError = validateSelectedRange();
    if (validationError) {
      setBookingMessage(validationError);
      return;
    }

    setBookingMessage('');
    router.push(
      {
        pathname: '/checkout',
        params: {
          listing: String(id),
          check_in: checkIn,
          check_out: normalizedCheckOut,
        },
      } as unknown as Href,
    );
  };

  if (routeError) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ThemedText type="smallBold">Зар нээхэд алдаа гарлаа</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {routeError}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator />
          <ThemedText themeColor="textSecondary">Зарын мэдээлэл ачаалж байна</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (error || !listing) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ThemedText type="smallBold">Зар нээхэд алдаа гарлаа</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {error ?? 'Зар олдсонгүй'}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const canViewPrivateLocation = listing.can_view_private_location || isOwner;
  const visibleLocation = [
    listing.location_city,
    listing.location_district,
    listing.location_khoroo,
    listing.location_extra,
    canViewPrivateLocation ? listing.location_building : '',
    canViewPrivateLocation && listing.location_apartment
      ? `${listing.location_apartment} тоот`
      : '',
  ].filter(Boolean).join(', ');
  const canViewHostContact = listing.host?.can_view_private_contact || isOwner;
  const hostPhone = listing.host?.host_phone_number || listing.host?.phone;
  const amenities = listing.amenities.filter(
    (option) => option.amenity_type !== 'activity'
  );
  const activities = listing.amenities.filter(
    (option) => option.amenity_type === 'activity'
  );
  const moderationMessages: Record<string, string> = {
    pending_review: 'Энэ зар админы хяналт хүлээж байна. Батлагдсаны дараа нийтэд харагдана.',
    changes_requested: 'Энэ зарт засвар шаардлагатай байна.',
    rejected: 'Энэ зар батлагдсангүй.',
    suspended: 'Энэ зарыг түр хаасан байна.',
  };
  const moderationMessage = moderationMessages[listing.status];
  const isPublished = listing.is_active && listing.status === 'active';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {imageUrls.length > 0 ? (
          <View style={styles.gallery}>
            <FlatList
              data={imageUrls}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(url, index) => `${url}-${index}`}
              renderItem={({ item, index }) => (
                <Image
                  source={{ uri: item }}
                  style={[styles.heroImage, { width: screenWidth }]}
                  accessibilityLabel={`Байрны зураг ${index + 1}`}
                />
              )}
              getItemLayout={(_, index) => ({
                length: screenWidth,
                offset: screenWidth * index,
                index,
              })}
              onMomentumScrollEnd={handleImageScrollEnd}
            />
            {imageUrls.length > 1 ? (
              <>
                <View style={styles.imageCountBadge}>
                  <Text style={styles.imageCountText}>
                    {currentImageIndex + 1}/{imageUrls.length}
                  </Text>
                </View>
                <View style={styles.galleryDots} pointerEvents="none">
                  {imageUrls.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.galleryDot,
                        index === currentImageIndex && styles.galleryDotActive,
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : (
          <View style={styles.heroPlaceholder} />
        )}

        <View style={styles.body}>
          {moderationMessage ? (
            <View style={styles.moderationBanner}>
              <Text style={styles.moderationTitle}>{moderationMessage}</Text>
              {listing.review_notes ? (
                <Text style={styles.moderationNotes}>
                  Админы тайлбар: {listing.review_notes}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <ThemedText type="title" style={{ flex: 1 }}>{listing.title}</ThemedText>
              {isOwner ? (
                <View style={styles.ownerActions}>
                  <Pressable
                    onPress={() => router.push(`/edit-listing/${id}` as unknown as Href)}
                    style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}>
                    <Text style={styles.actionBtnText}>✏️ Засах</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDelete}
                    style={[styles.actionBtn, { backgroundColor: '#DC2626' }]}>
                    <Text style={styles.actionBtnText}>🗑 Устгах</Text>
                  </Pressable>
                </View>
              ) : isLoggedIn && isPublished ? (
                <Pressable onPress={handleFavorite} style={styles.favoriteBtn}>
                  <Text style={{ fontSize: 26 }}>{isFavorited ? '❤️' : '🤍'}</Text>
                </Pressable>
              ) : null}
            </View>
            <ThemedText themeColor="textSecondary">
              {visibleLocation}
              {!canViewPrivateLocation
                ? ' (байр, тоот захиалга баталгаажсаны дараа харагдана)'
                : ''}
            </ThemedText>
            <ThemedText type="subtitle">
              ₮{Number(listing.price_per_night).toLocaleString()} / хоног
            </ThemedText>
          </View>

          <View style={styles.statsRow}>
            <InfoPill label={`${listing.max_guests} зочин`} />
            <InfoPill label={`${listing.beds} ор`} />
            {listing.average_rating ? <InfoPill label={`${listing.average_rating} үнэлгээ`} /> : null}
          </View>

          {(isOwner || isPublished) && (
          <View style={[styles.bookingPanel, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}>
            <ThemedText type="smallBold">
              {isOwner ? 'Боломжит огноо' : 'Захиалах өдөр сонгох'}
            </ThemedText>

            {/* Огноо сонгох хэсэг – зөвхөн зочиндод */}
            {!isOwner && (
              <View style={styles.dateSummaryRow}>
                <View style={styles.dateSummaryCell}>
                  <ThemedText type="small" themeColor="textSecondary">Орох · {CHECK_IN_TIME}</ThemedText>
                  <ThemedText type="smallBold" style={checkIn ? {} : { opacity: 0.4 }}>
                    {checkIn || '—'}
                  </ThemedText>
                </View>
                <View style={styles.dateSummaryArrow}>
                  <ThemedText themeColor="textSecondary">→</ThemedText>
                </View>
                <View style={styles.dateSummaryCell}>
                  <ThemedText type="small" themeColor="textSecondary">Гарах · {CHECK_OUT_TIME}</ThemedText>
                  <ThemedText type="smallBold" style={normalizedCheckOut ? {} : { opacity: 0.4 }}>
                    {normalizedCheckOut || '—'}
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Calendar – бүхний харагдана */}
            <CalendarPicker
              checkIn={isOwner ? '' : checkIn}
              checkOut={isOwner ? '' : checkOut}
              normalizedCheckOut={isOwner ? '' : normalizedCheckOut}
              availableDates={availableDates}
              onSetCheckIn={isOwner ? () => {} : setCheckIn}
              onSetCheckOut={isOwner ? () => {} : setCheckOut}
              onReset={isOwner ? () => {} : () => { setCheckIn(''); setCheckOut(''); }}
            />

            {/* Захиалах товч – зөвхөн зочиндод */}
            {!isOwner ? (
              <>
                {selectedNights.length > 0 ? (
                  <View style={styles.priceSummary}>
                    <ThemedText type="small">
                      {selectedNights.length} хоног × ₮
                      {Number(listing.price_per_night).toLocaleString('mn-MN')} =
                    </ThemedText>
                    <ThemedText type="smallBold">₮{totalPrice.toLocaleString('mn-MN')}</ThemedText>
                  </View>
                ) : null}

                <Pressable onPress={handleContinueToCheckout} style={styles.continueButton}>
                  <ThemedText type="smallBold" style={styles.continueButtonText}>
                    Захиалга үргэлжлүүлэх
                  </ThemedText>
                </Pressable>

                {bookingMessage ? (
                  <ThemedText type="small" style={styles.errorText}>
                    {bookingMessage}
                  </ThemedText>
                ) : null}
              </>
            ) : (
              <View style={styles.ownerCalendarNote}>
                <ThemedText type="small" themeColor="textSecondary">
                  Та өөрийн зарыг захиалах боломжгүй
                </ThemedText>
              </View>
            )}
          </View>
          )}

          <View style={styles.section}>
            <ThemedText type="smallBold">Тайлбар</ThemedText>
            <ThemedText themeColor="textSecondary">{listing.description}</ThemedText>
          </View>

          {listing.amenities.length > 0 ? (
            <View style={styles.section}>
              {amenities.length > 0 ? (
                <View style={styles.amenityGroup}>
                  <ThemedText type="smallBold">Тохижилт, үйлчилгээ</ThemedText>
                  <View style={styles.amenities}>
                    {amenities.map((option) => (
                      <InfoPill key={option.id} label={option.name} />
                    ))}
                  </View>
                </View>
              ) : null}
              {activities.length > 0 ? (
                <View style={styles.amenityGroup}>
                  <ThemedText type="smallBold">Үйл ажиллагаа</ThemedText>
                  <View style={styles.amenities}>
                    {activities.map((option) => (
                      <InfoPill key={option.id} label={option.name} />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {listing.location_lat != null && listing.location_lng != null ? (
            <View style={styles.section}>
              <ThemedText type="smallBold">Байршил</ThemedText>
              <View style={styles.mapContainer}>
                <MapView
                  mapType="none"
                  style={styles.map}
                  initialRegion={{
                    latitude: listing.location_lat,
                    longitude: listing.location_lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={true}
                  zoomEnabled={true}
                  pitchEnabled={false}
                  rotateEnabled={false}>
                  <UrlTile
                    urlTemplate={`https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`}
                    maximumZ={19}
                    flipY={false}
                    tileSize={256}
                    zIndex={0}
                  />
                  <Marker
                    coordinate={{
                      latitude: listing.location_lat,
                      longitude: listing.location_lng,
                    }}
                    title={listing.title}
                    description={[listing.location_city, listing.location_district].filter(Boolean).join(', ')}
                    pinColor="#16A34A"
                  />
                </MapView>
              </View>
            </View>
          ) : null}

          {listing.host_username ? (
            <View style={styles.section}>
              <ThemedText type="smallBold">Түрээслүүлэгч</ThemedText>
              <ThemedText themeColor="textSecondary">{listing.host_username}</ThemedText>
              {canViewHostContact ? (
                <>
                  {hostPhone ? (
                    <ThemedText selectable themeColor="textSecondary">Утас: {hostPhone}</ThemedText>
                  ) : null}
                  {listing.host?.email ? (
                    <ThemedText selectable themeColor="textSecondary">Имэйл: {listing.host.email}</ThemedText>
                  ) : null}
                </>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Утас, имэйл захиалга баталгаажсаны дараа харагдана.
                </ThemedText>
              )}
            </View>
          ) : null}

          {/* ── Сэтгэгдэл ── */}
          <View style={styles.section}>
            <ThemedText type="smallBold">Сэтгэгдлүүд ({reviews.length})</ThemedText>

            {/* Star rating input */}
            {canReview && (
              <View style={styles.reviewForm}>
                <View style={styles.starRow}>
                  {[1,2,3,4,5].map((s) => (
                    <Pressable key={s} onPress={() => setReviewRating(s)}>
                      <ThemedText style={[styles.star, { color: s <= reviewRating ? '#F59E0B' : '#D1D5DB' }]}>★</ThemedText>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Сэтгэгдлээ бичнэ үү..."
                  placeholderTextColor={C.textSecondary}
                  multiline
                  numberOfLines={3}
                  style={[styles.reviewInput, { backgroundColor: C.backgroundElement, color: C.text, borderColor: C.backgroundSelected }]}
                />
                <Pressable
                  onPress={handleSubmitReview}
                  disabled={submittingReview}
                  style={[styles.reviewSubmitBtn, { opacity: submittingReview ? 0.6 : 1 }]}>
                  <ThemedText style={styles.reviewSubmitText}>
                    {submittingReview ? 'Илгээж байна...' : 'Сэтгэгдэл илгээх'}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {reviews.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={{ marginTop: 8 }}>Одоохондоо сэтгэгдэл байхгүй байна.</ThemedText>
            ) : (
              reviews.map((r) => (
                <View key={r.id} style={[styles.reviewCard, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}>
                  <View style={styles.reviewCardHeader}>
                    <ThemedText type="smallBold">{r.guest_username}</ThemedText>
                    <ThemedText style={styles.reviewStars}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary" type="small">{r.comment}</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small" style={{ marginTop: 4, fontSize: 12 }}>
                    {new Date(r.created_at).toLocaleDateString('mn-MN')}
                  </ThemedText>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function InfoPill({ label }: { label: string }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const C = Colors[scheme];
  return (
    <View style={[styles.pill, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}>
      <ThemedText type="small">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  content: {
    paddingBottom: Spacing.five,
  },
  gallery: {
    position: 'relative',
  },
  heroImage: {
    height: 280,
    backgroundColor: '#DDE7DF',
  },
  imageCountBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    minWidth: 48,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  imageCountText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  galleryDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  galleryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
  },
  galleryDotActive: {
    width: 20,
    backgroundColor: '#FFFFFF',
  },
  heroPlaceholder: {
    height: 280,
    backgroundColor: '#DDE7DF',
  },
  body: {
    gap: Spacing.four,
    padding: Spacing.three,
  },
  moderationBanner: {
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    padding: Spacing.three,
    gap: 4,
  },
  moderationTitle: { color: '#78350F', fontSize: 14, fontWeight: '700' },
  moderationNotes: { color: '#92400E', fontSize: 13 },
  header: {
    gap: Spacing.two,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D7DAE0',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  bookingPanel: {
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
  },
  dateSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dateSummaryCell: {
    flex: 1,
    gap: 2,
  },
  dateSummaryArrow: {
    paddingHorizontal: 4,
  },
  priceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  continueButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#16A34A',
    paddingHorizontal: Spacing.three,
  },
  continueButtonText: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#DC2626',
  },
  amenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  amenityGroup: { gap: Spacing.two },
  pill: {
    borderWidth: 1,
    borderColor: '#E1E4EA',
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexShrink: 0,
    marginTop: 4,
  },
  actionBtn: {
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  favoriteBtn: {
    padding: 4,
    marginTop: 2,
  },
  ownerCalendarNote: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  reviewForm: {
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 4,
  },
  star: {
    fontSize: 32,
  },
  reviewInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reviewSubmitBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reviewSubmitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  reviewCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewStars: {
    color: '#F59E0B',
    fontSize: 14,
  },
});
