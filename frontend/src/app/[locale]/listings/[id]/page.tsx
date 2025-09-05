// filename: src/app/[locale]/listings/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import api from "@/lib/axios";
import { DayPicker, DateRange } from "react-day-picker";
import { ChevronLeft, ChevronRight, X, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import "react-day-picker/dist/style.css";
import ReviewSection from "@/components/ReviewSection";
import { t } from "@/lib/i18n";
import { Listing, Booking } from "@/types";
import { AxiosError } from "axios";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ---------- Extra Types ----------
type BookingDay = {
  date: string;
  booking_id: number;
};

// ---------- Helper ----------
const formatDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export default function ListingDetailPage() {
  const { id, locale } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [availableDateStrings, setAvailableDateStrings] = useState<Set<string>>(
    new Set()
  );
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [bookingMessage, setBookingMessage] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );
  const [isFavorited, setIsFavorited] = useState(false);
  const [bookedDates, setBookedDates] = useState<BookingDay[]>([]);

  const isOwner = user && listing?.host?.id === user.id;

  // Map ref
  const mapRef = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);

  // ---------- Fetch ----------
  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await api.get<Listing>(`/listings/${id}/`);
        setListing(res.data);

        const availabilityRes = await api.get<{ date: string }[]>(
          `/availability/?listing=${id}`
        );
        const dates = availabilityRes.data.map((a) => a.date.trim());
        setAvailableDateStrings(new Set(dates));

        if (user && res.data.host?.id === user.id) {
          const bookingsRes = await api.get<Booking[]>("/host-bookings/");
          const bookingDays: BookingDay[] = [];

          bookingsRes.data.forEach((booking) => {
            if (booking.listing.id !== Number(id)) return;
            if (booking.is_cancelled_by_host) return;
            const startDate = new Date(booking.check_in);
            const end = new Date(booking.check_out);
            const loopDate = new Date(startDate);

            while (loopDate < end) {
              bookingDays.push({
                date: formatDateString(loopDate),
                booking_id: booking.id,
              });
              loopDate.setDate(loopDate.getDate() + 1);
            }
          });
          setBookedDates(bookingDays);
        }
      } catch (err) {
        console.error("Алдаа:", err);
      }
    };
    fetchListing();
  }, [id, user]);

  // ---------- Init Map ----------
  useEffect(() => {
    if (!listing || !mapRef.current || map.current) return;
    if (!listing.location_lat || !listing.location_lng) return;

    map.current = new maplibregl.Map({
      container: mapRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
      center: [listing.location_lng, listing.location_lat],
      zoom: 10,
    });

    new maplibregl.Marker()
      .setLngLat([listing.location_lng, listing.location_lat])
      .addTo(map.current);
  }, [listing]);

  // ---------- Helpers ----------
  const isDateAvailable = (date: Date) =>
    availableDateStrings.has(formatDateString(date));

  const isRangeValid = (range: DateRange) => {
    if (!range.from || !range.to) return false;
    const dates: Date[] = [];
    const loopDate = new Date(range.from);

    while (loopDate < range.to) {
      dates.push(new Date(loopDate));
      loopDate.setDate(loopDate.getDate() + 1);
    }
    return dates.every(isDateAvailable);
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
        setBookingMessage(t(locale as string, "date_range_invalid"));
      }
    } else if (range.from) {
      const to = new Date(range.from);
      to.setDate(to.getDate() + 1);
      setSelectedRange({ from: range.from, to });
      setBookingMessage("");
    }
  };

  const handleDayClick = (date: Date) => {
    const found = bookedDates.find((b) => b.date === formatDateString(date));
    if (found) router.push(`/${locale}/host-bookings/${found.booking_id}`);
  };

  const calculateNights = () =>
    selectedRange?.from && selectedRange?.to
      ? Math.max(
          1,
          (selectedRange.to.getTime() - selectedRange.from.getTime()) / 86400000
        )
      : 0;

  const totalPrice = () => calculateNights() * (listing?.price_per_night ?? 0);

  const handleBooking = () => {
    if (!selectedRange?.from || !selectedRange?.to) {
      setBookingMessage(t(locale as string, "please_select_date"));
      return;
    }
    router.push(
      `/${locale}/checkout?listing=${id}&check_in_ts=${selectedRange.from.getTime()}&check_out_ts=${selectedRange.to.getTime()}`
    );
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm(t(locale as string, "confirm_delete"));
    if (!confirmDelete) return;

    try {
      await api.delete(`/listings/${id}/delete/`);
      alert(t(locale as string, "listing_deleted_success"));
      router.push(`/${locale}/`);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 409) {
        alert(t(locale as string, "delete_blocked_due_to_booking"));
      } else {
        alert(t(locale as string, "delete_failed"));
      }
    }
  };

  const formatter = (date: Date) =>
    date.toLocaleDateString((locale as string) || "mn-MN");

  // ---------- Render ----------
  if (!listing) return <p className="p-6">{t(locale as string, "loading")}</p>;

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-10">
      {/* Cover image */}
      {listing.images?.[0] && (
        <div
          className="h-[250px] md:h-[350px] w-full bg-cover bg-center rounded-xl shadow"
          style={{ backgroundImage: `url(${listing.images[0].image})` }}
        />
      )}

      <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-bold text-green-800">{listing.title}</h1>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <>
                <button
                  onClick={() =>
                    router.push(`/${locale}/edit-listing/${listing.id}`)
                  }
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center gap-1"
                >
                  <Pencil size={16} /> {t(locale as string, "edit")}
                </button>
                <button
                  onClick={handleDelete}
                  className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded flex items-center gap-1"
                >
                  <Trash2 size={16} /> {t(locale as string, "delete")}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsFavorited(!isFavorited)}
                className="text-3xl"
                title={
                  isFavorited
                    ? t(locale as string, "unfavorite")
                    : t(locale as string, "favorite")
                }
              >
                {isFavorited ? "❤️" : "🤍"}
              </button>
            )}
          </div>
        </div>

        <p className="text-gray-600">{listing.location_text}</p>

        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-thin scrollbar-thumb-gray-400">
          {listing.images?.map((img, i) => (
            <img
              key={i}
              src={img.image}
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
            <h2 className="text-lg font-semibold mb-2">
              {t(locale as string, "select_date_title")}
            </h2>
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={handleDateSelect}
              onDayClick={isOwner ? handleDayClick : undefined}
              disabled={
                !isOwner
                  ? (date) => !isDateAvailable(date) || date < new Date()
                  : (date) => date < new Date()
              }
              modifiers={{
                available: Array.from(availableDateStrings).map((ds) => {
                  const [y, m, d] = ds.split("-");
                  return new Date(Number(y), Number(m) - 1, Number(d));
                }),
                booked: isOwner
                  ? bookedDates.map((b) => {
                      const [y, m, d] = b.date.split("-");
                      return new Date(Number(y), Number(m) - 1, Number(d));
                    })
                  : [],
              }}
              modifiersClassNames={{
                available: "bg-green-200 text-black",
                booked:
                  "bg-red-400 text-white cursor-pointer hover:brightness-110",
                unavailable: "bg-gray-200 text-gray-400 line-through",
                selected: "bg-green-600 text-white",
              }}
              formatters={{ formatCaption: formatter }}
            />
            <div className="mt-2 text-sm text-gray-600 space-y-1">
              <p>{t(locale as string, "available_days_hint")}</p>
              {isOwner && <p>{t(locale as string, "booked_days_hint")}</p>}
              <p>{t(locale as string, "unavailable_days_hint")}</p>
            </div>
          </div>

          {!isOwner && (
            <div className="w-full md:w-80 border p-4 rounded-xl bg-white shadow">
              <h2 className="text-lg font-semibold mb-4">
                {t(locale as string, "booking_title")}
              </h2>
              {selectedRange?.from && selectedRange?.to && (
                <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
                  <p>
                    <strong>{t(locale as string, "checkin")}:</strong>{" "}
                    {selectedRange.from.toLocaleDateString("mn-MN")}
                  </p>
                  <p>
                    <strong>{t(locale as string, "checkout")}:</strong>{" "}
                    {selectedRange.to.toLocaleDateString("mn-MN")}
                  </p>
                </div>
              )}
              {selectedRange?.from && calculateNights() > 0 && (
                <p className="text-sm mb-2 text-gray-700">
                  🛏 {calculateNights()} × ₮
                  {Number(listing.price_per_night).toLocaleString()} =
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
                {t(locale as string, "create_booking")}
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
          )}
        </div>

        {/* 🗺 Location Map — always visible */}
        {listing.location_lat && listing.location_lng && (
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-2">
              {t(locale as string, "location_map") || "Байршил"}
            </h3>
            <div
              className="h-72 w-full rounded-xl overflow-hidden shadow"
              ref={mapRef}
            />
          </div>
        )}

        <div className="prose max-w-none mt-4 text-gray-700">
          <h3 className="text-lg font-bold mb-2">
            {t(locale as string, "description")}
          </h3>
          <p>{listing.description}</p>
          <ul className="mt-4 space-y-1">
            <li>
              📍 <strong>{t(locale as string, "location")}:</strong>{" "}
              {listing.location_text}
            </li>
            <li>
              🛏️ <strong>{t(locale as string, "beds")}:</strong> {listing.beds}
            </li>
            <li>
              👥 <strong>{t(locale as string, "max_guests")}:</strong>{" "}
              {listing.max_guests}
            </li>
            <li>
              🏷️ <strong>{t(locale as string, "category")}:</strong>{" "}
              {t(locale as string, listing.category?.translation_key ?? "")}
            </li>
          </ul>
          {listing.amenities?.length > 0 && (
            <div className="mt-4">
              <h3 className="text-md font-bold mb-2">
                {t(locale as string, "amenities_title")}
              </h3>
              <ul className="list-disc pl-5 text-sm text-gray-600">
                {listing.amenities.map((a, i) => (
                  <li key={i}>
                    {t(locale as string, a.translation_key ?? a.name)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="font-bold text-green-700 text-lg mt-4">
            💰{" "}
            {t(locale as string, "price_per_night_label").replace(
              "{{price}}",
              Number(listing.price_per_night).toLocaleString()
            )}
          </p>
        </div>
      </div>

      <ReviewSection listingId={Number(id)} />
    </main>
  );
}
