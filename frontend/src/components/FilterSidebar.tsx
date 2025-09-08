// filename: src/components/FilterSidebar.tsx
"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { t } from "@/lib/i18n";

export type FilterValues = {
  category: string; // pills-аас л ирнэ
  search: string;
  location: string;
  priceMin: number | null;
  priceMax: number | null;
  amenities: string[];
  __refresh: number;
};

type Props = {
  locale: string;
  filters: FilterValues;
  setFilters: (filters: FilterValues) => void;
  isOpen?: boolean;
};

type AmenityOption = {
  name: string;
  translation_key: string;
};

export default function FilterSidebar({
  locale,
  filters,
  setFilters,
  isOpen = true,
}: Props) {
  const [amenityOptions, setAmenityOptions] = useState<AmenityOption[]>([]);

  useEffect(() => {
    api.get<AmenityOption[]>("/amenities/").then((res) => {
      setAmenityOptions(res.data);
    });
  }, []);

  const handleAmenityToggle = (value: string) => {
    setFilters({
      ...filters,
      amenities: filters.amenities.includes(value)
        ? filters.amenities.filter((a) => a !== value)
        : [...filters.amenities, value],
    });
  };

  const handleClear = () => {
    setFilters({
      category: "", // pills дээрээс reset
      search: "",
      location: "",
      priceMin: null,
      priceMax: null,
      amenities: [],
      __refresh: Date.now(),
    });
  };

  const handleApply = () => {
    setFilters({
      ...filters,
      __refresh: Date.now(),
    });
  };

  return (
    <aside
      className={`
        border rounded p-4 space-y-6 bg-white w-full md:w-72
        ${isOpen ? "block" : "hidden"}
        md:block
      `}
    >
      {/* Search */}
      <div>
        <label className="block mb-1 font-medium">
          {t(locale, "search_label")}
        </label>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder={t(locale, "search_label")}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Location */}
      <div>
        <label className="block mb-1 font-medium">
          {t(locale, "location_label")}
        </label>
        <input
          type="text"
          value={filters.location}
          onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          placeholder="Жишээ: Архангай"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Price */}
      <div>
        <label className="block mb-1 font-medium">
          {t(locale, "price_label")}
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={filters.priceMin ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                priceMin: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="Мин"
            className="w-1/2 border rounded px-3 py-2"
          />
          <input
            type="number"
            value={filters.priceMax ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                priceMax: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="Макс"
            className="w-1/2 border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Amenities */}
      <div>
        <label className="block mb-1 font-medium">
          {t(locale, "amenities_label")}
        </label>
        <div className="flex flex-col gap-1">
          {amenityOptions.map((a) => (
            <label key={a.name} className="flex gap-2 items-center text-sm">
              <input
                type="checkbox"
                checked={filters.amenities.includes(a.name)}
                onChange={() => handleAmenityToggle(a.name)}
              />
              {t(locale, a.translation_key) || a.name}
            </label>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2 pt-4">
        <div className="flex gap-2 justify-between">
          <button
            onClick={handleClear}
            className="text-sm text-gray-600 underline"
          >
            {t(locale, "clear")}
          </button>
          <button
            onClick={handleApply}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
          >
            {t(locale, "search_button")}
          </button>
        </div>
      </div>
    </aside>
  );
}
