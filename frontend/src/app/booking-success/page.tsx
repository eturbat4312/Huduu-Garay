"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const listingId = searchParams.get("listing");
  const checkIn = searchParams.get("check_in");
  const checkOut = searchParams.get("check_out");

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      if (!listingId) return;
      try {
        const res = await api.get(`/listings/${listingId}/`);
        setListing(res.data);
      } catch (err) {
        console.error("Зар авахад алдаа:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [listingId]);

  const checkInDate = checkIn ? new Date(checkIn) : null;
  const checkOutDate = checkOut ? new Date(checkOut) : null;

  const displayCheckOutDate =
    checkInDate &&
    checkOutDate &&
    checkInDate.getTime() === checkOutDate.getTime()
      ? new Date(checkOutDate.getTime() + 86400000)
      : checkOutDate;

  const totalNights =
    checkInDate && checkOutDate
      ? Math.max(
          1,
          Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / 86400000)
        )
      : 0;

  const totalPrice = listing ? totalNights * listing.price_per_night : 0;

  if (loading) return <div className="p-6">Ачааллаж байна...</div>;

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-3xl font-bold text-green-700">
        ✅ Амжилттай захиаллаа!
      </h1>
      <p className="text-gray-700">
        Таны захиалга амжилттай баталгаажлаа. Доорх мэдээллийг шалгана уу.
      </p>

      {listing && (
        <div className="border rounded p-4 bg-white shadow space-y-4">
          <h2 className="text-xl font-semibold">{listing.title}</h2>
          <p>📍 Байршил: {listing.location_text}</p>
          <p>
            📅 Огноо: {checkInDate?.toLocaleDateString()} →{" "}
            {displayCheckOutDate?.toLocaleDateString()} ({totalNights} шөнө)
          </p>
          <p>
            💰 Нийт үнэ:{" "}
            <strong className="text-green-700">
              ₮{totalPrice.toLocaleString()}
            </strong>
          </p>
        </div>
      )}

      <button
        onClick={() => router.push("/my-bookings")}
        className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
      >
        📂 Миний захиалгууд руу очих
      </button>
    </main>
  );
}
