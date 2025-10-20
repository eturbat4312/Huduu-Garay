// filename: src/components/CheckoutContent.tsx
"use client";

import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api from "@/lib/axios";
import { t } from "@/lib/i18n";
import { Listing } from "@/types";
import axios from "axios";

// Local YYYY-MM-DD (no TZ shift)
const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const localeMap: Record<string, string> = {
  mn: "mn-MN",
  en: "en-US",
  fr: "fr-FR",
};

export default function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale: rawLocale } = useParams();
  const locale = (typeof rawLocale === "string" ? rawLocale : "mn") as string;
  const uiLocale = localeMap[locale] || "mn-MN";

  const nf = useMemo(() => new Intl.NumberFormat(uiLocale), [uiLocale]);
  const df = useMemo(
    () =>
      new Intl.DateTimeFormat(uiLocale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [uiLocale]
  );

  const rawCheckInTs = searchParams.get("check_in_ts");
  const rawCheckOutTs = searchParams.get("check_out_ts");
  const listingId = searchParams.get("listing");

  const checkInDate = useMemo(
    () => (rawCheckInTs ? new Date(Number(rawCheckInTs)) : null),
    [rawCheckInTs]
  );
  const checkOutDate = useMemo(
    () => (rawCheckOutTs ? new Date(Number(rawCheckOutTs)) : null),
    [rawCheckOutTs]
  );

  // If single-day selection, bump checkout +1 day
  const displayCheckOutDate: Date | null = useMemo(() => {
    if (!checkInDate || !checkOutDate) return null;
    if (checkInDate.getTime() === checkOutDate.getTime()) {
      return new Date(checkOutDate.getTime() + 86400000);
    }
    return checkOutDate;
  }, [checkInDate, checkOutDate]);

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  // form fields
  const [guestCount, setGuestCount] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [accepted, setAccepted] = useState(false);

  // UX / errors
  const [bannerError, setBannerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    terms?: string;
    dates?: string;
  }>({});

  // submission control
  const [submitting, setSubmitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const attemptKeyRef = useRef<string | null>(null); // idempotency key per attempt

  useEffect(() => {
    let mounted = true;
    async function fetchListing() {
      if (!listingId || !checkInDate || !displayCheckOutDate) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get<Listing>(`/listings/${listingId}/`);
        if (!mounted) return;
        setListing(res.data);
        const max = res.data.max_guests || 10;
        setGuestCount((g) => Math.min(Math.max(g, 1), max));
      } catch (err) {
        if (!mounted) return;
        const msg = axios.isAxiosError(err)
          ? err.response?.data?.detail || t(locale, "error.listing_not_found")
          : t(locale, "error.listing_not_found");
        setBannerError(msg);
      } finally {
        mounted && setLoading(false);
      }
    }
    fetchListing();
    return () => {
      mounted = false;
      // cancel in-flight booking request (safety)
      abortRef.current?.abort();
    };
  }, [listingId, checkInDate, displayCheckOutDate, locale]);

  const totalNights = useMemo(() => {
    if (!checkInDate || !displayCheckOutDate) return 0;
    const diff = Math.ceil(
      (displayCheckOutDate.getTime() - checkInDate.getTime()) / 86400000
    );
    return Math.max(1, diff);
  }, [checkInDate, displayCheckOutDate]);

  const priceBase = listing ? totalNights * (listing.price_per_night || 0) : 0;
  const serviceFee = Math.round(priceBase * 0.1);
  const total = priceBase + serviceFee;

  const incGuests = useCallback(() => {
    const max = listing?.max_guests || 10;
    setGuestCount((g) => Math.min(g + 1, max));
  }, [listing]);
  const decGuests = useCallback(() => {
    setGuestCount((g) => Math.max(g - 1, 1));
  }, []);

  const validate = useCallback(() => {
    const next: typeof fieldErrors = {};
    if (!accepted) next.terms = t(locale, "error.accept_terms");
    if (!name.trim()) next.name = t(locale, "error.name_required");
    if (!phone.trim() || phone.trim().length < 6)
      next.phone = t(locale, "error.phone_required");
    if (!checkInDate || !displayCheckOutDate)
      next.dates = t(locale, "error.invalid_dates");
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }, [accepted, name, phone, checkInDate, displayCheckOutDate, locale]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();

      // ✅ ЯГ ИНГЭЖ бичсэнээр lint алдаа арилна
      if (submitting) {
        return;
      }

      setBannerError("");
      if (!validate()) return;
      if (!listingId || !checkInDate || !displayCheckOutDate) {
        setBannerError(t(locale, "error.invalid_dates"));
        return;
      }

      setSubmitting(true);

      // prepare abort controller & idempotency key (one per attempt)
      if (abortRef.current) {
        abortRef.current.abort(); // cancel any prior (safety)
      }
      abortRef.current = new AbortController();
      if (!attemptKeyRef.current) {
        // NOTE: Хэрэв CORS-оо зөв тохируулаагүй бол custom header-аа түр хасч болно
        attemptKeyRef.current = crypto.randomUUID();
      }

      const payload = {
        listing_id: listingId,
        check_in: toYMD(checkInDate),
        check_out: toYMD(displayCheckOutDate),
        full_name: name.trim(),
        phone_number: phone.trim(),
        notes: notes.trim(),
        guest_count: guestCount,
      };

      try {
        const res = await api.post("/bookings/", payload, {
          signal: abortRef.current.signal as AbortSignal,
          headers: {
            "X-Idempotency-Key": attemptKeyRef.current,
          },
        });
        const newId: number = res.data.id;
        router.push(`/${locale}/booking-success?booking=${newId}`);
      } catch (err) {
        if (axios.isCancel(err)) {
          // silently ignore if user navigated away / unmounted
          return;
        }
        const msg = axios.isAxiosError(err)
          ? err.response?.data?.error || t(locale, "error.booking_failed")
          : t(locale, "error.booking_failed");
        setBannerError(msg);
        // allow a NEW attempt to generate a NEW idempotency key
        attemptKeyRef.current = null;
      } finally {
        setSubmitting(false);
      }
    },
    [
      submitting,
      validate,
      listingId,
      checkInDate,
      displayCheckOutDate,
      name,
      phone,
      notes,
      guestCount,
      router,
      locale,
    ]
  );

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3 space-y-4">
            <div className="h-40 bg-gray-100 rounded animate-pulse" />
            <div className="h-40 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="md:col-span-2">
            <div className="h-56 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-green-700 mb-4">
        {t(locale, "checkout.title")}
      </h1>

      {bannerError && (
        <div className="mb-4 flex items-start justify-between rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div>{bannerError}</div>
          <button
            onClick={() => setBannerError("")}
            aria-label="Dismiss error"
            className="ml-4 hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {listing && (
        <div
          className={`grid md:grid-cols-5 gap-6 ${
            submitting ? "cursor-wait" : ""
          }`}
        >
          {/* Form */}
          <section className="md:col-span-3">
            <form
              className="rounded-2xl border bg-white p-5 shadow-sm space-y-5"
              onSubmit={handleSubmit}
              aria-busy={submitting}
            >
              <div className="text-lg font-semibold">{listing.title}</div>

              <div className="text-sm space-y-1 text-gray-700">
                <div>
                  📍 {t(locale, "location")}: {listing.location_text}
                </div>
                <div>
                  📅 {df.format(checkInDate!)} →{" "}
                  {df.format(displayCheckOutDate!)} ({totalNights}{" "}
                  {t(locale, "nights")})
                </div>
                {checkInDate &&
                  checkOutDate &&
                  checkInDate.getTime() === checkOutDate.getTime() && (
                    <div className="text-xs text-gray-500">
                      {t(locale, "info.single_day_bumps_checkout")}
                    </div>
                  )}
              </div>

              {/* Guests */}
              <label className="block text-sm font-medium">
                👥 {t(locale, "form.guest_count")}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={decGuests}
                  className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Decrease guests"
                  disabled={submitting}
                >
                  −
                </button>
                <input
                  id="guestCount"
                  aria-label={t(locale, "form.guest_count")}
                  type="number"
                  min={1}
                  max={listing.max_guests || 10}
                  value={guestCount}
                  onChange={(e) =>
                    setGuestCount(
                      Math.min(
                        Math.max(Number(e.target.value || 1), 1),
                        listing.max_guests || 10
                      )
                    )
                  }
                  className="w-20 text-center border rounded px-2 py-1 disabled:bg-gray-50"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={incGuests}
                  className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Increase guests"
                  disabled={submitting}
                >
                  +
                </button>
                <span className="text-xs text-gray-500">
                  {t(locale, "info.max_guests")}: {listing.max_guests || 10}
                </span>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium">
                  👤 {t(locale, "form.name")}
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full border rounded px-3 py-2 disabled:bg-gray-50 ${
                    fieldErrors.name ? "border-red-400" : ""
                  }`}
                  disabled={submitting}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium">
                  📱 {t(locale, "form.phone")}
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+41 79 000 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full border rounded px-3 py-2 disabled:bg-gray-50 ${
                    fieldErrors.phone ? "border-red-400" : ""
                  }`}
                  disabled={submitting}
                />
                {fieldErrors.phone && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium">
                  📝 {t(locale, "form.notes")}
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded px-3 py-2 disabled:bg-gray-50"
                  disabled={submitting}
                />
              </div>

              {/* Terms */}
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    disabled={submitting}
                  />
                  <span>
                    {t(locale, "form.accept_terms")}{" "}
                    <a
                      href={`/${locale}/terms`}
                      target="_blank"
                      className="underline text-green-700 hover:text-green-800"
                    >
                      {t(locale, "form.view_terms")}
                    </a>
                  </span>
                </label>
                {fieldErrors.terms && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.terms}
                  </p>
                )}
                {fieldErrors.dates && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.dates}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                aria-disabled={submitting}
                aria-busy={submitting}
                className="w-full rounded bg-green-600 py-2 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "⏳ " : "✅ "}
                {t(locale, "form.confirm")}
              </button>
            </form>
          </section>

          {/* Sticky summary */}
          <aside className="md:col-span-2">
            <div className="md:sticky md:top-6 rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold mb-3">
                {t(locale, "checkout.summary")}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>
                    {t(locale, "price.per_night")} × {totalNights}
                  </span>
                  <span>₮{nf.format(listing.price_per_night || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t(locale, "price.base")}</span>
                  <span>₮{nf.format(priceBase)}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {t(locale, "price.service_fee")}{" "}
                    <span className="text-gray-500">(10%)</span>
                  </span>
                  <span>₮{nf.format(serviceFee)}</span>
                </div>

                <hr className="my-2" />

                <div className="flex justify-between font-semibold text-green-700">
                  <span>{t(locale, "price.total")}</span>
                  <span>₮{nf.format(total)}</span>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500 leading-5">
                {t(locale, "info.fee_disclaimer")}
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
