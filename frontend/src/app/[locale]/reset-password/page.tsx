"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import Link from "next/link";

export default function ResetPasswordPage() {
  const { locale } = useParams() as { locale: string };
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Нууц үг таарахгүй байна.");
      return;
    }
    if (password.length < 8) {
      setError("Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой.");
      return;
    }
    if (!uid || !token) {
      setError("Холбоос буруу байна. Имэйлээ дахин шалгана уу.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.post("/password-reset/confirm/", { uid, token, new_password: password });
      setSuccess(true);
    } catch (err: unknown) {
      const detail =
        typeof err === "object" &&
        err !== null &&
        "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(detail || "Холбоос хүчингүй эсвэл хугацаа дууссан байна.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-green-700">Нууц үг амжилттай шинэчлэгдлээ!</h2>
          <p className="text-gray-600 text-sm">Та шинэ нууц үгээрээ нэвтэрч болно.</p>
          <Link href={`/${locale}/login`} className="block text-green-600 hover:underline text-sm">
            → Нэвтрэх хуудас руу очих
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-2">Нууц үг шинэчлэх</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          Шинэ нууц үгээ оруулна уу.
        </p>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Шинэ нууц үг
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Хамгийн багадаа 8 тэмдэгт"
            required
          />

          <label className="block text-gray-700 text-sm font-bold mb-2">
            Нууц үг давтах
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Нууц үгийг дахин оруулна уу"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {loading ? "Шинэчилж байна..." : "Нууц үг шинэчлэх"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href={`/${locale}/login`} className="text-sm text-green-600 hover:underline">
            ← Нэвтрэх хуудас руу буцах
          </Link>
        </div>
      </div>
    </div>
  );
}
