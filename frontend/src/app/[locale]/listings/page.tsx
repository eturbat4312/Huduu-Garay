"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import { t } from "@/lib/i18n";

const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:8010";

export default function ListingsPage() {
  const { locale } = useParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/listings/")
      .then((res) => {
        setListings(res.data);
      })
      .catch((err) => {
        console.error("Error loading listings:", err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        {t(locale as string, "all_listings_title")}
      </h1>

      {loading ? (
        <p>{t(locale as string, "loading")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {listings.map((listing: any) => {
            const categoryImg =
              listing.category?.image &&
              (listing.category.image.startsWith("http")
                ? listing.category.image
                : `${MEDIA_URL}${listing.category.image}`);

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
                    />
                  ) : (
                    <div className="text-xl mb-1">{listing.category?.icon}</div>
                  )}

                  <h2 className="font-semibold text-lg">{listing.title}</h2>
                  <p className="text-sm text-gray-600">
                    {listing.location_text}
                  </p>
                  <p className="mt-2 font-bold text-green-700">
                    {Number(listing.price_per_night).toLocaleString()}₮{" "}
                    {t(locale as string, "per_night_suffix")}
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
