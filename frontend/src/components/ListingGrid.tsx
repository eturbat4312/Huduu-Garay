// filename: src/components/ListingGrid.tsx
import ListingCard from "./ListingCard";
import { Listing } from "@/types";

export default function ListingGrid({
  listings,
  locale,
}: {
  listings: Listing[];
  locale: string;
}) {
  if (listings.length === 0) {
    return (
      <p className="text-center text-gray-500 mt-10">
        {locale === "fr"
          ? "Aucune annonce trouvée."
          : locale === "en"
          ? "No listings found."
          : "Листинг олдсонгүй."}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} locale={locale} />
      ))}
    </div>
  );
}
