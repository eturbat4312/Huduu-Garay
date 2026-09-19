"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const VISITOR_KEY = "tanaid_analytics_visitor";
const SESSION_KEY = "tanaid_analytics_session";
const LAST_VIEW_KEY = "tanaid_analytics_last_view";

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreate(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const value = createId();
  storage.setItem(key, value);
  return value;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    try {
      const now = Date.now();
      const lastView = JSON.parse(
        sessionStorage.getItem(LAST_VIEW_KEY) || "null",
      ) as { path?: string; at?: number } | null;
      if (
        lastView?.path === pathname &&
        typeof lastView.at === "number" &&
        now - lastView.at < 1000
      ) {
        return;
      }
      sessionStorage.setItem(LAST_VIEW_KEY, JSON.stringify({ path: pathname, at: now }));

      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/+$/, "");
      void fetch(`${baseUrl}/analytics/events/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          event_id: createId(),
          event_type: "web_page_view",
          visitor_id: getOrCreate(localStorage, VISITOR_KEY),
          session_id: getOrCreate(sessionStorage, SESSION_KEY),
          path: pathname,
          platform: "web",
        }),
      }).catch(() => undefined);
    } catch {
      // Хандалтын бүртгэл үндсэн хэрэглээнд нөлөөлөх ёсгүй.
    }
  }, [pathname]);

  return null;
}
