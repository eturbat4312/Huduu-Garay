// Filename: src/components/BookingSuccessPage.tsx
"use client";

import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { Booking } from "@/types";

interface BookingSuccessPageProps {
  booking: Booking;
  locale: string;
}

export default function BookingSuccessPage({
  booking,
  locale,
}: BookingSuccessPageProps) {
  const router = useRouter();

  const checkIn = new Date(booking.check_in);
  const checkOut = new Date(booking.check_out);
  const displayCheckOut =
    checkIn.getTime() === checkOut.getTime()
      ? new Date(checkOut.getTime() + 86400000)
      : checkOut;

  const nights = Math.max(
    1,
    Math.ceil((displayCheckOut.getTime() - checkIn.getTime()) / 86400000)
  );

  const totalPrice = booking.total_price;
  const serviceFee = Math.floor(totalPrice * 0.1);
  const grandTotal = totalPrice + serviceFee;

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-3xl font-bold text-green-700">
        ✅ {t(locale, "booking_success")}
      </h1>
      <p className="text-gray-700">{t(locale, "booking_confirmed_details")}</p>

      <div className="bg-white rounded shadow border p-4 space-y-4">
        <div className="flex gap-4">
          {booking.listing.thumbnail ? (
            <img
              src={booking.listing.thumbnail}
              alt="listing"
              className="w-32 h-24 object-cover rounded"
            />
          ) : (
            <div className="w-32 h-24 bg-gray-100 flex items-center justify-center text-sm rounded">
              {t(locale, "no_image")}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold">{booking.listing.title}</h2>
            <p>
              📍 {t(locale, "location")}: {booking.listing.location}
            </p>
            <p>
              📅 {t(locale, "date")}: {checkIn.toLocaleDateString()} →{" "}
              {displayCheckOut.toLocaleDateString()} ({nights}{" "}
              {t(locale, "nights")})
            </p>
            <p>
              💸 {t(locale, "price_per_night")}: ₮
              {Math.floor(totalPrice / nights).toLocaleString()}
            </p>
          </div>
        </div>

        <hr />
        <div className="text-sm space-y-1">
          <p>
            👥 {t(locale, "host")}: {booking.host_name || t(locale, "unknown")}
          </p>
          <p>
            📱 {t(locale, "host_phone")}:{" "}
            {booking.host_phone || t(locale, "none")}
          </p>
        </div>

        <hr />
        <div className="text-sm space-y-1">
          <p>
            🆔 {t(locale, "booking_id")}: #{booking.id}
          </p>
          <p>
            📆 {t(locale, "booking_date")}:{" "}
            {new Date(booking.created_at).toLocaleString("mn-MN")}
          </p>
          <p>
            👤 {t(locale, "guest_name")}: {booking.full_name}
          </p>
          <p>
            📞 {t(locale, "guest_phone")}: {booking.phone_number}
          </p>
          {booking.notes && (
            <p>
              📝 {t(locale, "notes")}: {booking.notes}
            </p>
          )}
        </div>

        <hr />
        <div className="text-sm space-y-1">
          <p>
            💵 {t(locale, "booking_total")}: ₮{totalPrice.toLocaleString()}
          </p>
          <p>
            🧾 {t(locale, "service_fee")}: ₮{serviceFee.toLocaleString()}
          </p>
          <p className="font-semibold text-blue-700">
            💳 {t(locale, "total_paid")}: ₮{grandTotal.toLocaleString()}
          </p>
        </div>
      </div>

      <button
        onClick={() => router.push(`/${locale}/my-bookings`)}
        className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
      >
        📂 {t(locale, "go_to_my_bookings")}
      </button>
    </main>
  );
}
