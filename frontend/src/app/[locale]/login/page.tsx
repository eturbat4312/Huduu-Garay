"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import { t } from "@/lib/i18n";
import api from "@/lib/axios"; // baseURL = "/api"

export default function LoginPage() {
  const router = useRouter();
  const { locale } = useParams();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/token/", {
        username,
        password,
      });

      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);

      await login();
      setError("");
      router.push(`/${locale}`);
    } catch (err) {
      setError(t(locale as string, "invalid_credentials"));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">
          {t(locale as string, "login_title")}
        </h2>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <form onSubmit={handleLogin}>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            {t(locale as string, "username_label")}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />

          <label className="block text-gray-700 text-sm font-bold mb-2">
            {t(locale as string, "password_label")}
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
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            {t(locale as string, "login_button")}
          </button>
        </form>

        <div className="my-6 flex items-center justify-between">
          <hr className="w-2/5 border-gray-300" />
          <span className="text-gray-500 text-sm">
            {t(locale as string, "or_text")}
          </span>
          <hr className="w-2/5 border-gray-300" />
        </div>

        <GoogleLoginButton />
      </div>
    </div>
  );
}
