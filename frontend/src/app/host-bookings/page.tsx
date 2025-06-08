// 📄 app/host-bookings/page.tsx

"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

type Booking = {
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
    thumbnail: string | null;
  };
};

export default function HostBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
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

  const handleCancel = async (bookingId: number) => {
    const confirm = window.confirm(
      "Та энэ захиалгыг цуцлахдаа итгэлтэй байна уу?"
    );
    if (!confirm) return;

    try {
      await api.post(`/bookings/${bookingId}/host-cancel/`);
      fetchBookings(); // дахин шинэчилнэ
    } catch (err) {
      console.error("Cancel error:", err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Миний захиалгууд (Хост)</h1>

      {loading ? (
        <p>Уншиж байна...</p>
      ) : bookings.length === 0 ? (
        <p>Таний зар дээр одоогоор захиалга алга байна.</p>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className={`p-4 border rounded-md bg-white shadow-sm flex flex-col md:flex-row gap-4 ${
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
                  No image
                </div>
              )}

              <div className="flex-1">
                <h2 className="text-lg font-semibold">
                  {booking.listing.title}
                </h2>
                <p className="text-gray-600 mb-1">{booking.listing.location}</p>
                <p>
                  📅 {booking.check_in} → {booking.check_out}
                </p>
                <p>
                  👤 {booking.guest_name} | 📞 {booking.guest_phone} | 👥{" "}
                  {booking.guest_count} хүн
                </p>

                {booking.notes && (
                  <p className="text-sm text-gray-600 mt-1">
                    💬 {booking.notes}
                  </p>
                )}

                {booking.is_cancelled_by_host ? (
                  <p className="text-red-600 mt-2 font-medium">
                    ❌ Захиалгыг цуцалсан
                  </p>
                ) : (
                  <button
                    onClick={() => handleCancel(booking.id)}
                    className="mt-3 bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded"
                  >
                    Цуцлах
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
