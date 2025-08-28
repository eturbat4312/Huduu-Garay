// filename: src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import UserDropdownMenu from "./UserDropdownMenu";
import { useRouter, useParams, usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useState } from "react";
import { t } from "@/lib/i18n";
import Image from "next/image";

const supportedLocales = [
  { code: "mn", label: "🇲🇳" },
  { code: "en", label: "🇬🇧" },
  { code: "fr", label: "🇫🇷" },
];

export default function Navbar() {
  const { user, loading } = useAuth();
  const { totalUnread } = useNotification();
  const router = useRouter();
  const { locale } = useParams();
  const pathname = usePathname();
  const basePath = pathname.replace(/^\/(mn|en|fr)/, "");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white shadow-md px-4 py-2 flex justify-between items-center relative">
      {/* ✅ Logo */}
      <Link href={`/${locale}`} className="flex items-center">
        <Image
          src="/logo3.png"
          alt="Танаид Хонъё"
          width={200}
          height={80}
          priority
          className="h-10 w-auto sm:h-12 md:h-14"
        />
      </Link>

      {/* ✅ Desktop menu */}
      <div className="hidden md:flex items-center gap-4">
        {/* 🌍 Language switcher */}
        <div className="flex gap-1 items-center">
          {supportedLocales.map((lang) => (
            <Link
              key={lang.code}
              href={`/${lang.code}${basePath}`}
              className={`text-xl px-2 rounded ${
                lang.code === locale
                  ? "font-bold text-green-700"
                  : "text-gray-400 hover:text-green-600"
              }`}
              title={lang.code}
            >
              {lang.label}
            </Link>
          ))}
        </div>

        {!loading ? (
          user ? (
            <>
              {user.is_host ? (
                <Link
                  href={`/${locale}/listings/new`}
                  className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  {t(locale as string, "add_listing")}
                </Link>
              ) : user.host_application_status === "pending" ? (
                <span className="bg-gray-300 text-gray-700 px-3 py-1 rounded cursor-not-allowed text-sm">
                  ⏳ {t(locale as string, "host_application_pending")}
                </span>
              ) : (
                <Link
                  href={`/${locale}/become-host`}
                  className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                >
                  {t(locale as string, "become_host")}
                </Link>
              )}

              {user.is_host && (
                <button
                  onClick={() => router.push(`/${locale}/notifications`)}
                  className="relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-6 h-6 text-gray-700 hover:text-green-700 transition" />
                  {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 rounded-full">
                      {totalUnread}
                    </span>
                  )}
                </button>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 hidden sm:block">
                  {t(locale as string, "greeting")}, <b>{user.username}</b>!
                </span>
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt="Avatar"
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-semibold text-lg">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <UserDropdownMenu />
            </>
          ) : (
            <>
              <Link
                href={`/${locale}/login`}
                className="text-green-700 font-medium hover:underline"
              >
                {t(locale as string, "login")}
              </Link>
              <Link
                href={`/${locale}/signup`}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                {t(locale as string, "signup")}
              </Link>
            </>
          )
        ) : (
          <span className="text-gray-400 text-sm">
            {t(locale as string, "loading")}
          </span>
        )}
      </div>

      {/* ✅ Mobile menu button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden text-2xl"
      >
        ☰
      </button>

      {/* ✅ Mobile dropdown */}
      {menuOpen && (
        <div className="absolute top-14 right-4 bg-white shadow-lg rounded p-4 flex flex-col gap-3 md:hidden z-50">
          {supportedLocales.map((lang) => (
            <Link
              key={lang.code}
              href={`/${lang.code}${basePath}`}
              className={`${
                lang.code === locale
                  ? "font-bold text-green-700"
                  : "text-gray-400 hover:text-green-600"
              }`}
            >
              {lang.label}
            </Link>
          ))}

          {!loading ? (
            user ? (
              <>
                <Link
                  href={`/${locale}/listings/new`}
                  className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-center"
                >
                  {t(locale as string, "add_listing")}
                </Link>
                <Link
                  href={`/${locale}/notifications`}
                  className="text-gray-700 text-center"
                >
                  🔔 {t(locale as string, "notifications")}
                </Link>
                <UserDropdownMenu />
              </>
            ) : (
              <>
                <Link
                  href={`/${locale}/login`}
                  className="text-green-700 text-center"
                >
                  {t(locale as string, "login")}
                </Link>
                <Link
                  href={`/${locale}/signup`}
                  className="bg-green-600 text-white px-3 py-1 rounded text-center"
                >
                  {t(locale as string, "signup")}
                </Link>
              </>
            )
          ) : (
            <span className="text-gray-400 text-sm">
              {t(locale as string, "loading")}
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
