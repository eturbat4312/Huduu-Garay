// filename: src/app/[locale]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Listing } from "@/types";
import api from "@/lib/axios";
import ListingCard from "@/components/ListingCard";
import { useParams } from "next/navigation";
import { t } from "@/lib/i18n";
import Image from "next/image";
import HomeMap from "@/components/HomeMap";
import FilterBar, { type FilterValues } from "@/components/FilterBar";
import FilterSidebar from "@/components/FilterSidebar";

export default function HomePage() {
  const raw = useParams().locale;
  const locale = (typeof raw === "string" ? raw : "mn") as string;

  const [showMap, setShowMap] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [filters, setFilters] = useState<FilterValues>({
    category: "",
    search: "",
    location: "",
    priceMin: null,
    priceMax: null,
    amenities: [],
    __refresh: Date.now(),
  });

  // Hero images
  const heroImages = [
    "/images/hero.png",
    "/images/hero2.png",
    "/images/hero3.png",
    "/images/hero4.png",
    "/images/hero5.png",
  ];
  const [current, setCurrent] = useState(0);

  // Fetch listings
  useEffect(() => {
    api
      .get<Listing[]>("/listings/", {
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
        // ✅ lint-friendly: Listing type ашигласан
        console.log(
          "coords check",
          res.data.map((x: Listing) => ({
            id: x.id,
            lat: x.location_lat,
            lng: x.location_lng,
          }))
        );

        const sorted = [...res.data].sort((a, b) => {
          if (a.created_at && b.created_at) {
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          }
          return b.id - a.id;
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

  // Hero slideshow
  useEffect(() => {
    const id = setInterval(
      () => setCurrent((p) => (p + 1) % heroImages.length),
      3000
    );
    return () => clearInterval(id);
  }, [heroImages.length]);

  // 🧩 Marker → Card scroll + highlight
  useEffect(() => {
    const onMarkerClick = (e: Event) => {
      const id = (e as CustomEvent).detail?.id as number;
      const el = document.querySelector<HTMLElement>(`[data-lid="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-green-500", "rounded-xl");
      setTimeout(() => el.classList.remove("ring-2", "ring-green-500"), 1200);
    };
    window.addEventListener("listing:marker-click", onMarkerClick);
    return () =>
      window.removeEventListener("listing:marker-click", onMarkerClick);
  }, []);

  return (
    <main className="pb-16">
      {/* Hero */}
      <section className="relative w-full h-[420px] overflow-hidden">
        {heroImages.map((img, idx) => (
          <Image
            key={idx}
            src={img}
            alt="Hero"
            fill
            priority={idx === 0}
            className={`object-cover transition-opacity duration-1000 ease-in-out ${
              idx === current ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold">
            {t(locale, "title")}
          </h1>
          <p className="mt-4 text-lg md:text-2xl">{t(locale, "subtitle")}</p>
        </div>
      </section>

      {/* Desktop filter bar */}
      <div className="hidden xl:block">
        <FilterBar locale={locale} filters={filters} setFilters={setFilters} />
      </div>

      {/* Mobile controls */}
      <div className="xl:hidden sticky top-0 z-30 bg-white/80 backdrop-blur px-4 pt-3">
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(true)}
            className="flex-1 border rounded-lg py-2 font-medium"
          >
            🔍 {t(locale, "filters") || "Filter"}
          </button>
          <button
            onClick={() => setShowMap(true)}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-medium"
          >
            🗺️ {t(locale, "show_map") || "Map"}
          </button>
        </div>
      </div>

      {/* MOBILE listings */}
      <div className="xl:hidden px-4 mt-4">
        {listings.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            {t(locale, "no_listings")}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {listings.map((listing) => (
              <div
                key={listing.id}
                data-lid={listing.id}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("listing:card-click", {
                      detail: { id: listing.id },
                    })
                  )
                }
              >
                <ListingCard listing={listing} locale={locale} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DESKTOP listings + map */}
      <div className="hidden xl:grid grid-cols-[1fr_560px] gap-6 px-6 mt-8 w-full">
        <div>
          {listings.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              {t(locale, "no_listings")}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  data-lid={listing.id}
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("listing:card-click", {
                        detail: { id: listing.id },
                      })
                    )
                  }
                >
                  <ListingCard listing={listing} locale={locale} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="sticky top-24">
          <div className="h-[calc(100vh-140px)] rounded-2xl overflow-hidden shadow-lg bg-white">
            <HomeMap listings={listings} locale={locale} />
          </div>
        </div>
      </div>

      {/* MOBILE filter overlay */}
      {showFilters && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="h-12 flex items-center justify-between border-b px-4">
            <span className="font-semibold">
              {t(locale, "filters") || "Шүүлтүүр"}
            </span>
            <button onClick={() => setShowFilters(false)}>✖</button>
          </div>
          <div className="h-[calc(100vh-48px)] overflow-y-auto p-4">
            <FilterSidebar
              locale={locale}
              filters={filters}
              setFilters={setFilters}
              isOpen={true}
            />
            <div className="mt-4">
              <button
                onClick={() => {
                  setFilters({ ...filters, __refresh: Date.now() });
                  setShowFilters(false);
                }}
                className="w-full bg-green-600 text-white py-3 rounded-lg"
              >
                {t(locale, "search_button") || "Хайх"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE map overlay */}
      {showMap && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="h-12 flex items-center justify-between border-b px-4">
            <span className="font-semibold">
              {t(locale, "map") || "Газрын зураг"}
            </span>
            <button onClick={() => setShowMap(false)}>✖</button>
          </div>
          <div className="h-[calc(100vh-48px)]">
            <HomeMap listings={listings} locale={locale} />
          </div>
        </div>
      )}
    </main>
  );
}
