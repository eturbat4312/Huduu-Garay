"use client";

import { useEffect, useState } from "react";
import { Listing } from "@/types";
import api from "@/lib/axios";
import ListingCard from "@/components/ListingCard";
import FilterSidebar from "@/components/FilterSidebar";
import Image from "next/image";

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filters, setFilters] = useState({
    category: "",
    search: "",
    location: "",
    priceMin: null as number | null,
    priceMax: null as number | null,
    amenities: [] as string[],
    __refresh: Date.now(), // useEffect trigger key
  });

  useEffect(() => {
    console.log("📦 Filter parameters:", filters);

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
        console.log("✅ Listings loaded:", res.data);
        setListings(res.data);
      })
      .catch((err) => {
        console.error("❌ Error fetching listings:", err);
      });
  }, [filters.__refresh]); // ✅ Trigger only when user clicks "Хайх"

  return (
    <main className="pb-16">
      {/* 🏞 Hero Section */}
      <section className="relative w-full h-[420px]">
        <img
          src="/images/hero.png"
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Хөдөө Гарая!</h1>
          <p className="mt-4 text-lg md:text-2xl">
            Монголын хөдөө таныг хүлээж байна
          </p>
        </div>
      </section>

      {/* 🔍 Filter + Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 px-4 mt-10">
        {/* 📌 Sidebar Filter */}
        <FilterSidebar filters={filters} setFilters={setFilters} />

        {/* 🏠 Listings */}
        <div>
          {listings.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              Тохирох зар олдсонгүй
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
