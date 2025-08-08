// filename: src/components/UserDropdownMenu.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { t } from "@/lib/i18n";

export default function UserDropdownMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { locale } = useParams();
  const { totalUnread, bookingUnread } = useNotification();

  if (!user) return null;

  const toggleDropdown = () => setOpen((prev) => !prev);

  const handleLogout = async () => {
    await logout();
    // window.location.href = "/";
    router.push(`/${locale}`);
  };

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 py-1 rounded-full hover:bg-gray-100 transition"
      >
        <span className="text-sm font-medium text-gray-700 hover:text-green-700 transition">
          {t(locale, "menu_label")}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-lg z-50">
          <ul className="text-sm">
            <li>
              <button
                // onClick={() => go("/profile")}
                onClick={() => go(`/${locale}/profile`)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                {t(locale, "menu_profile")}
              </button>
            </li>
            <li>
              <button
                onClick={() => go(`/${locale}/bookings`)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                {t(locale, "menu_bookings")}
              </button>
            </li>
            <li>
              <button
                onClick={() => go(`/${locale}/favorites`)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                {t(locale, "menu_favorites")}
              </button>
            </li>
            <li>
              <button
                onClick={() => go(`/${locale}/terms`)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                {t(locale, "menu_terms")}
              </button>
            </li>
            <li>
              <button
                onClick={() => go("/account-settings")}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                {t(locale, "menu_settings")}
              </button>
            </li>

            {user.is_host && (
              <>
                <hr className="my-1" />
                <li className="relative">
                  <button
                    onClick={() => go(`/${locale}/host-bookings`)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex justify-between items-center"
                  >
                    {t(locale, "menu_host_bookings")}
                    {bookingUnread > 0 && (
                      <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 ml-2">
                        {bookingUnread}
                      </span>
                    )}
                  </button>
                </li>
                <li className="relative">
                  <button
                    onClick={() => go(`/${locale}/notifications`)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex justify-between items-center"
                  >
                    {t(locale, "menu_notifications")}
                    {totalUnread > 0 && (
                      <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 ml-2">
                        {totalUnread}
                      </span>
                    )}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => go(`/${locale}/my-listings`)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    {t(locale, "menu_my_listings")}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => go(`/${locale}/listings/new`)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    {t(locale, "menu_add_listing")}
                  </button>
                </li>
              </>
            )}

            <hr className="my-1" />
            <li>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
              >
                {t(locale, "menu_logout")}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
