// filename: src/app/[locale]/my-listings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/axios";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import ListingCard from "@/components/ListingCard";
import { t } from "@/lib/i18n";
import { Listing } from "@/types"; // ✅ types-оос импортлов

type BookingDay = {
  date: string; // yyyy-mm-dd
  booking_id: number;
};

type Booking = {
  id: number;
  check_in: string;
  check_out: string;
  is_cancelled_by_host: boolean;
};

export default function MyListingsPage() {
  const { locale } = useParams();
  const [listings, setListings] = useState<Listing[]>([]); // ✅ any биш, жинхэнэ Listing type
  const [bookedDates, setBookedDates] = useState<BookingDay[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const [listingsRes, bookingsRes] = await Promise.all([
        api.get<Listing[]>("/my-listings/"),
        api.get<Booking[]>("/host-bookings/"),
      ]);
      setListings(listingsRes.data);

      const bookingDays: BookingDay[] = [];
      bookingsRes.data.forEach((booking) => {
        if (booking.is_cancelled_by_host) return;
        const date = new Date(booking.check_in);
        const end = new Date(booking.check_out);
        while (date < end) {
          bookingDays.push({
            date: date.toISOString().split("T")[0],
            booking_id: booking.id,
          });
          date.setDate(date.getDate() + 1);
        }
      });
      setBookedDates(bookingDays);

      const listingIds = listingsRes.data.map((l) => l.id);
      const availabilityPromises = listingIds.map((id) =>
        api.get<{ date: string }[]>(`/availability/?listing=${id}`)
      );
      const availabilityResponses = await Promise.all(availabilityPromises);
      const available = availabilityResponses
        .flatMap((res) => res.data)
        .map((a) => a.date);
      setAvailableDates(available);
    };

    fetchData();
  }, []);

  const isBooked = (date: Date) =>
    bookedDates.find((b) => b.date === date.toISOString().split("T")[0]);

  const isAvailable = (date: Date) =>
    availableDates.includes(date.toISOString().split("T")[0]);

  const handleDayClick = (date: Date) => {
    const found = bookedDates.find(
      (b) => b.date === date.toISOString().split("T")[0]
    );
    if (found) router.push(`/${locale}/host-bookings/${found.booking_id}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">
        📅 {t(locale as string, "my_listings_calendar_title")}
      </h1>

      {/* ➕ Legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-400" />
          <span className="text-sm">
            {t(locale as string, "calendar_booked")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-200" />
          <span className="text-sm">
            {t(locale as string, "calendar_available")}
          </span>
        </div>
        <div className="ml-auto text-sm text-gray-600">
          🔍 {t(locale as string, "calendar_tip")}
        </div>
      </div>

      <DayPicker
        mode="single"
        selected={undefined}
        onDayClick={handleDayClick}
        modifiers={{
          booked: (date) => !!isBooked(date),
          available: (date) => isAvailable(date),
        }}
        modifiersClassNames={{
          booked: "bg-red-400 text-white",
          available: "bg-green-200",
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            locale={locale as string}
          />
        ))}
      </div>
    </div>
  );
}
