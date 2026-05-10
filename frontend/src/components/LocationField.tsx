// filename: src/components/LocationField.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type LocationValue = {
  location_city: string;
  location_district: string;
  location_khoroo: string;
  location_extra: string;
  location_building: string;
  location_apartment: string;
  location_lat: number | null;
  location_lng: number | null;
};

type GeocodeFeature = {
  id: string;
  place_name: string;
  center?: [number, number];
  geometry?: { coordinates?: [number, number] };
};

export default function LocationField({
  value,
  onChange,
  language = "mn",
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  language?: string;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeocodeFeature[]>([]);
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY!;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!mapRef.current || map.current) return;
    map.current = new maplibregl.Map({
      container: mapRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${key}`,
      center: [106.917, 47.918],
      zoom: 6.5,
    });
    map.current.on("click", (e) => placePin(e.lngLat.lng, e.lngLat.lat));
  }, [key]);

  useEffect(() => {
    if (!map.current) return;
    if (value.location_lat != null && value.location_lng != null) {
      placePin(value.location_lng, value.location_lat);
    }
  }, [value.location_lat, value.location_lng]);

  const placePin = (lng: number, lat: number) => {
    if (!map.current) return;
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ draggable: true })
        .setLngLat([lng, lat])
        .addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLngLat();
        onChange({ ...valueRef.current, location_lat: p.lat, location_lng: p.lng });
      });
    } else {
      marker.current.setLngLat([lng, lat]);
    }
    map.current.flyTo({ center: [lng, lat], zoom: 13 });
    onChange({ ...valueRef.current, location_lat: lat, location_lng: lng });
  };

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!q.trim()) return setResults([]);
      try {
        const r = await fetch(
          `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${key}&language=${language}`
        );
        const data = await r.json();
        setResults(data?.features || []);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q, key, language]);

  const pick = (f: GeocodeFeature) => {
    const [lng, lat] = f.center || f.geometry?.coordinates || [];
    if (lng == null || lat == null) return;
    placePin(lng, lat);
    setQ(f.place_name || "");
    setResults([]);
  };

  const update = (field: keyof LocationValue, val: string) => {
    onChange({ ...valueRef.current, [field]: val });
  };

  return (
    <div className="space-y-4">
      {/* Map search */}
      <div>
        <label className="text-sm font-medium block mb-1">Газрын зураг дээр байршил хайх</label>
        <div className="relative" ref={searchRef}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Хот, дүүрэг, гудамж хайх..."
            className="w-full border rounded-lg px-3 py-2"
          />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow max-h-60 overflow-y-auto">
              {results.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => pick(f)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                >
                  {f.place_name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="h-72 rounded-xl overflow-hidden shadow">
        <div ref={mapRef} className="w-full h-full" />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="px-3 py-2 border rounded-lg text-sm"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition((pos) => {
              placePin(pos.coords.longitude, pos.coords.latitude);
            });
          }}
        >
          📍 Миний байршил
        </button>
        <button
          type="button"
          className="px-3 py-2 border rounded-lg text-sm"
          onClick={() =>
            onChange({
              location_city: "",
              location_district: "",
              location_khoroo: "",
              location_extra: "",
              location_building: "",
              location_apartment: "",
              location_lat: null,
              location_lng: null,
            })
          }
        >
          ❌ Цэвэрлэх
        </button>
      </div>

      {/* Public fields */}
      <div className="border rounded-xl p-4 space-y-3 bg-green-50">
        <p className="text-sm font-semibold text-green-800">🌍 Нийтэд харагдах хаяг</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Хот / Аймаг <span className="text-red-500">*</span></label>
            <input
              value={value.location_city}
              onChange={(e) => update("location_city", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Улаанбаатар"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Дүүрэг / Сум <span className="text-red-500">*</span></label>
            <input
              value={value.location_district}
              onChange={(e) => update("location_district", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Сүхбаатар дүүрэг"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Хороо / Баг</label>
            <input
              value={value.location_khoroo}
              onChange={(e) => update("location_khoroo", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="26-р хороо"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Хороолол / Нэмэлт</label>
            <input
              value={value.location_extra}
              onChange={(e) => update("location_extra", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Дүнжингарав, Sky Tower..."
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-600 block mb-1">Байр / Хаяг</label>
          <input
            value={value.location_building}
            onChange={(e) => update("location_building", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="15-р байр"
          />
        </div>
      </div>

      {/* Private field — apartment only */}
      <div className="border rounded-xl p-4 bg-yellow-50">
        <p className="text-sm font-semibold text-yellow-800 mb-3">🔒 Захиалсны дараа харагдах</p>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Тоот</label>
          <input
            value={value.location_apartment}
            onChange={(e) => update("location_apartment", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="42"
          />
        </div>
      </div>
    </div>
  );
}
