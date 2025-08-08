"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useNotification } from "@/context/NotificationContext";
import Link from "next/link";
import { useParams } from "next/navigation";
import { t } from "@/lib/i18n";

type Booking = {
  id: number;
  check_in: string;
  check_out: string;
  guest_name: string;
  guest_phone: string;
  notes: string;
  is_cancelled_by_host: boolean;
  guest_count: number;
  total_price: string;
  listing: {
    title: string;
    location: string;
    thumbnail: string | null;
  };
  is_unread: boolean;
};

export default function HostBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { markBookingNotificationsAsRead } = useNotification();
  const { locale } = useParams(); // 🔥 locale-г URL-аас авна

  useEffect(() => {
    fetchBookings();
    // markBookingNotificationsAsRead();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await api.get("/host-bookings/");
      setBookings(res.data);
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {t(locale, "host_bookings.title")}
      </h1>

      {loading ? (
        <p>{t(locale, "host_bookings.loading")}</p>
      ) : bookings.length === 0 ? (
        <p>{t(locale, "host_bookings.no_bookings")}</p>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const checkIn = new Date(booking.check_in);
            const checkOut = new Date(booking.check_out);
            const nights = Math.max(
              1,
              Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86400000)
            );

            return (
              <Link
                key={booking.id}
                href={`/${locale}/host-bookings/${booking.id}`}
                className={`block border rounded-md bg-white shadow-sm hover:shadow-md transition overflow-hidden ${
                  booking.is_unread ? "border-red-500" : "border-gray-200"
                }`}
              >
                <div
                  className={`flex flex-col md:flex-row gap-4 p-4 ${
                    booking.is_cancelled_by_host ? "opacity-50" : ""
                  }`}
                >
                  {booking.listing.thumbnail ? (
                    <img
                      src={booking.listing.thumbnail}
                      alt="Thumbnail"
                      className="w-full md:w-40 h-32 object-cover rounded"
                    />
                  ) : (
                    <div className="w-full md:w-40 h-32 bg-gray-200 flex items-center justify-center text-sm text-gray-500 rounded">
                      {t(locale, "host_bookings.no_image")}
                    </div>
                  )}

                  <div className="flex-1">
                    <h2 className="text-lg font-semibold hover:underline">
                      {booking.listing.title}
                    </h2>
                    <p className="text-gray-600 mb-1">
                      📍 {booking.listing.location}
                    </p>
                    <p>
                      📅 {checkIn.toLocaleDateString()} →{" "}
                      {checkOut.toLocaleDateString()} ({nights}{" "}
                      {t(locale, "host_bookings.nights")})
                    </p>
                    <p>
                      👤 {booking.guest_name} | 📞 {booking.guest_phone} | 👥{" "}
                      {booking.guest_count} {t(locale, "host_bookings.guests")}
                    </p>

                    <p className="text-green-700 font-medium">
                      💰 {t(locale, "host_bookings.total_price")} ₮
                      {Number(booking.total_price).toLocaleString()}
                    </p>

                    {booking.notes && (
                      <p className="text-sm text-gray-600 mt-1">
                        💬 {booking.notes}
                      </p>
                    )}

                    {booking.is_cancelled_by_host && (
                      <p className="text-red-600 mt-2 font-medium">
                        ❌ {t(locale, "host_bookings.cancelled")}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
