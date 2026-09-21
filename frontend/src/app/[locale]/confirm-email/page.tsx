"use client";

import axios from "axios";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import api from "@/lib/axios";


function ConfirmEmailContent() {
  const { locale } = useParams() as { locale: string };
  const searchParams = useSearchParams();
  const key = searchParams.get("key") || "";
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const confirmEmail = async () => {
    if (!key) {
      setError("Баталгаажуулах холбоос дутуу байна.");
      setState("error");
      return;
    }

    setState("loading");
    setError("");
    try {
      await api.post("/auth/registration/verify-email/", { key });
      setState("success");
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.status === 400
          ? "Энэ холбоос хүчингүй эсвэл өмнө нь ашиглагдсан байна."
          : "Имэйл баталгаажуулахад алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу."
      );
      setState("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-md rounded px-8 py-8 w-full max-w-md text-center space-y-5">
        <div className="text-5xl">{state === "success" ? "✅" : "📧"}</div>
        <h1 className="text-2xl font-bold text-gray-900">
          {state === "success" ? "Имэйл баталгаажлаа" : "Имэйл хаягаа баталгаажуулах"}
        </h1>

        {state === "success" ? (
          <>
            <p className="text-sm text-gray-600">
              Таны имэйл хаяг амжилттай баталгаажлаа. Одоо бүртгэлээрээ нэвтэрч болно.
            </p>
            <Link
              href={`/${locale}/login?email_verified=1`}
              className="inline-block w-full rounded bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700"
            >
              Нэвтрэх
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Доорх товчийг дарж бүртгэлийн имэйл хаягаа баталгаажуулна уу.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={confirmEmail}
              disabled={state === "loading" || !key}
              className="w-full rounded bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:bg-gray-400"
            >
              {state === "loading" ? "Баталгаажуулж байна..." : "Имэйл баталгаажуулах"}
            </button>
            <Link href={`/${locale}/login`} className="block text-sm text-green-700 hover:underline">
              Нэвтрэх хуудас руу буцах
            </Link>
          </>
        )}
      </div>
    </div>
  );
}


export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100" />}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
