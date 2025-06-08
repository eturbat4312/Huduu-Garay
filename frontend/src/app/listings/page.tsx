"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:8010";

export default function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("MEDIA_URL:", MEDIA_URL);
    api
      .get("/listings/")
      .then((res) => {
        console.log("Listings loaded:", res.data);
        res.data.forEach((l: any) => {
          console.log(`Listing ${l.id} - Category Image:`, l.category?.image);
        });
        setListings(res.data);
      })
      .catch((err) => {
        console.error("Error loading listings:", err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Бүх листинг</h1>

      {loading ? (
        <p>Ачааллаж байна...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {listings.map((listing: any) => {
            const categoryImg =
              listing.category?.image &&
              (listing.category.image.startsWith("http")
                ? listing.category.image
                : `${MEDIA_URL}${listing.category.image}`);

            console.log(`Listing ${listing.id} categoryImg src =`, categoryImg);

            return (
              <div
                key={listing.id}
                className="border rounded shadow hover:shadow-lg transition bg-white"
              >
                <img
                  src={
                    listing.images?.[0]?.image
                      ? listing.images[0].image.startsWith("http")
                        ? listing.images[0].image
                        : `${MEDIA_URL}${listing.images[0].image}`
                      : "/placeholder.jpg"
                  }
                  alt={listing.title}
                  className="w-full h-48 object-cover rounded-t"
                />

                <div className="p-4">
                  {categoryImg ? (
                    <img
                      src={categoryImg}
                      alt={listing.category.name}
                      className="w-6 h-6 mb-1 object-cover rounded"
                      onError={() =>
                        console.warn(
                          `⚠️ Failed to load category image for listing ${listing.id}: ${categoryImg}`
                        )
                      }
                    />
                  ) : (
                    <div className="text-xl mb-1">{listing.category?.icon}</div>
                  )}

                  <h2 className="font-semibold text-lg">{listing.title}</h2>
                  <p className="text-sm text-gray-600">
                    {listing.location_text}
                  </p>
                  <p className="mt-2 font-bold text-green-700">
                    {Number(listing.price_per_night).toLocaleString()}₮ / шөнө
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
