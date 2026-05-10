"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchUnreadNotifications,
  markAllNotificationsAsRead,
  markBookingNotificationsAsRead,
} from "@/lib/api";

type NotificationContextType = {
  totalUnread: number;
  bookingUnread: number;
  refresh: () => void;
  markAllAsRead: () => void;
  markBookingNotificationsAsRead: () => void;
};

const NotificationContext = createContext<NotificationContextType>({
  totalUnread: 0,
  bookingUnread: 0,
  refresh: () => {},
  markAllAsRead: () => {},
  markBookingNotificationsAsRead: () => {},
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

  const refresh = async () => {
    try {
      const res = await fetchUnreadNotifications();
      setTotalUnread(res.total_unread);
      setBookingUnread(res.booking_unread);
    } catch {
      // silent — 401 is expected when logged out
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setTotalUnread(0);
      setBookingUnread(0);
    } catch {
      // ignore
    }
  };

  const markBookingAsRead = async () => {
    try {
      await markBookingNotificationsAsRead();
      // Claude: clamp to 0 to prevent negative count on race conditions
      setTotalUnread((prev) => Math.max(0, prev - bookingUnread));
      setBookingUnread(0);
    } catch {
      // ignore
    }
  };

  // Claude: only start polling when user is authenticated
  useEffect(() => {
    if (!user) {
      setTotalUnread(0);
      setBookingUnread(0);
      return;
    }
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        totalUnread,
        bookingUnread,
        refresh,
        markAllAsRead,
        markBookingNotificationsAsRead: markBookingAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
