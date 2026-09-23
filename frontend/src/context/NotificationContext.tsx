"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchUnreadNotifications,
  markAllNotificationsAsRead,
  markBookingNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/api";

type NotificationContextType = {
  totalUnread: number;
  bookingUnread: number;
  refresh: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markOneAsRead: (notificationId: number, type?: string) => Promise<void>;
  markBookingNotificationsAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType>({
  totalUnread: 0,
  bookingUnread: 0,
  refresh: async () => {},
  markAllAsRead: async () => {},
  markOneAsRead: async () => {},
  markBookingNotificationsAsRead: async () => {},
});

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Claude: only poll when user is logged in — avoids 401 loops for anonymous visitors
  const { user } = useAuth();

  const [totalUnread, setTotalUnread] = useState(0);
  const [bookingUnread, setBookingUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchUnreadNotifications();
      setTotalUnread(res.total_unread);
      setBookingUnread(res.booking_unread);
    } catch {
      // silent — 401 is expected when logged out
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    await markAllNotificationsAsRead();
    setTotalUnread(0);
    setBookingUnread(0);
  }, []);

  const markOneAsRead = useCallback(async (notificationId: number, type?: string) => {
    await markNotificationAsRead(notificationId);
    setTotalUnread((current) => Math.max(0, current - 1));
    if (
      type &&
      ["booking_created", "booking_confirmed", "booking_cancelled", "admin_booking"].includes(type)
    ) {
      setBookingUnread((current) => Math.max(0, current - 1));
    }
  }, []);

  const markBookingAsRead = useCallback(async () => {
    try {
      await markBookingNotificationsAsRead();
      // Claude: clamp to 0 to prevent negative count on race conditions
      setTotalUnread((prev) => Math.max(0, prev - bookingUnread));
      setBookingUnread(0);
    } catch {
      // ignore
    }
  }, [bookingUnread]);

  // Claude: only start polling when user is authenticated
  useEffect(() => {
    if (!user) {
      setTotalUnread(0);
      setBookingUnread(0);
      return;
    }
    refresh();
    const interval = setInterval(refresh, 60000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, refresh]);

  return (
    <NotificationContext.Provider
      value={{
        totalUnread,
        bookingUnread,
        refresh,
        markAllAsRead,
        markOneAsRead,
        markBookingNotificationsAsRead: markBookingAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
