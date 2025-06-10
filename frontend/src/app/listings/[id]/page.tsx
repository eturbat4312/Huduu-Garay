// filename: src/app/listings/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { DayPicker, DateRange } from "react-day-picker";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import "react-day-picker/dist/style.css";

const formatDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export default function ListingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [listing, setListing] = useState<any>(null);
  const [availableDateStrings, setAvailableDateStrings] = useState<Set<string>>(
    new Set()
  );
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [bookingMessage, setBookingMessage] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );
  const [isFavorited, setIsFavorited] = useState(false); // dummy state for favorite button

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await api.get(`/listings/${id}/`);
        setListing(res.data);

        const availabilityRes = await api.get(`/availability/?listing=${id}`);
        const dates: string[] = availabilityRes.data.map((a: any) =>
          a.date.trim()
        );
        setAvailableDateStrings(new Set(dates));
      } catch (error) {
        console.error("Алдаа:", error);
      }
    };

    fetchListing();
  }, [id]);

  const isDateAvailable = (date: Date) =>
    availableDateStrings.has(formatDateString(date));

  const isRangeValid = (range: DateRange) => {
    if (!range.from || !range.to) return false;
    const datesBetween: Date[] = [];
    let date = new Date(range.from);
    while (date < range.to) {
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
        setSelectedRange(undefined);
        setBookingMessage("⚠️ Сонгосон огнооны зарим нь боломжгүй байна.");
      }
    } else if (range.from && !range.to) {
      const from = new Date(range.from);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      setSelectedRange({ from, to });
      setBookingMessage("");
    }
  };

  const calculateNights = () => {
    if (!selectedRange?.from || !selectedRange?.to) return 0;
    const diff =
      (selectedRange.to.getTime() - selectedRange.from.getTime()) /
      (1000 * 60 * 60 * 24);
    return Math.max(1, Math.ceil(diff));
  };

  const totalPrice = () => {
    const nights = calculateNights();
    return nights * parseFloat(listing?.price_per_night || "0");
  };

  const handleBooking = () => {
    if (!selectedRange?.from || !selectedRange?.to) {
      setBookingMessage("📅 Огноо сонгоно уу.");
      return;
    }

    const checkInTs = selectedRange.from.getTime();
    const checkOutTs = selectedRange.to.getTime();

    router.push(
      `/checkout?listing=${id}&check_in_ts=${checkInTs}&check_out_ts=${checkOutTs}`
    );
  };

  const formatter = (date: Date) => date.toLocaleDateString("mn-MN");

  if (!listing) return <p className="p-6">Ачааллаж байна...</p>;

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-10">
      {/* Hero Background */}
      {listing.images?.[0] && (
        <div
          className="h-[250px] md:h-[350px] w-full bg-cover bg-center rounded-xl shadow"
          style={{ backgroundImage: `url(${listing.images[0].image})` }}
        ></div>
      )}

      {/* Listing Content */}
      <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-green-800">{listing.title}</h1>
          <button
            onClick={() => setIsFavorited(!isFavorited)}
            className="text-3xl"
            title={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorited ? "❤️" : "🤍"}
          </button>
        </div>

        <p className="text-gray-600">{listing.location_text}</p>

        {/* Image Album Scroll */}
        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-thin scrollbar-thumb-gray-400">
          {listing.images?.map((img: any, i: number) => (
            <img
              key={i}
              src={img.image}
              alt={`listing-img-${i}`}
              onClick={() => setSelectedImageIndex(i)}
              className="h-48 w-auto rounded-lg cursor-pointer object-cover hover:opacity-80"
            />
          ))}
        </div>

        {/* Fullscreen Image View */}
        {selectedImageIndex !== null && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
            onClick={() => setSelectedImageIndex(null)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((prev) =>
                  prev !== null && prev > 0
                    ? prev - 1
                    : listing.images.length - 1
                );
              }}
              className="absolute left-4 text-white text-4xl px-3 py-1 bg-black/50 rounded-full hover:bg-black"
            >
              <ChevronLeft size={32} />
            </button>
            <img
              src={listing.images[selectedImageIndex].image}
              alt="selected"
              className="max-h-[80vh] max-w-[90vw] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((prev) =>
                  prev !== null && prev < listing.images.length - 1
                    ? prev + 1
                    : 0
                );
              }}
              className="absolute right-4 text-white text-4xl px-3 py-1 bg-black/50 rounded-full hover:bg-black"
            >
              <ChevronRight size={32} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(null);
              }}
              className="absolute top-4 right-4 text-white"
            >
              <X size={28} />
            </button>
          </div>
        )}

        {/* Calendar + Booking */}
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 border p-4 rounded-xl bg-white shadow">
            <h2 className="text-lg font-semibold mb-2">Огноо сонгох</h2>
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={handleDateSelect}
              disabled={(date) => !isDateAvailable(date) || date < new Date()}
              modifiers={{
                available: Array.from(availableDateStrings).map((ds) => {
                  const [y, m, d] = ds.split("-");
                  return new Date(Number(y), Number(m) - 1, Number(d));
                }),
              }}
              modifiersClassNames={{
                available: "bg-green-200 text-black",
                unavailable: "bg-gray-200 text-gray-400 line-through",
                selected: "bg-green-600 text-white",
              }}
              formatters={{ formatCaption: formatter }}
            />
            <div className="mt-2 text-sm text-gray-600">
              <p>🟢 Боломжтой өдрүүд</p>
              <p>⚪ Боломжгүй өдрүүд</p>
            </div>
          </div>

          <div className="w-full md:w-80 border p-4 rounded-xl bg-white shadow">
            <h2 className="text-lg font-semibold mb-4">Захиалга өгөх</h2>

            {selectedRange?.from && selectedRange?.to && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <p className="text-sm">
                  <strong>Check-in:</strong>{" "}
                  {selectedRange.from.toLocaleDateString("mn-MN")}
                </p>
                <p className="text-sm">
                  <strong>Check-out:</strong>{" "}
                  {selectedRange.to.toLocaleDateString("mn-MN")}
                </p>
              </div>
            )}

            {selectedRange?.from && calculateNights() > 0 && (
              <p className="text-sm mb-2 text-gray-700">
                🛏 {calculateNights()} шөнө × ₮
                {Number(listing.price_per_night).toLocaleString()} ={" "}
                <span className="font-bold text-green-700">
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
                  bookingMessage.includes("⚠️")
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {bookingMessage}
              </p>
            )}
          </div>
        </div>

        {/* Description, Location, Amenities */}
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
