// src/components/ListingGrid.tsx

import ListingCard from "./ListingCard";
import { Listing } from "@/types"; // ✅ Төв type-ийг ашигла

export default function ListingGrid({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-10">Листинг олдсонгүй.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
