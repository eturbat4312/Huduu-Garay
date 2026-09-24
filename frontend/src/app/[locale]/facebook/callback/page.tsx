"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { completeFacebook, facebookError, facebookReturnPath, forgetFacebookExchange } from "@/lib/facebook";
import { useAuth } from "@/context/AuthContext";

function Callback() {
  const { locale } = useParams() as { locale: string };
  const code = useSearchParams().get("code");
  const router = useRouter();
  const { setUser, loading } = useAuth();
  const [error, setError] = useState("");
  const message = code ? error : "Нэвтрэх холбоосын мэдээлэл дутуу байна.";
  useEffect(() => {
    let active = true;
    if (!code || loading) return;
    completeFacebook(code).then(async result => {
      if (!active) return;
      if (result.status === "authenticated") {
        const { data } = await api.get("/me/");
        if (active) { forgetFacebookExchange(); setUser(data); router.replace(facebookReturnPath(locale)); }
      } else if (result.status === "account_required") {
        forgetFacebookExchange();
        router.replace(`/${locale}/facebook/connect`);
      } else {
        forgetFacebookExchange();
        setError(result.status === "cancelled" ? "Facebook нэвтрэлтийг цуцаллаа." : "Facebook нэвтрэлтийг баталгаажуулж чадсангүй. Дахин оролдоно уу.");
      }
    }).catch(err => { if (active) setError(facebookError(err)); });
    return () => { active = false; };
  }, [code, locale, router, setUser, loading]);
  return <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
    <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
      <h1 className="mb-4 text-xl font-semibold">Facebook нэвтрэлт</h1>
      <p role={message ? "alert" : "status"}>{message || "Нэвтрэлтийг баталгаажуулж байна..."}</p>
      {message && <Link className="mt-6 block text-green-700 underline" href={`/${locale}/login`}>Нэвтрэх хуудас руу буцах</Link>}
    </div>
  </main>;
}
export default function FacebookCallbackPage() {
  return <Suspense fallback={<p className="p-8">Нэвтрэлтийг шалгаж байна...</p>}><Callback /></Suspense>;
}
