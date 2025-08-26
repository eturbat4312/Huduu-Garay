// filename: src/app/[locale]/listings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import { t } from "@/lib/i18n";
import Image from "next/image";

const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "/media";

type Category = {
  id: number;
  name: string;
  image?: string;
  icon?: string;
};

type Listing = {
  id: number;
  title: string;
  location_text: string;
  price_per_night: number;
  images: { image: string }[];
  category?: Category;
};

export default function ListingsPage() {
  const { locale } = useParams<{ locale: string }>();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/listings/")
      .then((res) => {
        setListings(res.data as Listing[]);
      })
      .catch((err: unknown) => {
        const error = err as { message?: string };
        console.error("Error loading listings:", error.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        {t(locale, "all_listings_title")}
      </h1>

      {loading ? (
        <p>{t(locale, "loading")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {listings.map((listing) => {
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
                <Image
                  src={
                    listing.images?.[0]?.image
                      ? listing.images[0].image.startsWith("http")
                        ? listing.images[0].image
                        : `${MEDIA_URL}${listing.images[0].image}`
                      : "/placeholder.jpg"
                  }
                  alt={listing.title}
                  width={400}
                  height={200}
                  className="w-full h-48 object-cover rounded-t"
                />

                <div className="p-4">
                  {categoryImg ? (
                    <Image
                      src={categoryImg}
                      alt={listing.category?.name ?? "category"}
                      width={24}
                      height={24}
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
                    {t(locale, "per_night_suffix")}
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
