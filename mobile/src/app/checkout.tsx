import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { CHECK_IN_TIME, CHECK_OUT_TIME } from '@/constants/booking-times';
import { useAuth } from '@/context/auth';
import { loginHref } from '@/lib/auth-return';
import { ApiError, createPayment, createPaymentIntent, fetchListing } from '@/lib/api';
import { datesBetweenNights, isDateString } from '@/lib/dates';
import type { ListingDetail } from '@/types/api';

export default function CheckoutScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const C = Colors[scheme];
  const params = useLocalSearchParams<{
    listing?: string;
    check_in?: string;
    check_out?: string;
  }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const returnPath = `/checkout?listing=${encodeURIComponent(params.listing ?? '')}&check_in=${encodeURIComponent(params.check_in ?? '')}&check_out=${encodeURIComponent(params.check_out ?? '')}`;
  const routeError =
    !params.listing || !params.check_in || !params.check_out
      ? 'Захиалгын огноо эсвэл зарын дугаар дутуу байна.'
      : null;
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(!routeError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attemptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(loginHref(returnPath));
    }
  }, [authLoading, isAuthenticated, returnPath]);

  useEffect(() => {
    if (routeError || !params.listing) {
      return;
    }

    let isMounted = true;

    fetchListing(params.listing)
      .then((data) => {
        if (isMounted) {
          setListing(data);
          setGuestCount((current) => Math.min(Math.max(current, 1), data.max_guests || 10));
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Зар авахад алдаа гарлаа.');
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
  }, [params.listing, routeError]);

  const selectedNights = useMemo(() => {
    if (!params.check_in || !params.check_out) {
      return [];
    }

    if (!isDateString(params.check_in) || !isDateString(params.check_out)) {
      return [];
    }

    return datesBetweenNights(params.check_in, params.check_out);
  }, [params.check_in, params.check_out]);

  const basePrice = selectedNights.length * Number(listing?.price_per_night ?? 0);
  const serviceFee = Math.round(basePrice * 0.1);
  const guestTotal = basePrice + serviceFee;

  const updateGuestCount = (next: number) => {
    const maxGuests = listing?.max_guests || 10;
    setGuestCount(Math.min(Math.max(next, 1), maxGuests));
  };

  const validate = () => {
    if (routeError) {
      return routeError;
    }

    if (!listing) {
      return 'Зарын мэдээлэл бүрэн ачаалагдаагүй байна.';
    }

    if (selectedNights.length < 1) {
      return 'Захиалгын огноо буруу байна.';
    }

    if (!fullName.trim()) {
      return 'Овог нэрээ оруулна уу.';
    }

    if (!phoneNumber.trim() || phoneNumber.trim().length < 6) {
      return 'Утасны дугаараа зөв оруулна уу.';
    }

    if (!accepted) {
      return 'Үйлчилгээний нөхцөлийг зөвшөөрнө үү.';
    }

    return null;
  };

  const submitBooking = async () => {
    if (isSubmitting) {
      return;
    }

    if (!isAuthenticated) {
      router.replace(loginHref(returnPath));
      return;
    }

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!params.listing || !params.check_in || !params.check_out) {
      setError('Захиалгын мэдээлэл дутуу байна.');
      return;
    }

    if (!attemptKeyRef.current) {
      attemptKeyRef.current = createAttemptKey();
    }

    setError('');
    setIsSubmitting(true);

    try {
      // Step 1: Create pending booking (payment-intent)
      const intent = await createPaymentIntent(
        {
          listing_id: params.listing,
          check_in: params.check_in,
          check_out: params.check_out,
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim(),
          notes: notes.trim(),
          guest_count: guestCount,
        },
        attemptKeyRef.current,
      );

      // Step 2: Create QPay payment invoice
      const payment = await createPayment(intent.booking.id, attemptKeyRef.current);

      // Navigate to payment screen to show QR and poll status
      router.replace({
        pathname: '/payment',
        params: { payment_id: String(payment.id) },
      });
    } catch (err: unknown) {
      attemptKeyRef.current = null;

      if (err instanceof ApiError && err.status === 401) {
        router.replace(loginHref(returnPath));
      } else {
        setError(err instanceof Error ? err.message : 'Захиалга үүсгэхэд алдаа гарлаа.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !isAuthenticated || isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator />
          <ThemedText themeColor="textSecondary">Захиалгын мэдээлэл ачаалж байна</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (routeError) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ThemedText type="smallBold">Захиалга эхлүүлэх боломжгүй</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {routeError}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Захиалга</ThemedText>
          <ThemedText themeColor="textSecondary">{listing?.title}</ThemedText>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <View style={[styles.panel, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}>
          <ThemedText type="smallBold">Огноо</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {params.check_in} - {params.check_out} ({selectedNights.length} хоног)
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Орох {CHECK_IN_TIME} · Гарах {CHECK_OUT_TIME}
          </ThemedText>
        </View>

        <View style={[styles.panel, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}>
          <ThemedText type="smallBold">Зочин</ThemedText>
          <View style={styles.stepper}>
            <Pressable
              disabled={isSubmitting}
              onPress={() => updateGuestCount(guestCount - 1)}
              style={[styles.stepButton, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}>
              <ThemedText type="subtitle">-</ThemedText>
            </Pressable>
            <ThemedText type="subtitle">{guestCount}</ThemedText>
            <Pressable
              disabled={isSubmitting}
              onPress={() => updateGuestCount(guestCount + 1)}
              style={[styles.stepButton, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}>
              <ThemedText type="subtitle">+</ThemedText>
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Дээд тал: {listing?.max_guests || 10}
          </ThemedText>
        </View>

        <View style={[styles.panel, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}>
          <ThemedText type="smallBold">Холбоо барих мэдээлэл</ThemedText>
          <TextInput
            value={fullName}
            editable={!isSubmitting}
            onChangeText={setFullName}
            placeholder="Овог нэр"
            placeholderTextColor={C.textSecondary}
            style={[styles.input, { backgroundColor: C.backgroundElement, color: C.text, borderColor: C.backgroundSelected }]}
          />
          <TextInput
            value={phoneNumber}
            editable={!isSubmitting}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            placeholder="Утасны дугаар"
            placeholderTextColor={C.textSecondary}
            style={[styles.input, { backgroundColor: C.backgroundElement, color: C.text, borderColor: C.backgroundSelected }]}
          />
          <TextInput
            value={notes}
            editable={!isSubmitting}
            onChangeText={setNotes}
            placeholder="Нэмэлт тэмдэглэл"
            multiline
            style={[styles.input, styles.notesInput]}
          />
        </View>

        <View style={[styles.panel, { backgroundColor: C.backgroundElement, borderColor: C.backgroundSelected }]}>
          <ThemedText type="smallBold">Төлбөрийн дүн</ThemedText>
          <SummaryRow label={`₮${Number(listing?.price_per_night ?? 0).toLocaleString('mn-MN')} x ${selectedNights.length}`} value={basePrice} />
          <SummaryRow label="Үйлчилгээний шимтгэл 10%" value={serviceFee} />
          <View style={styles.totalRow}>
            <ThemedText type="smallBold">Нийт төлөх</ThemedText>
            <ThemedText type="subtitle">₮{guestTotal.toLocaleString('mn-MN')}</ThemedText>
          </View>
        </View>

        <View style={styles.termsRow}>
          <Switch value={accepted} disabled={isSubmitting} onValueChange={setAccepted} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.termsText}>
            Үйлчилгээний нөхцөлийг зөвшөөрч байна. (
          </ThemedText>
          <Pressable onPress={() => router.push('/terms' as never)}>
            <ThemedText type="small" style={styles.termsLink}>Харах</ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">)</ThemedText>
        </View>

        <Pressable
          disabled={isSubmitting}
          onPress={submitBooking}
          style={[styles.submitButton, isSubmitting && styles.disabledButton]}>
          <ThemedText type="smallBold" style={styles.submitButtonText}>
            {isSubmitting ? 'Илгээж байна...' : 'Захиалга баталгаажуулах'}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">₮{value.toLocaleString('mn-MN')}</ThemedText>
    </View>
  );
}

function createAttemptKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.five,
  },
  header: {
    gap: Spacing.one,
  },
  panel: {
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: Spacing.three,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#DC2626',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
  },
  notesInput: {
    minHeight: 92,
    paddingTop: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#E1E4EA',
    paddingTop: Spacing.two,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  termsLink: {
    color: '#16A34A',
    fontWeight: '600',
  },
  termsText: {
    flex: 1,
  },
  submitButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#16A34A',
    paddingHorizontal: Spacing.three,
  },
  disabledButton: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: '#FFFFFF',
  },
});
