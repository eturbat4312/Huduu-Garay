// 📄 components/Navbar.tsx
"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/axios";
import UserDropdownMenu from "./UserDropdownMenu";

export default function Navbar() {
  const { user, logout, loading } = useAuth();

  const becomeHost = async () => {
    try {
      await api.patch("/me/", { is_host: true });
      window.location.reload(); // дахин ачаалж context шинэчилнэ
    } catch (error) {
      console.error("Host болох үед алдаа гарлаа", error);
      alert("Host болох үед алдаа гарлаа");
    }
  };
  //   console.log("🟢 Navbar component mounted");

  return (
    <nav className="bg-white shadow-md px-6 py-3 flex justify-between items-center">
      <Link href="/" className="text-xl font-bold text-green-700">
        Хөдөө Гарая
      </Link>

      {!loading && (
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {/* Зөвхөн host хэрэглэгчид зар нэмэх товч харагдана */}
              {user.is_host ? (
                <Link
                  href="/listings/new"
                  className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  Зар нэмэх
                </Link>
              ) : (
                <button
                  onClick={becomeHost}
                  className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                >
                  Host болох
                </button>
              )}

              {/* 👤 Dropdown menu */}
              <UserDropdownMenu />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-green-700 font-medium hover:underline"
              >
                Нэвтрэх
              </Link>
              <Link
                href="/signup"
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                Бүртгүүлэх
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
