// filename: src/components/CheckoutContent.tsx
"use client";

import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import api from "@/lib/axios";
import { t } from "@/lib/i18n";
import { Listing } from "@/types";
import axios from "axios";

// ✅ Local YYYY-MM-DD formatter
const formatDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export default function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale } = useParams();

  const rawCheckInTs = searchParams.get("check_in_ts");
  const rawCheckOutTs = searchParams.get("check_out_ts");
  const listingId = searchParams.get("listing");

  // ✅ useMemo ашиглаж dependency warning арилгав
  const checkInDate = useMemo(
    () => (rawCheckInTs ? new Date(Number(rawCheckInTs)) : null),
    [rawCheckInTs]
  );
  const checkOutDate = useMemo(
    () => (rawCheckOutTs ? new Date(Number(rawCheckOutTs)) : null),
    [rawCheckOutTs]
  );

  const displayCheckOutDate: Date | null =
    checkInDate &&
    checkOutDate &&
    checkInDate.getTime() === checkOutDate.getTime()
      ? new Date(checkOutDate.getTime() + 86400000)
      : checkOutDate;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!hasFetched && listingId && checkInDate && checkOutDate) {
      const fetchListing = async () => {
        try {
          const res = await api.get<Listing>(`/listings/${listingId}/`);
          setListing(res.data);
          setHasFetched(true);
        } catch (err: unknown) {
          if (axios.isAxiosError(err)) {
            setErrorMsg(
              err.response?.data?.detail || t(locale, "error.listing_not_found")
            );
          } else {
            setErrorMsg(t(locale, "error.listing_not_found"));
          }
        } finally {
          setLoading(false);
        }
      };
      fetchListing();
    }
  }, [listingId, checkInDate, checkOutDate, hasFetched, locale]);

  const totalNights =
    checkInDate && displayCheckOutDate
      ? Math.max(
          1,
          Math.ceil(
            (displayCheckOutDate.getTime() - checkInDate.getTime()) / 86400000
          )
        )
      : 0;

  const totalPrice = listing ? totalNights * listing.price_per_night : 0;
  const serviceFee = Math.round(totalPrice * 0.1);
  const totalWithFee = totalPrice + serviceFee;

  const handleConfirmBooking = async () => {
    if (!accepted) {
      setErrorMsg(t(locale, "error.accept_terms"));
      return;
    }
    if (!name || !phone) {
      setErrorMsg(t(locale, "error.name_phone_required"));
      return;
    }
    if (!checkInDate || !displayCheckOutDate) {
      setErrorMsg(t(locale, "error.invalid_dates"));
      return;
    }

    const payload = {
      listing_id: listingId,
      check_in: formatDateString(checkInDate),
      check_out: formatDateString(displayCheckOutDate),
      full_name: name,
      phone_number: phone,
      notes: notes,
      guest_count: guestCount,
    };

    try {
      const res = await api.post("/bookings/", payload);
      const newBookingId: number = res.data.id;
      setSuccessMsg(t(locale, "success.booking_confirmed"));
      setErrorMsg("");
      router.push(`/${locale}/booking-success?booking=${newBookingId}`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMsg(
          err.response?.data?.error || t(locale, "error.booking_failed")
        );
      } else {
        setErrorMsg(t(locale, "error.booking_failed"));
      }
    }
  };

  if (loading) return <div className="p-6">{t(locale, "loading")}</div>;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-green-700">
        {t(locale, "checkout.title")}
      </h1>

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}
      {successMsg && <p className="text-green-600">{successMsg}</p>}

      {listing && (
        <div className="border rounded p-4 bg-white shadow space-y-4">
          <h2 className="text-xl font-semibold">{listing.title}</h2>
          <p>
            📍 {t(locale, "location")}: {listing.location_text}
          </p>
          <p>
            📅 {checkInDate?.toLocaleDateString()} →{" "}
            {displayCheckOutDate?.toLocaleDateString() ?? "—"} ({totalNights}{" "}
            {t(locale, "nights")})
          </p>
          <p>
            💰 {t(locale, "price.base")}: ₮{totalPrice.toLocaleString()}
          </p>
          <p>
            💼 {t(locale, "price.service_fee")}: ₮{serviceFee.toLocaleString()}
          </p>
          <p>
            💵 {t(locale, "price.total")}:{" "}
            <strong className="text-green-700">
              ₮{totalWithFee.toLocaleString()}
            </strong>
          </p>

          <label className="block text-sm mt-4">
            👥 {t(locale, "form.guest_count")}
          </label>
          <input
            type="number"
            min={1}
            max={listing.max_guests || 10}
            value={guestCount}
            onChange={(e) => setGuestCount(Number(e.target.value))}
            className="w-full border rounded px-2 py-1"
          />

          <label className="block text-sm mt-4">
            👤 {t(locale, "form.name")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />

          <label className="block text-sm mt-4">
            📱 {t(locale, "form.phone")}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />

          <label className="block text-sm mt-4">
            📝 {t(locale, "form.notes")}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />

          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mr-2"
              />
              {t(locale, "form.accept_terms")}
            </label>
          </div>

          <button
            onClick={handleConfirmBooking}
            className="bg-green-600 hover:bg-green-700 text-white w-full py-2 rounded mt-4"
          >
            ✅ {t(locale, "form.confirm")}
          </button>
        </div>
      )}
    </main>
  );
}
