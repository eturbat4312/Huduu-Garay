"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import { Listing } from "@/types";

export default function ListingCard({ listing }: { listing: Listing }) {
  const [favorited, setFavorited] = useState(listing.is_favorited ?? false);
  const [favoriteId, setFavoriteId] = useState<number | null>(
    listing.favorite_id ?? null
  );

  const carouselRef = useRef<HTMLDivElement>(null);

  const images = listing.images ?? [];
  const title = listing.title ?? "Гарчиггүй";
  const location = listing.location_text ?? "Байршил байхгүй";
  const categoryName = listing.category?.name ?? "Ангилалгүй";
  const categoryIcon = listing.category?.icon ?? "❓";
  const hostUsername = listing.host_username ?? "Тодорхойгүй хэрэглэгч";
  const price = Number(listing.price_per_night ?? 0);

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      if (favorited && favoriteId) {
        await api.delete(`/favorites/${favoriteId}/`);
        setFavorited(false);
        setFavoriteId(null);
      } else {
        const res = await api.post("/favorites/", { listing_id: listing.id });
        setFavorited(true);
        setFavoriteId(res.data.id);
      }
    } catch (err) {
      console.error("💥 Favorite toggle error:", err);
    }
  };

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  return (
    <Link href={`/listings/${listing.id}`} className="block">
      <div className="rounded-xl border overflow-hidden shadow-md hover:shadow-xl transition-all bg-white">
        {/* 📸 Image Carousel with arrows */}
        <div className="relative">
          {/* Гүйлгэх товчнууд */}
          <button
            onClick={(e) => {
              e.preventDefault();
              scrollLeft();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/70 hover:bg-white rounded-full p-1 shadow"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              scrollRight();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/70 hover:bg-white rounded-full p-1 shadow"
          >
            ›
          </button>

          <div
            ref={carouselRef}
            className="flex overflow-x-auto no-scrollbar space-x-1"
          >
            {images.length > 0 ? (
              images.map((img, i) => (
                <img
                  key={i}
                  src={
                    img.image?.startsWith("http")
                      ? img.image
                      : `http://localhost:8000${img.image}`
                  }
                  alt={`image-${i}`}
                  className="h-48 w-72 object-cover flex-shrink-0 rounded-md"
                />
              ))
            ) : (
              <div className="h-48 w-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400">Зураг алга</span>
              </div>
            )}
          </div>

          {/* ❤️ Favorite toggle */}
          <div className="absolute top-2 right-2 z-20">
            <button
              onClick={handleFavoriteToggle}
              className={`bg-white/80 hover:bg-white rounded-full p-2 shadow ${
                favorited ? "text-red-600" : "text-gray-400"
              }`}
              aria-label={favorited ? "Favorited" : "Not favorited"}
            >
              {favorited ? "❤️" : "🤍"}
            </button>
          </div>
        </div>

        {/* 📋 Info */}
        <div className="p-4">
          <div className="text-sm text-gray-500">{location}</div>
          <h3 className="font-semibold text-lg text-gray-800">{title}</h3>

          <div className="text-sm text-gray-500 mt-1">
            Зар эзэмшигч: <span className="font-medium">{hostUsername}</span>
          </div>

          <div className="flex justify-between items-center mt-2">
            <div className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              <span>{categoryIcon}</span>
              <span>{categoryName}</span>
            </div>
            <div className="text-base font-bold text-green-700">
              ₮
              {price.toLocaleString("mn-MN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
              <span className="text-sm text-gray-500"> / шөнө</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
