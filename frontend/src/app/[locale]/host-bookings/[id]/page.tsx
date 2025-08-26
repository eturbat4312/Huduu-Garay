// filename: src/app/[locale]/host-bookings/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import { useNotification } from "@/context/NotificationContext";
import { t } from "@/lib/i18n";
import Image from "next/image";

type BookingDetail = {
  id: number;
  check_in: string;
  check_out: string;
  guest_name: string;
  guest_phone: string;
  notes: string;
  is_cancelled_by_host: boolean;
  guest_count: number;
  listing: {
    title: string;
    location: string;
    price_per_night: number;
    thumbnail: string | null;
  };
};

export default function HostBookingDetailPage() {
  const { id, locale } = useParams() as { id: string; locale: string };
  const [booking, setBooking] = useState<BookingDetail | null>(null);
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

  const handleCancel = async () => {
    if (!booking) return;
    const confirm = window.confirm(t(locale, "booking_detail.cancel_confirm"));
    if (!confirm) return;

    try {
      await api.post(`/bookings/${booking.id}/host-cancel/`);
      fetchBooking();
    } catch (err: unknown) {
      console.error("Cancel booking error:", err);
    }
  };

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
  const total = price * nights;
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
              alt="Thumbnail"
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
            <p className="text-gray-600">{booking.listing.location}</p>
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
            {netIncome.toLocaleString()}₮
          </p>
        </div>

        <div className="flex gap-4 mt-4">
          {!booking.is_cancelled_by_host && (
            <button
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              {t(locale, "booking_detail.cancel_button")}
            </button>
          )}

          <a
            href={`tel:${booking.guest_phone}`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            📞 {t(locale, "booking_detail.call_button")}
          </a>
        </div>

        {booking.is_cancelled_by_host && (
          <p className="mt-4 text-red-600 font-medium">
            ❌ {t(locale, "booking_detail.cancelled_msg")}
          </p>
        )}
      </div>
    </div>
  );
}
