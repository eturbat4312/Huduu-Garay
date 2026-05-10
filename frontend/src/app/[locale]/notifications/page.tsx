"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Link from "next/link";
import { markAllNotificationsAsRead } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useParams } from "next/navigation";

type Notification = {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  type?: string;
  related_booking?: number | null;
  related_listing?: number | null;
};

function getNotificationLink(n: Notification, locale: string): string {
  if (n.related_booking) {
    if (n.type === "booking_created" || n.type === "booking_cancelled") {
      // Host-ийн notification
      return `/${locale}/host-bookings/${n.related_booking}`;
    }
    if (n.type === "booking_confirmed") {
      // Guest-ийн notification
      return `/${locale}/bookings/${n.related_booking}`;
    }
  }
  if ((n.type === "review" || n.type === "comment") && n.related_listing) {
    return `/${locale}/listings/${n.related_listing}`;
  }
  return `/${locale}/notifications`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  //   const { locale } = useParams();
  const { locale } = useParams() as { locale: string };

  useEffect(() => {
    const fetchAndMarkRead = async () => {
      try {
        const res = await api.get("/notifications/");
        setNotifications(res.data);
        await markAllNotificationsAsRead();
      } catch (err) {
        console.error("Failed to load notifications", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndMarkRead();
  }, []);

  if (loading)
    return <p className="p-6">{t(locale, "notifications.loading")}</p>;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        🔔 {t(locale, "notifications.title")}
      </h1>
      {notifications.length === 0 ? (
        <p>{t(locale, "notifications.empty")}</p>
      ) : (
        <ul className="space-y-4">
          {/* Claude: unread items have blue left border + bold text + light bg */}
          {notifications.map((n) => {
            const href = getNotificationLink(n, locale);
            const isUnread = !n.is_read;
            return (
              <li
                key={n.id}
                className={`border rounded shadow hover:bg-gray-50 transition cursor-pointer flex items-start gap-3 p-4 ${
                  isUnread ? "bg-blue-50 border-l-4 border-l-blue-500" : "bg-white"
                }`}
              >
                {/* Claude: unread dot indicator */}
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${isUnread ? "bg-blue-500" : "bg-transparent"}`} />
                <Link href={href} className="flex-1">
                  <p className={`text-sm ${isUnread ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
