"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const { locale } = useParams() as { locale: string };
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/password-reset/", { email });
      setSubmitted(true);
    } catch {
      setError("Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md text-center space-y-4">
          <div className="text-5xl">📧</div>
          <h2 className="text-xl font-bold text-green-700">Имэйл илгээгдлээ!</h2>
          <p className="text-gray-600 text-sm">
            <strong>{email}</strong> хаяг руу нууц үг сэргээх холбоос илгээгдлээ.
            Имэйлээ шалгаад холбоосоор орно уу.
          </p>
          <p className="text-xs text-gray-400">Имэйл ирэхгүй байвал spam хавтсаа шалгана уу.</p>
          <Link href={`/${locale}/login`} className="block text-green-600 hover:underline text-sm">
            ← Нэвтрэх хуудас руу буцах
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-2">Нууц үг сэргээх</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          Бүртгэлтэй имэйл хаягаа оруулна уу. Сэргээх холбоос явуулна.
        </p>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Имэйл хаяг
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="example@gmail.com"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {loading ? "Илгээж байна..." : "Холбоос илгээх"}
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
