// filename: src/app/[locale]/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/axios"; // ✅ baseURL="/api"
import { useAuth } from "@/context/AuthContext";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import { t } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { locale: raw } = useParams();
  const locale = (typeof raw === "string" ? raw : "mn") as string;

  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); // ⬅️ form-ийн default navigation-ийг зогсооно
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post("/token/", { username, password });
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);

      await login(); // current user fetch гэх мэт
      router.replace(`/${locale}`); // амжилттай → эхлэл
    } catch (err: unknown) {
      // ✅ "unknown" болгож, runtime дээр шалгана
      const status =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        (err as { response?: { status?: number } }).response?.status;

      setError(
        status === 400 || status === 401
          ? t(locale, "invalid_credentials")
          : t(locale, "unknown_error")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">
          {t(locale, "login_title")}
        </h2>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <form onSubmit={handleLogin}>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            {t(locale, "username_label")}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />

          <label className="block text-gray-700 text-sm font-bold mb-2">
            {t(locale, "password_label")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-2 px-4 rounded"
          >
            {loading ? t(locale, "loading") : t(locale, "login_button")}
          </button>
        </form>

        <div className="my-6 flex items-center justify-between">
          <hr className="w-2/5 border-gray-300" />
          <span className="text-gray-500 text-sm">{t(locale, "or_text")}</span>
          <hr className="w-2/5 border-gray-300" />
        </div>

        <GoogleLoginButton />
      </div>
    </div>
  );
}
