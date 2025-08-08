"use client";

import { useSearchParams, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import BookingSuccessPage from "@/components/BookingSuccessPage";
import { t } from "@/lib/i18n";

export default function BookingSuccessWrapperPage() {
  const searchParams = useSearchParams();
  const { locale: rawLocale } = useParams();
  const locale = typeof rawLocale === "string" ? rawLocale : "mn";

  const bookingId = searchParams.get("booking");
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) return;
    const fetchBooking = async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}/`);
        setBooking(res.data);
      } catch (err) {
        console.error("❌ Захиалга авахад алдаа:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId]);

  if (loading) return <div className="p-6">{t(locale, "loading")}</div>;
  if (!booking)
    return (
      <div className="p-6 text-red-600">{t(locale, "booking_not_found")}</div>
    );

  return <BookingSuccessPage booking={booking} locale={locale} />;
}
