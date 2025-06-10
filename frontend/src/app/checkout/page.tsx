// filename: src/app/checkout/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";

// ✅ Local YYYY-MM-DD formatter
const formatDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawCheckInTs = searchParams.get("check_in_ts");
  const rawCheckOutTs = searchParams.get("check_out_ts");
  const listingId = searchParams.get("listing");

  const checkInDate = rawCheckInTs ? new Date(Number(rawCheckInTs)) : null;
  const checkOutDate = rawCheckOutTs ? new Date(Number(rawCheckOutTs)) : null;

  const displayCheckOutDate: Date | null =
    checkInDate &&
    checkOutDate &&
    checkInDate.getTime() === checkOutDate.getTime()
      ? new Date(checkOutDate.getTime() + 86400000)
      : checkOutDate;

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

    if (listingId && checkInDate && checkOutDate) {
      fetchListing();
    }
  }, [listingId, checkInDate, checkOutDate]);

  const totalNights =
    checkInDate && displayCheckOutDate
      ? Math.max(
          1,
          Math.ceil(
            (displayCheckOutDate.getTime() - checkInDate.getTime()) / 86400000
          )
        )
      : 0;

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
    if (!checkInDate || !displayCheckOutDate) {
      setErrorMsg("Огноо буруу байна.");
      return;
    }

    const payload = {
      listing_id: listingId,
      check_in: formatDateString(checkInDate),
      check_out: formatDateString(displayCheckOutDate),
      full_name: name,
      phone_number: phone,
      notes: notes,
      guest_count: guestCount,
    };

    console.log("📨 Payload to backend:", payload);

    try {
      await api.post("/bookings/", payload);
      setSuccessMsg("✅ Захиалга амжилттай баталгаажлаа!");
      setErrorMsg("");
      router.push(
        `/booking-success?listing=${listingId}&check_in=${payload.check_in}&check_out=${payload.check_out}`
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
            📅 {checkInDate?.toLocaleDateString()} →{" "}
            {displayCheckOutDate?.toLocaleDateString() ?? "—"} ({totalNights}{" "}
            шөнө)
          </p>
          <p>
            💰 Үнэ: ₮{Number(listing.price_per_night).toLocaleString()} ×{" "}
            {totalNights} ={" "}
            <strong className="text-green-700">
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
