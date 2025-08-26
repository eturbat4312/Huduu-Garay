// filename: src/app/[locale]/bookings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { t } from "@/lib/i18n";
import Image from "next/image"; // ✅ next/image ашиглаж байна

type Booking = {
  id: number;
  check_in: string;
  check_out: string;
  total_price: number;
  status: string;
  listing: {
    id: number;
    title: string;
    location: string;
    thumbnail?: string;
  };
};

export default function MyBookingsPage() {
  const { locale } = useParams() as { locale: string };
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get("/bookings/my/");
        setBookings(res.data);
      } catch {
        setErrorMsg(t(locale, "error_fetching_bookings"));
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [locale]);

  if (loading) return <p className="p-6">{t(locale, "loading")}</p>;
  if (errorMsg) return <p className="p-6 text-red-600">{errorMsg}</p>;

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        {t(locale, "my_bookings")}
      </h1>

      {bookings.length === 0 ? (
        <p className="text-gray-600">{t(locale, "no_bookings")}</p>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => (
            <Link key={booking.id} href={`/${locale}/bookings/${booking.id}`}>
              <div className="border rounded shadow flex items-center gap-4 p-4 bg-white hover:bg-gray-50 cursor-pointer transition">
                {booking.listing.thumbnail ? (
                  <Image
                    src={booking.listing.thumbnail}
                    alt={booking.listing.title}
                    className="w-32 h-24 object-cover rounded"
                    width={128}
                    height={96}
                  />
                ) : (
                  <div className="w-32 h-24 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-sm">
                    {t(locale, "no_image")}
                  </div>
                )}

                <div className="flex-1">
                  <p className="text-lg font-semibold text-green-700">
                    {booking.listing.title}
                  </p>
                  <p className="text-sm text-gray-600">
                    {booking.listing.location}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    🗓{" "}
                    {booking.check_in
                      ? new Date(booking.check_in).toLocaleDateString()
                      : t(locale, "no_date")}{" "}
                    →{" "}
                    {booking.check_out
                      ? new Date(booking.check_out).toLocaleDateString()
                      : t(locale, "no_date")}
                  </p>
                  <p className="text-sm text-gray-700">
                    💰{" "}
                    {typeof booking.total_price === "number"
                      ? `${booking.total_price.toLocaleString()} ₮`
                      : t(locale, "no_price")}{" "}
                    – {booking.status}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
