// filename: src/app/[locale]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Listing } from "@/types";
import api from "@/lib/axios";
import ListingCard from "@/components/ListingCard";
import FilterSidebar from "@/components/FilterSidebar";
import { useParams } from "next/navigation";
import { t } from "@/lib/i18n";

export default function HomePage() {
  const raw = useParams().locale;
  const locale = (typeof raw === "string" ? raw : "mn") as string;

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [filters, setFilters] = useState({
    category: "",
    search: "",
    location: "",
    priceMin: null as number | null,
    priceMax: null as number | null,
    amenities: [] as string[],
    __refresh: Date.now(),
  });

  // 🖼 Hero images массив
  const heroImages = [
    "/images/hero.png",
    "/images/hero2.png",
    "/images/hero3.png",
    "/images/hero4.png",
    "/images/hero5.png",
  ];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    api
      .get("/listings/", {
        params: {
          category: filters.category,
          search: filters.search,
          location: filters.location,
          price_min: filters.priceMin ?? undefined,
          price_max: filters.priceMax ?? undefined,
          amenities: filters.amenities.join(","),
        },
      })
      .then((res) => {
        // ✅ хамгийн сүүлд нэмэгдсэн listings эхэнд
        const sorted = [...res.data].sort((a, b) => {
          if (a.created_at && b.created_at) {
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          }
          return b.id - a.id; // fallback
        });
        setListings(sorted);
      })
      .catch((err) => console.error("❌ Error fetching listings:", err));
  }, [
    filters.category,
    filters.search,
    filters.location,
    filters.priceMin,
    filters.priceMax,
    filters.amenities,
    filters.__refresh,
  ]);

  // ⏱ Hero зураг солигдох 1.5 секунд тутамд
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="pb-16">
      {/* Hero Section */}
      <section
        className="relative w-full h-[420px] flex items-center justify-center text-center text-white"
        style={{
          backgroundImage: `url(${heroImages[current]})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transition: "background-image 0.4s ease-in-out",
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 px-4">
          <h1 className="text-4xl md:text-5xl font-bold">
            {t(locale, "title")}
          </h1>
          <p className="mt-4 text-lg md:text-2xl">{t(locale, "subtitle")}</p>
        </div>
      </section>

      {/* Filter Toggle (mobile) */}
      <div className="flex justify-center mt-6 md:hidden">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700"
        >
          {isFilterOpen
            ? t(locale, "close_filter")
            : `🔍 ${t(locale, "open_filter")}`}
        </button>
      </div>

      {/* Filter + Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 px-4 mt-6">
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          isOpen={isFilterOpen}
          locale={locale}
        />

        <div>
          {listings.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              {t(locale, "no_listings")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
