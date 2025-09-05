// filename: src/components/FilterBar.tsx
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import api from "@/lib/axios";
import { t } from "@/lib/i18n";
// import { useEffect, useRef, useState, useMemo } from "react";

export type FilterValues = {
  category: string;
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
  setFilters: (v: FilterValues) => void;
};

type CategoryOption = { name: string; translation_key: string };
type AmenityOption = { name: string; translation_key: string };

export default function FilterBar({ locale, filters, setFilters }: Props) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [amenities, setAmenities] = useState<AmenityOption[]>([]);

  useEffect(() => {
    api
      .get<CategoryOption[]>("/categories/")
      .then((r) => setCategories(r.data));
    api.get<AmenityOption[]>("/amenities/").then((r) => setAmenities(r.data));
  }, []);

  const toggleAmenity = (name: string) => {
    setFilters({
      ...filters,
      amenities: filters.amenities.includes(name)
        ? filters.amenities.filter((x) => x !== name)
        : [...filters.amenities, name],
    });
  };

  const clearAll = () => {
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

  const apply = () => setFilters({ ...filters, __refresh: Date.now() });

  return (
    <div className="w-full max-w-[1600px] px-6 mx-auto">
      <div className="bg-white shadow-lg rounded-2xl px-6 py-5 -mt-8 relative z-10">
        {/* 1-р мөр: label + inputs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="flex flex-col">
            <label
              htmlFor="f-search"
              className="text-xs font-medium mb-1 text-gray-600"
            >
              {t(locale, "search_label") || "Хайх"}
            </label>
            <input
              id="f-search"
              type="text"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              placeholder={t(locale, "search_placeholder") || "Юу хайх вэ?"}
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Location */}
          <div className="flex flex-col">
            <label
              htmlFor="f-location"
              className="text-xs font-medium mb-1 text-gray-600"
            >
              {t(locale, "location_label") || "Байршил"}
            </label>
            <input
              id="f-location"
              type="text"
              value={filters.location}
              onChange={(e) =>
                setFilters({ ...filters, location: e.target.value })
              }
              placeholder={
                t(locale, "location_placeholder") || "Жишээ: Архангай, Цэнхэр"
              }
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Price */}
          <div className="flex flex-col">
            <label className="text-xs font-medium mb-1 text-gray-600">
              {t(locale, "price_label") || "Үнэ (₮)"}
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={filters.priceMin ?? ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    priceMin: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder={t(locale, "min") || "min"}
                className="border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number"
                inputMode="numeric"
                value={filters.priceMax ?? ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    priceMax: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder={t(locale, "max") || "max"}
                className="border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Amenities */}
          <AmenityPicker
            locale={locale}
            amenities={amenities}
            selected={filters.amenities}
            onToggle={toggleAmenity}
            onClear={() => setFilters({ ...filters, amenities: [] })}
            onApply={apply}
          />
        </div>

        {/* 2-р мөр: Categories + Actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const active = cat.name === filters.category;
              return (
                <button
                  key={cat.name}
                  onClick={() =>
                    setFilters({ ...filters, category: active ? "" : cat.name })
                  }
                  className={`px-3 py-2 rounded-full border text-sm transition
                    ${
                      active
                        ? "bg-green-600 text-white border-green-600"
                        : "hover:bg-gray-50"
                    }`}
                >
                  {t(locale, cat.translation_key) || cat.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={clearAll}
              className="text-sm text-gray-600 underline"
            >
              {t(locale, "clear") || "clear"}
            </button>
            <button
              onClick={() => setFilters({ ...filters, __refresh: Date.now() })}
              className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700"
            >
              {t(locale, "search_button") || "Хайх"}
            </button>
          </div>
        </div>

        {/* Сонгосон amenities */}
        {filters.amenities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filters.amenities.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-2 text-sm bg-green-50 text-green-800 border border-green-200 rounded-full px-3 py-1"
              >
                {name}
                <button
                  aria-label="remove"
                  onClick={() => toggleAmenity(name)}
                  className="rounded-full w-5 h-5 flex items-center justify-center border hover:bg-green-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ——— AmenityPicker ——— */
function AmenityPicker({
  locale,
  amenities,
  selected,
  onToggle,
  onClear,
  onApply,
}: {
  locale: string;
  amenities: AmenityOption[];
  selected: string[];
  onToggle: (name: string) => void;
  onClear: () => void;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const popRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      const tNode = e.target as Node;
      if (popRef.current?.contains(tNode) || btnRef.current?.contains(tNode))
        return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const list = useMemo(() => {
    if (!q.trim()) return amenities;
    const s = q.toLowerCase();
    return amenities.filter(
      (a: AmenityOption) =>
        (a.translation_key &&
          (t(locale, a.translation_key) || "").toLowerCase().includes(s)) ||
        a.name.toLowerCase().includes(s)
    );
  }, [q, amenities, locale]);
  const count = selected.length;

  return (
    <div className="flex flex-col relative">
      <label className="text-xs font-medium mb-1 text-gray-600">
        {t(locale, "amenities_label") || "Давуу талууд"}
      </label>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="border rounded-lg px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50"
      >
        <span>
          {count > 0
            ? `${t(locale, "selected") || "Сонгосон"}: ${count}`
            : t(locale, "choose_amenities") || "Давуу тал сонгох"}
        </span>
        <span className="ml-2 text-gray-500">▾</span>
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute left-0 top-[72px] w-[min(640px,92vw)] bg-white rounded-2xl shadow-2xl border p-4 z-50"
        >
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t(locale, "search_amenities") || "Давуу тал хайх..."}
              className="border rounded-lg px-3 py-2 flex-1"
            />
            <button
              onClick={onClear}
              className="text-sm text-gray-600 underline"
            >
              {t(locale, "clear") || "clear"}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {list.map((a) => {
              const label = t(locale, a.translation_key) || a.name;
              const checked = selected.includes(a.name);
              return (
                <label key={a.name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(a.name)}
                  />
                  <span className={checked ? "font-medium" : ""}>{label}</span>
                </label>
              );
            })}
            {list.length === 0 && (
              <div className="col-span-full text-sm text-gray-500">
                {t(locale, "no_results") || "Үр дүн олдсонгүй"}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-2 border rounded-lg"
            >
              {t(locale, "close") || "Хаах"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onApply();
              }}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              {t(locale, "apply") || "Хэрэгжүүлэх"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
