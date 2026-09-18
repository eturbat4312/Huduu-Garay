// filename: src/app/[locale]/host-bookings/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import { useNotification } from "@/context/NotificationContext";
import { t } from "@/lib/i18n";
import Image from "next/image";
import HostCancellationAction from "@/components/HostCancellationAction";
import type { Booking } from "@/types";

export default function HostBookingDetailPage() {
  const { id, locale } = useParams() as { id: string; locale: string };
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const { markBookingNotificationsAsRead } = useNotification();

  const fetchBooking = useCallback(async () => {
    try {
      const res = await api.get(`/host-bookings/${id}/`);
      setBooking(res.data);
    } catch (err: unknown) {
      console.error("Booking detail fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBooking();
    markBookingNotificationsAsRead();
  }, [fetchBooking, markBookingNotificationsAsRead]);

  if (loading)
    return <p className="p-6">{t(locale, "booking_detail.loading")}</p>;
  if (!booking)
    return <p className="p-6">{t(locale, "booking_detail.not_found")}</p>;

  const checkInDate = new Date(booking.check_in);
  const checkOutDate = new Date(booking.check_out);
  const nights = Math.max(
    1,
    Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / 86400000)
  );
  const price = booking.listing.price_per_night || 0;
  const total = booking.total_price;
  const commission = Math.floor(total * 0.1);
  const netIncome = total - commission;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">
        {t(locale, "booking_detail.title")}
      </h1>

      <div className="bg-white rounded shadow p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {booking.listing.thumbnail ? (
            <Image
              src={booking.listing.thumbnail}
              alt="Зарын зураг"
              width={192}
              height={128}
              className="w-full md:w-48 h-32 object-cover rounded"
            />
          ) : (
            <div className="w-full md:w-48 h-32 bg-gray-200 flex items-center justify-center text-sm text-gray-500 rounded">
              {t(locale, "booking_detail.no_image")}
            </div>
          )}

          <div className="flex-1">
            <h2 className="text-lg font-semibold">{booking.listing.title}</h2>
            <p className="text-gray-600">
              {[booking.listing.location_city, booking.listing.location_district]
                .filter(Boolean).join(", ") || booking.listing.location}
            </p>
            <p className="mt-1">
              💰 {t(locale, "booking_detail.price_per_night")}:{" "}
              <span className="font-medium">{price.toLocaleString()}₮</span>
            </p>
          </div>
        </div>

        <hr />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p>📅 Check-in: {booking.check_in}</p>
            <p>📅 Check-out: {booking.check_out}</p>
            <p>
              🛏 {t(locale, "booking_detail.nights")}: {nights}
            </p>
          </div>

          <div>
            <p>
              👤 {t(locale, "booking_detail.guest_name")}: {booking.guest_name}
            </p>
            <p>
              📞 {t(locale, "booking_detail.guest_phone")}:{" "}
              <a
                href={`tel:${booking.guest_phone}`}
                className="text-blue-600 underline"
              >
                {booking.guest_phone}
              </a>
            </p>
            <p>
              👥 {t(locale, "booking_detail.guest_count")}:{" "}
              {booking.guest_count}
            </p>
          </div>
        </div>

        {booking.notes && (
          <div className="bg-gray-100 p-3 rounded text-sm text-gray-700">
            💬 {t(locale, "booking_detail.notes")}: {booking.notes}
          </div>
        )}

        <hr />

        <div className="space-y-1 text-sm">
          <p>
            💵 {t(locale, "booking_detail.total")}: {total.toLocaleString()}₮
          </p>
          <p>
            💸 {t(locale, "booking_detail.commission")}:{" "}
            {commission.toLocaleString()}₮
          </p>
          <p className="font-semibold text-green-700">
            ✅ {t(locale, "booking_detail.net_income")}:{" "}
            {booking.guest_cancelled_at ? "Гараар шийдвэрлэнэ" : booking.is_cancelled_by_host ? "0₮" : `${netIncome.toLocaleString()}₮`}
          </p>
        </div>

        <div className="flex gap-4 mt-4">
          <HostCancellationAction booking={booking} locale={locale} onChange={setBooking} />

          <a
            href={`tel:${booking.guest_phone}`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            📞 {t(locale, "booking_detail.call_button")}
          </a>
        </div>

        {booking.guest_cancelled_at && (
          <p className="mt-4 text-sm text-red-700">
            Зочин захиалгаа цуцалсан. Төлбөрийн буцаалт болон танд олгох дүнг манай ажилтан гараар хянан шийдвэрлэнэ.
          </p>
        )}
        {booking.is_cancelled_by_host && (
          <div className="mt-4 space-y-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-medium">
              Та энэ захиалгыг цуцалсан. Зочинд 100% буцаалт олгох бөгөөд танд олгох төлбөр 0 байна.
            </p>
            <p>Буцаан олголтыг манай ажилтан гараар хянан шийдвэрлэнэ.</p>
            {booking.host_cancellation_reason && <p>Шалтгаан: {booking.host_cancellation_reason}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
