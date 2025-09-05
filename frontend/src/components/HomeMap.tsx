// filename: src/components/HomeMap.tsx
"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Listing } from "@/types";

type Props = { listings: Listing[]; locale?: string };

export default function HomeMap({ listings, locale = "mn" }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const refs = useRef<
    Record<number, { marker: maplibregl.Marker; popup: maplibregl.Popup }>
  >({});

  const fmt = (n: number | string) =>
    new Intl.NumberFormat("mn-MN").format(Number(n));

  // Init map
  useEffect(() => {
    if (map.current || !mapRef.current) return;
    map.current = new maplibregl.Map({
      container: mapRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
      center: [106.917, 47.918],
      zoom: 7,
    });
    map.current.addControl(
      new maplibregl.NavigationControl({ showZoom: true }),
      "bottom-right"
    );

    // Card -> open popup on map
    const openFromCard = (e: Event) => {
      const id = Number((e as CustomEvent).detail?.id);
      const pair = refs.current[id];
      if (!pair || !map.current) return;
      const ll = pair.marker.getLngLat();
      map.current.flyTo({
        center: ll,
        zoom: Math.max(map.current.getZoom(), 9),
        speed: 0.8,
      });
      pair.popup.addTo(map.current);
    };
    window.addEventListener("listing:card-click", openFromCard);
    return () => window.removeEventListener("listing:card-click", openFromCard);
  }, []);

  // Draw markers whenever listings change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    Object.values(refs.current).forEach(({ marker, popup }) => {
      marker.remove();
      popup.remove();
    });
    refs.current = {};

    listings.forEach((l) => {
      const lat = l.location_lat;
      const lng = l.location_lng;
      if (lat == null || lng == null) return;

      // Price badge marker
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "bg-white rounded-full border border-green-600 text-green-700 shadow px-3 py-1 text-sm font-semibold hover:bg-green-50 focus:outline-none";
      el.textContent = `${fmt(l.price_per_night)}₮`;

      // Mini-card popup
      const img = l.images && l.images.length > 0 ? l.images[0].image : null;
      const popupHtml = `
        <div class="w-64 rounded-xl overflow-hidden shadow-lg">
          ${
            img
              ? `<img src="${img}" class="w-full h-32 object-cover" />`
              : `<div class="w-full h-32 bg-gray-200 flex items-center justify-center text-gray-500">No image</div>`
          }
          <div class="p-3">
            <div class="font-semibold text-base mb-1">${l.title || ""}</div>
            <div class="text-sm text-gray-600 mb-2">${fmt(
              l.price_per_night
            )}₮ / шөнө</div>
            <a href="/${locale}/listings/${
        l.id
      }" class="inline-block text-sm px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 transition">
              Дэлгэрэнгүй
            </a>
          </div>
        </div>
      `;
      const popup = new maplibregl.Popup({
        offset: 14,
        closeButton: false,
        closeOnClick: false, // ❗ click хийхэд popup хаагдахгүй
      }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([Number(lng), Number(lat)])
        .setPopup(popup)
        .addTo(map.current!);

      // Hover → popup
      let hoverTimeout: NodeJS.Timeout;
      const keepOpenOnHover = () => clearTimeout(hoverTimeout);
      const allowCloseOnLeave = () => {
        hoverTimeout = setTimeout(() => popup.remove(), 200);
      };

      el.addEventListener("mouseenter", () => {
        clearTimeout(hoverTimeout);
        popup.addTo(map.current!);
        popup.setLngLat([Number(lng), Number(lat)]);

        // Popup дээр hover хийж байхад хаагдахгүй
        const popupEl = popup.getElement();
        popupEl.addEventListener("mouseenter", keepOpenOnHover);
        popupEl.addEventListener("mouseleave", allowCloseOnLeave);
      });
      el.addEventListener("mouseleave", allowCloseOnLeave);

      // Click → scroll to card
      el.addEventListener("click", () => {
        const ev = new CustomEvent("listing:marker-click", {
          detail: { id: l.id },
        });
        window.dispatchEvent(ev);
      });

      refs.current[l.id] = { marker, popup };
    });
  }, [listings, locale]);

  return <div ref={mapRef} className="w-full h-full" />;
}
