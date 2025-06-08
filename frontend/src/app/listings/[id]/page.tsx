// Filename: app/listings/[id]/page.tsx

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";

export default function ListingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [listing, setListing] = useState<any>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteId, setFavoriteId] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [bookingMessage, setBookingMessage] = useState("");

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await api.get(`/listings/${id}/`);
        setListing(res.data);
        setIsFavorited(res.data.is_favorited || false);
        setFavoriteId(res.data.favorite_id || null);

        const availabilityRes = await api.get(`/availability/?listing=${id}`);
        const dates = availabilityRes.data
          .filter((a: any) => String(a.listing) === String(id))
          .map((a: any) => new Date(a.date));
        setAvailableDates(dates);
      } catch (error) {
        console.error("Алдаа:", error);
      }
    };
    fetchListing();
  }, [id]);

  const images: string[] =
    listing?.images?.map((img: any) =>
      typeof img === "string" ? img : img.image
    ) || [];

  const formatter = (date: Date) => date.toLocaleDateString("mn-MN");

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImageIndex((prev) => (prev && prev > 0 ? prev - 1 : prev));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImageIndex((prev) =>
      prev !== null && prev < images.length - 1 ? prev + 1 : prev
    );
  };

  const toggleFavorite = async () => {
    try {
      if (isFavorited && favoriteId) {
        await api.delete(`/favorites/${favoriteId}/`);
        setIsFavorited(false);
        setFavoriteId(null);
      } else {
        const res = await api.post("/favorites/", { listing_id: id });
        setIsFavorited(true);
        setFavoriteId(res.data.id);
      }
    } catch (err) {
      console.error("Favorite toggle алдаа:", err);
    }
  };

  const isDateAvailable = (date: Date) => {
    return availableDates.some(
      (availableDate) => availableDate.toDateString() === date.toDateString()
    );
  };

  const isRangeValid = (range: DateRange) => {
    if (!range.from || !range.to) return true;

    const datesBetween: Date[] = [];
    let date = new Date(range.from);

    while (date <= range.to) {
      datesBetween.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }

    return datesBetween.every(isDateAvailable);
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (!range) {
      setSelectedRange(undefined);
      setBookingMessage("");
      return;
    }

    if (range.from && range.to) {
      if (isRangeValid(range)) {
        setSelectedRange(range);
        setBookingMessage("");
      } else {
        setBookingMessage("⚠️ Сонгосон огнооны зарим нь боломжгүй байна.");
        setSelectedRange(undefined);
      }
    } else {
      if (range.from && isDateAvailable(range.from)) {
        setSelectedRange(range);
        setBookingMessage("");
      } else if (range.from) {
        setBookingMessage("⚠️ Энэ огноо боломжгүй байна.");
        setSelectedRange(undefined);
      }
    }
  };

  const handleBooking = () => {
    if (!selectedRange?.from || !selectedRange?.to) {
      setBookingMessage("📅 Огноо сонгоно уу.");
      return;
    }

    const checkIn = selectedRange.from.toISOString().split("T")[0];
    const checkOut = selectedRange.to.toISOString().split("T")[0];

    router.push(
      `/checkout?listing=${id}&check_in=${checkIn}&check_out=${checkOut}`
    );
  };

  const calculateNights = () => {
    if (!selectedRange?.from || !selectedRange?.to) return 0;
    const nights =
      (selectedRange.to.getTime() - selectedRange.from.getTime()) /
      (1000 * 60 * 60 * 24);
    return nights > 0 ? nights : 0;
  };

  const totalPrice = () => {
    const nights = calculateNights();
    return nights * parseFloat(listing?.price_per_night || "0");
  };

  if (!listing) return <p className="p-6">Ачааллаж байна...</p>;

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-10">
      {/* Hero Background */}
      {images[0] && (
        <div
          className="h-[250px] md:h-[350px] w-full bg-cover bg-center rounded-xl shadow"
          style={{
            backgroundImage: `url(${
              images[0].startsWith("http")
                ? images[0]
                : `http://localhost:8000${images[0]}`
            })`,
          }}
        ></div>
      )}

      {/* Listing Content */}
      <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-green-800">{listing.title}</h1>
          <button
            onClick={toggleFavorite}
            className="text-3xl"
            title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorited ? "❤️" : "🤍"}
          </button>
        </div>

        <p className="text-gray-600">{listing.location_text}</p>

        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-thin scrollbar-thumb-gray-400">
          {images.map((img, i) => (
            <img
              key={i}
              src={img.startsWith("http") ? img : `http://localhost:8000${img}`}
              alt={`listing-img-${i}`}
              onClick={() => setSelectedImageIndex(i)}
              className="h-48 w-auto rounded-lg cursor-pointer object-cover hover:opacity-80"
            />
          ))}
        </div>

        {selectedImageIndex !== null && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
            onClick={() => setSelectedImageIndex(null)}
          >
            <button
              onClick={handlePrev}
              className="absolute left-4 text-white text-4xl px-3 py-1 bg-black/50 rounded-full hover:bg-black"
            >
              ‹
            </button>
            <img
              src={
                images[selectedImageIndex].startsWith("http")
                  ? images[selectedImageIndex]
                  : `http://localhost:8000${images[selectedImageIndex]}`
              }
              alt="selected"
              className="max-h-[80vh] max-w-[90vw] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={handleNext}
              className="absolute right-4 text-white text-4xl px-3 py-1 bg-black/50 rounded-full hover:bg-black"
            >
              ›
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 border p-4 rounded-xl bg-white shadow">
            <h2 className="text-lg font-semibold mb-2">Огноо сонгох</h2>
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={handleDateSelect}
              disabled={(date) => !isDateAvailable(date) || date < new Date()}
              modifiers={{
                available: availableDates,
                unavailable: (date) => !isDateAvailable(date),
              }}
              modifiersClassNames={{
                available: "bg-green-200 text-black",
                unavailable: "bg-gray-200 text-gray-400 line-through",
                selected: "bg-green-600 text-white",
              }}
              formatters={{ formatCaption: (month) => formatter(month) }}
            />
            <div className="mt-2 text-sm text-gray-600">
              <p>🟢 Боломжтой өдрүүд</p>
              <p>⚪ Боломжгүй өдрүүд</p>
            </div>
          </div>

          <div className="w-full md:w-80 border p-4 rounded-xl bg-white shadow">
            <h2 className="text-lg font-semibold mb-4">Захиалга өгөх</h2>

            {selectedRange?.from && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <p className="text-sm">
                  <strong>Check-in:</strong>{" "}
                  {selectedRange.from.toLocaleDateString("mn-MN")}
                </p>
                {selectedRange.to && (
                  <p className="text-sm">
                    <strong>Check-out:</strong>{" "}
                    {selectedRange.to.toLocaleDateString("mn-MN")}
                  </p>
                )}
              </div>
            )}

            {selectedRange?.from &&
              selectedRange?.to &&
              calculateNights() > 0 && (
                <p className="text-sm mb-2 text-gray-700">
                  🛏 {calculateNights()} шөнө × ₮
                  {Number(listing.price_per_night).toLocaleString()} =
                  <span className="font-bold text-green-700">
                    {" "}
                    ₮{totalPrice().toLocaleString()}
                  </span>
                </p>
              )}

            <button
              onClick={handleBooking}
              disabled={!selectedRange?.from || !selectedRange?.to}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white w-full py-2 rounded mt-2"
            >
              Захиалга үүсгэх
            </button>

            {bookingMessage && (
              <p
                className={`mt-3 text-sm ${
                  bookingMessage.includes("Амжилттай")
                    ? "text-green-700"
                    : "text-red-600"
                }`}
              >
                {bookingMessage}
              </p>
            )}
          </div>
        </div>

        <div className="prose max-w-none mt-4 text-gray-700">
          <h3 className="text-lg font-bold mb-2">Тайлбар</h3>
          <p>{listing.description}</p>
          <ul className="mt-4 space-y-1">
            <li>
              📍 <strong>Байршил:</strong> {listing.location_text}
            </li>
            <li>
              🛏️ <strong>Орны тоо:</strong> {listing.beds}
            </li>
            <li>
              👥 <strong>Зочны дээд тоо:</strong> {listing.max_guests}
            </li>
            <li>
              🏷️ <strong>Категори:</strong> {listing.category?.name}
            </li>
          </ul>

          {listing.amenities?.length > 0 && (
            <div className="mt-4">
              <h3 className="text-md font-bold mb-2">Тав тух / Давуу талууд</h3>
              <ul className="list-disc pl-5 text-sm text-gray-600">
                {listing.amenities.map((a: any, i: number) => (
                  <li key={i}>{a.name}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="font-bold text-green-700 text-lg mt-4">
            💰 Үнэ: ₮{Number(listing.price_per_night).toLocaleString()} / шөнө
          </p>
        </div>
      </div>
    </main>
  );
}
