// Filename: src/components/BookingSuccessPage.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { Booking } from "@/types";
import GuestCancellationAction from "@/components/GuestCancellationAction";
import { CHECK_IN_TIME, CHECK_OUT_TIME } from "@/lib/bookingTimes";

interface BookingSuccessPageProps {
  booking: Booking;
  locale: string;
}

export default function BookingSuccessPage({
  booking: initialBooking,
  locale,
}: BookingSuccessPageProps) {
  const router = useRouter();
  const [booking, setBooking] = useState(initialBooking);
  useEffect(() => setBooking(initialBooking), [initialBooking]);
  const cancelled = booking.status === "cancelled" || booking.is_cancelled_by_host;
  const confirmed = booking.status === "confirmed" && !cancelled;

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
  const serviceFee = booking.service_fee;
  const grandTotal = totalPrice + serviceFee;
  const listingAddress = [
    booking.listing.location_city,
    booking.listing.location_district,
    booking.listing.location_khoroo,
    booking.listing.location_extra,
    booking.listing.location_building,
    booking.listing.location_apartment
      ? `${booking.listing.location_apartment} тоот`
      : "",
  ].filter(Boolean).join(", ");

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <h1 className={`text-2xl font-bold ${cancelled ? "text-red-700" : "text-green-700"}`}>
        {cancelled ? "Захиалга цуцлагдлаа" : confirmed ? t(locale, "booking_success") : "Захиалгын дэлгэрэнгүй"}
      </h1>
      {cancelled ? (
        <div role="status" className="space-y-2 text-gray-700">
          <p>
            {booking.guest_cancelled_at
              ? "Та захиалгаа цуцалсан байна. Төлбөрийн буцаалтыг манай ажилтан нөхцөлийн дагуу гараар хянан шийдвэрлэнэ."
              : "Түрээслүүлэгч захиалгыг цуцалсан байна. Таны төлсөн нийт дүнгийн 100%-ийг буцаан олгоно. Буцаан олголтыг манай ажилтан гараар хянан шийдвэрлэнэ."}
          </p>
          {booking.is_cancelled_by_host && booking.host_cancellation_reason && (
            <p>Цуцалсан шалтгаан: {booking.host_cancellation_reason}</p>
          )}
        </div>
      ) : confirmed ? <p className="text-gray-700">{t(locale, "booking_confirmed_details")}</p> : null}

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
              📍 {t(locale, "location")}: {listingAddress || booking.listing.location}
            </p>
            <p>
              📅 {t(locale, "date")}: {checkIn.toLocaleDateString()} →{" "}
              {displayCheckOut.toLocaleDateString()} ({nights}{" "}
              {t(locale, "nights")})
            </p>
            <p>Орох {CHECK_IN_TIME} · Гарах {CHECK_OUT_TIME}</p>
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
            {booking.host_phone || (confirmed
              ? t(locale, "none")
              : "Захиалга баталгаажсаны дараа харагдана")}
          </p>
          {booking.host_email && <p>✉️ Имэйл: {booking.host_email}</p>}
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
            Нийт төлбөр: ₮{grandTotal.toLocaleString()}
          </p>
        </div>
      </div>

      <GuestCancellationAction booking={booking} locale={locale} onChange={setBooking} />

      <button
        onClick={() => router.push(`/${locale}/bookings`)}
        className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
      >
        📂 {t(locale, "go_to_my_bookings")}
      </button>
    </main>
  );
}
