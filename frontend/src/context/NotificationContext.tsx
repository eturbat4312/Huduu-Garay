"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  const [totalUnread, setTotalUnread] = useState(0);
  const [bookingUnread, setBookingUnread] = useState(0);

  const refresh = async () => {
    try {
      const res = await fetchUnreadNotifications();
      setTotalUnread(res.total_unread);
      setBookingUnread(res.booking_unread);
    } catch (err) {
      console.error("🔁 Notification fetch error", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setTotalUnread(0);
      setBookingUnread(0);
    } catch (err) {
      console.error("❌ Failed to mark all notifications as read", err);
    }
  };

  const markBookingAsRead = async () => {
    try {
      await markBookingNotificationsAsRead();
      setTotalUnread((prev) => prev - bookingUnread); // нийтээс booking тоог хасна
      setBookingUnread(0);
    } catch (err) {
      console.error("❌ Failed to mark booking notifications as read", err);
    }
  };

  useEffect(() => {
    refresh(); // эхэнд 1 удаа
    const interval = setInterval(refresh, 60000); // 60 секунд тутам
    return () => clearInterval(interval);
  }, []);

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
