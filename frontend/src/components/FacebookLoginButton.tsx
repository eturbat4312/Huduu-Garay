"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import { facebookError, startFacebook } from "@/lib/facebook";

export default function FacebookLoginButton({ intent = "login" }: { intent?: "login" | "connect" }) {
  const { locale } = useParams() as { locale: string };
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.get<{ enabled: boolean }>("/auth/facebook/config/")
      .then(({ data }) => { if (active) setEnabled(data.enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const showPreview = process.env.NODE_ENV === "development";
  if (!enabled && !showPreview) return null;
  return <div className="mt-3">
    <button type="button" disabled={busy || !enabled} onClick={async () => {
      if (busy || !enabled) return;
      setBusy(true); setError("");
      try { await startFacebook(locale, intent); }
      catch (err) { setError(facebookError(err)); setBusy(false); }
    }} className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#1877F2] px-4 py-3 font-semibold text-white hover:bg-[#166FE5] disabled:opacity-60">
      {busy ? "Facebook нээж байна..." : intent === "connect" ? "Facebook холбох" : "Facebook-ээр үргэлжлүүлэх"}
    </button>
    {!enabled && showPreview && <p className="mt-2 text-center text-sm text-gray-500">Facebook нэвтрэлт тохиргоо хүлээгдэж байна. Meta App холбосны дараа идэвхжинэ.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </div>;
}
