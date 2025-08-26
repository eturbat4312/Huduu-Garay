// filename: src/components/FilterSidebar.tsx
"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { t } from "@/lib/i18n";

// 🔹 Filter-ийн бүтэц тодорхойлно
export type FilterValues = {
  category: string;
  search: string;
  location: string;
  priceMin: number | null;
  priceMax: number | null;
  amenities: string[];
  __refresh: number; // дотоод refresh trigger
};

type Props = {
  locale: string;
  filters: FilterValues;
  setFilters: (filters: FilterValues) => void;
  isOpen?: boolean;
};

type CategoryOption = {
  name: string;
  translation_key: string;
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
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  useEffect(() => {
    api.get<AmenityOption[]>("/amenities/").then((res) => {
      setAmenityOptions(res.data);
    });
    api.get<CategoryOption[]>("/categories/").then((res) => {
      console.log("✅ Category API response:", res.data);
      setCategoryOptions(res.data);
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
      category: "",
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
      {/* Хайх */}
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

      {/* Байршил */}
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

      {/* Үнэ */}
      <div>
        <label className="block mb-1 font-medium">
          {t(locale, "price_label")}
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={filters.priceMin ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, priceMin: Number(e.target.value) })
            }
            placeholder="Мин"
            className="w-1/2 border rounded px-3 py-2"
          />
          <input
            type="number"
            value={filters.priceMax ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, priceMax: Number(e.target.value) })
            }
            placeholder="Макс"
            className="w-1/2 border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Ангилал */}
      <div>
        <label className="block mb-1 font-medium">
          {t(locale, "category_label")}
        </label>
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((cat) => (
            <button
              key={cat.name}
              onClick={() =>
                setFilters({
                  ...filters,
                  category: cat.name === filters.category ? "" : cat.name,
                })
              }
              className={`px-3 py-1 border rounded-full ${
                cat.name === filters.category
                  ? "bg-green-100 text-green-700 border-green-500"
                  : ""
              }`}
            >
              {t(locale, cat.translation_key) || cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Давуу талууд */}
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
        <p className="text-xs text-gray-500">{t(locale, "filter_hint")}</p>
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
