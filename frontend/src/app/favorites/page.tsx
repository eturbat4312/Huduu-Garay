// Filename: app/favorites/page.tsx

"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import ListingCard from "@/components/ListingCard";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const res = await api.get("/my-favorites/");
        setFavorites(res.data);
      } catch (err) {
        console.error("💥 Favorites fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  if (loading) return <p className="p-6">Ачааллаж байна...</p>;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-green-800">❤️ Хадгалсан зарууд</h1>

      {favorites.length === 0 ? (
        <p className="text-gray-500">
          Та одоогоор ямар ч зар хадгалаагүй байна.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {favorites.map((fav, i) => (
            <ListingCard key={i} listing={fav.listing} />
          ))}
        </div>
      )}
    </main>
  );
}
