// filename: src/app/[locale]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Listing } from "@/types";
import api from "@/lib/axios";
import ListingCard from "@/components/ListingCard";
import FilterSidebar from "@/components/FilterSidebar";
import { useParams } from "next/navigation";
import { t } from "@/lib/i18n";

// ✅ Энэ function нь static route-уудыг үүсгэхэд хэрэгтэй
// export async function generateStaticParams() {
//   return [{ locale: "mn" }, { locale: "en" }, { locale: "fr" }];
// }

export default function HomePage() {
  const { locale } = useParams();
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
      .then((res) => setListings(res.data))
      .catch((err) => console.error("❌ Error fetching listings:", err));
  }, [filters.__refresh]);

  return (
    <main className="pb-16">
      {/* Hero Section */}
      <section className="relative w-full h-[420px]">
        <img
          src="/images/hero.png"
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center text-white px-4">
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
          locale={locale as string}
        />

        <div>
          {listings.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              {t(locale, "no_listings")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {listings.map((listing) => (
                // <ListingCard key={listing.id} listing={listing} />
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  locale={locale as string}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
