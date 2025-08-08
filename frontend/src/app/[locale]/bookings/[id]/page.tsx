"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import BookingSuccessPage from "@/components/BookingSuccessPage";
import { t } from "@/lib/i18n";

export default function BookingDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const locale = params?.locale as string;
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/bookings/${id}/`).then((res) => {
      setBooking(res.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-6">⏳ {t(locale, "loading")}</div>;
  if (!booking)
    return (
      <div className="p-6 text-red-600">
        ❌ {t(locale, "booking_not_found")}
      </div>
    );

  return <BookingSuccessPage booking={booking} locale={locale} />;
}
