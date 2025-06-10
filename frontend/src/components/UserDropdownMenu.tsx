// 📄 frontend/components/UserDropdownMenu.tsx

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchUnreadNotifications } from "@/lib/api";

export default function UserDropdownMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.is_host) {
      fetchUnreadNotifications()
        .then(setUnreadCount)
        .catch(() => {});
    }
  }, [user]);

  if (!user) return null;

  const toggleDropdown = () => setOpen((prev) => !prev);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
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
        <Avatar>
          <AvatarImage
            src={user.avatar || "/default-avatar.png"}
            alt={user.username}
          />
          <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium text-gray-700 hover:text-green-700 transition">
          Menu ⌄
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-lg z-50">
          <ul className="text-sm">
            <li>
              <button
                onClick={() => go("/profile")}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                👤 Миний профайл
              </button>
            </li>
            <li>
              <button
                onClick={() => go("/bookings")}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                📆 Миний захиалгууд
              </button>
            </li>
            <li>
              <button
                onClick={() => go("/favorites")}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                ❤️ Хадгалсан
              </button>
            </li>
            <li>
              <button
                onClick={() => go("/trips")}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                🧳 Өмнөх аяллууд
              </button>
            </li>
            <li>
              <button
                onClick={() => go("/account-settings")}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                ⚙️ Тохиргоо
              </button>
            </li>

            {user.is_host && (
              <>
                <hr className="my-1" />
                <li className="relative">
                  <button
                    onClick={() => go("/host-bookings")}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex justify-between items-center"
                  >
                    📥 Захиалга (Хост)
                    {unreadCount > 0 && (
                      <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 ml-2">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </li>
                <li className="relative">
                  <button
                    onClick={() => go("/notifications")}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex justify-between items-center"
                  >
                    🔔 Мэдэгдэл
                    {unreadCount > 0 && (
                      <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 ml-2">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => go("/host/listings")}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    📋 Миний зарууд
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => go("/create-listing")}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    ➕ Зар нэмэх
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
                🚪 Гарах
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
