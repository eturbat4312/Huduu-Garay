// 📄 app/checkout/page.tsx

"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const listingId = searchParams.get("listing");
  const checkIn = searchParams.get("check_in");
  const checkOut = searchParams.get("check_out");

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [accepted, setAccepted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await api.get(`/listings/${listingId}/`);
        setListing(res.data);
      } catch (err) {
        setErrorMsg("Зар олдсонгүй.");
      } finally {
        setLoading(false);
      }
    };

    if (listingId) fetchListing();
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

  const handleConfirmBooking = async () => {
    if (!accepted) {
      setErrorMsg("Нөхцлийг зөвшөөрнө үү.");
      return;
    }
    if (!name || !phone) {
      setErrorMsg("Нэр болон утасны дугаараа бөглөнө үү.");
      return;
    }

    try {
      const payload = {
        listing_id: listingId,
        check_in: checkIn,
        check_out: checkOut,
        full_name: name,
        phone_number: phone,
        notes: notes,
        guest_count: guestCount, // ✅ энэ мөрийг нэмсэн
      };

      await api.post("/bookings/", payload);

      setSuccessMsg("✅ Захиалга амжилттай баталгаажлаа!");
      setErrorMsg("");

      router.push(
        `/booking-success?listing=${listingId}&check_in=${checkIn}&check_out=${checkOut}`
      );
    } catch (err: any) {
      console.error("Booking error:", err);
      setErrorMsg(err?.response?.data?.error || "⚠️ Захиалга амжилтгүй.");
    }
  };

  if (loading) return <div className="p-6">Ачааллаж байна...</div>;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-green-700">Захиалгын хуудас</h1>

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}
      {successMsg && <p className="text-green-600">{successMsg}</p>}

      {listing && (
        <div className="border rounded p-4 bg-white shadow space-y-4">
          <h2 className="text-xl font-semibold">{listing.title}</h2>
          <p>📍 Байршил: {listing.location_text}</p>
          <p>
            📅 {checkIn} → {checkOut} ({totalNights} шөнө)
          </p>
          <p>
            💰 Үнэ: ₮{Number(listing.price_per_night).toLocaleString()} ×{" "}
            {totalNights} =
            <strong className="text-green-700">
              {" "}
              ₮{totalPrice.toLocaleString()}
            </strong>
          </p>

          <label className="block text-sm mt-4">👥 Зочдын тоо</label>
          <input
            type="number"
            min={1}
            max={listing.max_guests || 10}
            value={guestCount}
            onChange={(e) => setGuestCount(Number(e.target.value))}
            className="w-full border rounded px-2 py-1"
          />

          <label className="block text-sm mt-4">👤 Нэр</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />

          <label className="block text-sm mt-4">📧 Имэйл</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />

          <label className="block text-sm mt-4">📱 Утас</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />

          <label className="block text-sm mt-4">📝 Тайлбар</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />

          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mr-2"
              />
              Нөхцөлүүдийг зөвшөөрч байна
            </label>
          </div>

          <button
            onClick={handleConfirmBooking}
            className="bg-green-600 hover:bg-green-700 text-white w-full py-2 rounded mt-4"
          >
            ✅ Баталгаажуулах
          </button>
        </div>
      )}
    </main>
  );
}
