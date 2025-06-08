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

  const getNights = () => {
    const start = new Date(checkIn || "");
    const end = new Date(checkOut || "");
    const diff = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 0;
  };

  const totalNights = getNights();
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
            📅 Огноо: {checkIn} → {checkOut} ({totalNights} шөнө)
          </p>
          <p>
            💰 Нийт үнэ: ₮
            <strong className="text-green-700">
              {totalPrice.toLocaleString()}
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
