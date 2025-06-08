"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

type Props = {
  filters: {
    category: string;
    search: string;
    location: string;
    priceMin: number | null;
    priceMax: number | null;
    amenities: string[];
  };
  setFilters: (filters: any) => void;
};

export default function FilterSidebar({ filters, setFilters }: Props) {
  const [amenityOptions, setAmenityOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  useEffect(() => {
    api.get("/amenities/").then((res) => {
      setAmenityOptions(res.data.map((a: any) => a.name));
    });
    api.get("/categories/").then((res) => {
      setCategoryOptions(res.data.map((c: any) => c.name));
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
    <aside className="w-full md:w-72 border rounded p-4 space-y-6 sticky top-4 bg-white">
      {/* 🔍 Search */}
      <div>
        <label className="block mb-1 font-medium">Хайх</label>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Нэр, байршил..."
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* 📍 Location */}
      <div>
        <label className="block mb-1 font-medium">Байршил</label>
        <input
          type="text"
          value={filters.location}
          onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          placeholder="Жишээ: Архангай"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* 💰 Price */}
      <div>
        <label className="block mb-1 font-medium">Үнэ (₮)</label>
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

      {/* 🏡 Category */}
      <div>
        <label className="block mb-1 font-medium">Ангилал</label>
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setFilters({
                  ...filters,
                  category: cat === filters.category ? "" : cat,
                })
              }
              className={`px-3 py-1 border rounded-full ${
                cat === filters.category
                  ? "bg-green-100 text-green-700 border-green-500"
                  : ""
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ✅ Amenities */}
      <div>
        <label className="block mb-1 font-medium">Давуу талууд</label>
        <div className="flex flex-col gap-1">
          {amenityOptions.map((a) => (
            <label key={a} className="flex gap-2 items-center text-sm">
              <input
                type="checkbox"
                checked={filters.amenities.includes(a)}
                onChange={() => handleAmenityToggle(a)}
              />
              {a}
            </label>
          ))}
        </div>
      </div>

      {/* 🧃 Action Buttons */}
      <div className="space-y-2 pt-4">
        <p className="text-xs text-gray-500">
          Та бүх шүүлтүүрийг тохируулсны дараа "Хайх" товчийг дарж шинэчлэх
          боломжтой.
        </p>
        <div className="flex gap-2 justify-between">
          <button
            onClick={handleClear}
            className="text-sm text-gray-600 underline"
          >
            Цэвэрлэх
          </button>
          <button
            onClick={handleApply}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
          >
            Хайх
          </button>
        </div>
      </div>
    </aside>
  );
}
