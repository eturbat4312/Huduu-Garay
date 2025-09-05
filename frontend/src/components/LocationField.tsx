// filename: src/components/LocationField.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Value = {
  location_text: string;
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
  label = "Байршил (map-аас pin тавина)",
  placeholder = "Жишээ: Архангай, Цэнхэр",
  language = "mn",
}: {
  value: Value;
  onChange: (v: Value) => void;
  label?: string;
  placeholder?: string;
  language?: string;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeocodeFeature[]>([]);
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY!;

  // init map
  useEffect(() => {
    if (!mapRef.current || map.current) return;
    map.current = new maplibregl.Map({
      container: mapRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${key}`,
      center: [106.917, 47.918],
      zoom: 6.5,
    });
    map.current.on("click", (e) => placePin(e.lngLat.lng, e.lngLat.lat, true));
  }, [key]);

  // restore pin from value
  useEffect(() => {
    if (!map.current) return;
    if (value.location_lat != null && value.location_lng != null) {
      placePin(value.location_lng, value.location_lat, false);
    }
  }, [value.location_lat, value.location_lng]);

  const placePin = (lng: number, lat: number, reverse: boolean) => {
    if (!map.current) return;
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ draggable: true })
        .setLngLat([lng, lat])
        .addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLngLat();
        updateCoords(p.lng, p.lat, true);
      });
    } else {
      marker.current.setLngLat([lng, lat]);
    }
    map.current.flyTo({ center: [lng, lat], zoom: 10 });
    updateCoords(lng, lat, reverse);
  };

  const updateCoords = async (lng: number, lat: number, reverse: boolean) => {
    let text = value.location_text;
    if (reverse) {
      try {
        const r = await fetch(
          `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${key}&language=${language}`
        );
        const data = await r.json();
        text = data?.features?.[0]?.place_name || text || "";
      } catch {
        // ignore
      }
    }
    onChange({ location_text: text, location_lat: lat, location_lng: lng });
  };

  // forward geocode search
  useEffect(() => {
    const id = setTimeout(async () => {
      if (!q.trim()) return setResults([]);
      try {
        const r = await fetch(
          `https://api.maptiler.com/geocoding/${encodeURIComponent(
            q
          )}.json?key=${key}&language=${language}`
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
    placePin(lng, lat, false);
    onChange({
      location_text: f.place_name || "",
      location_lat: lat,
      location_lng: lng,
    });
    setQ(f.place_name || "");
    setResults([]);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      {/* хайлт */}
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full border rounded-lg px-3 py-2"
        />
        {results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow max-h-60 overflow-y-auto">
            {results.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => pick(f)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50"
              >
                {f.place_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* текст хаяг */}
      <input
        value={value.location_text || ""}
        onChange={(e) => onChange({ ...value, location_text: e.target.value })}
        className="w-full border rounded-lg px-3 py-2"
        placeholder="Хаягийн товч тайлбар (optional)"
      />

      {/* map */}
      <div className="h-72 rounded-xl overflow-hidden shadow">
        <div ref={mapRef} className="w-full h-full" />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="px-3 py-2 border rounded-lg"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition((pos) => {
              placePin(pos.coords.longitude, pos.coords.latitude, true);
            });
          }}
        >
          📍 Миний байршил
        </button>
        <button
          type="button"
          className="px-3 py-2 border rounded-lg"
          onClick={() =>
            onChange({
              location_text: "",
              location_lat: null,
              location_lng: null,
            })
          }
        >
          ❌ Цэвэрлэх
        </button>
      </div>
    </div>
  );
}
