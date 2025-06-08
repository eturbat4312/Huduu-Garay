"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Link from "next/link";

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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get("/bookings/my/");
        setBookings(res.data);
      } catch (error) {
        setErrorMsg("Захиалгуудыг авахад алдаа гарлаа.");
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  if (loading) return <p className="p-6">Ачааллаж байна...</p>;
  if (errorMsg) return <p className="p-6 text-red-600">{errorMsg}</p>;

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        Миний захиалгууд
      </h1>

      {bookings.length === 0 ? (
        <p className="text-gray-600">
          Та одоогоор ямар нэгэн захиалга хийгээгүй байна.
        </p>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="border rounded shadow flex items-center gap-4 p-4 bg-white"
            >
              {booking.listing.thumbnail ? (
                <img
                  src={booking.listing.thumbnail}
                  alt={booking.listing.title}
                  className="w-32 h-24 object-cover rounded"
                />
              ) : (
                <div className="w-32 h-24 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-sm">
                  Зураг алга
                </div>
              )}

              <div className="flex-1">
                <Link
                  href={`/listings/${booking.listing.id}`}
                  className="text-lg font-semibold text-green-700 hover:underline"
                >
                  {booking.listing.title}
                </Link>
                <p className="text-sm text-gray-600">
                  {booking.listing.location}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  🗓{" "}
                  {booking.check_in
                    ? new Date(booking.check_in).toLocaleDateString()
                    : "Огноо байхгүй"}{" "}
                  →{" "}
                  {booking.check_out
                    ? new Date(booking.check_out).toLocaleDateString()
                    : "Огноо байхгүй"}
                </p>
                <p className="text-sm text-gray-700">
                  💰{" "}
                  {typeof booking.total_price === "number"
                    ? booking.total_price.toLocaleString()
                    : "Үнэ байхгүй"}
                  ₮ – {booking.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
