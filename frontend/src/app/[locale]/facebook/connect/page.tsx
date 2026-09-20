"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/axios";
import { clearFacebookPending, facebookError, getFacebookPending, storeFacebookTokens, type FacebookPending } from "@/lib/facebook";
import FacebookLoginButton from "@/components/FacebookLoginButton";

export default function FacebookConnectPage() {
  const { locale } = useParams() as { locale: string };
  const router = useRouter();
  const { user, loading, setUser, logout } = useAuth();
  const [pending, setPending] = useState<FacebookPending | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  useEffect(() => { setPending(getFacebookPending()); setReady(true); }, []);

  async function act(action: "connect" | "send-code" | "register") {
    if (!pending || busy) return;
    setBusy(true); setError("");
    try {
      const { data } = await api.post(`/auth/facebook/${action}/`, {
        pending_token: pending.pending_token,
        ...(action === "connect" ? { confirm_link: true } : {}),
        ...(action === "register" ? { confirm_new_account: true, email_code: code } : {}),
      });
      if (action === "send-code") { setSent(true); return; }
      if (action === "register") {
        storeFacebookTokens(data);
        const profile = await api.get("/me/");
        setUser(profile.data);
      }
      clearFacebookPending();
      router.replace(`/${locale}/profile`);
    } catch (err) { setError(facebookError(err)); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
    <section className="w-full max-w-lg space-y-5 rounded-xl bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold">Facebook холбох</h1>
      {!ready || loading ? <p>Бүртгэлийг шалгаж байна...</p> : !pending ? <>
        <p>Холбох хүсэлт дууссан байна. Facebook-ээр дахин эхлүүлнэ үү.</p>
        <FacebookLoginButton intent={user ? "connect" : "login"} />
        <Link href={`/${locale}/login`} className="block text-green-700 underline">Нэвтрэх хуудас руу буцах</Link>
      </> : <>
        <p className="text-gray-600">Facebook: <strong>{pending.name || "Таны Facebook"}</strong>{pending.email && <> · {pending.email}</>}</p>
        {user ? <>
          <p><strong>{user.email || user.username}</strong> аккаунтдаа энэ Facebook-ийг холбох уу? Захиалга, хадгалсан зүйлс энэ аккаунтдаа үлдэнэ.</p>
          <button disabled={busy} onClick={() => act("connect")} className="w-full rounded-lg bg-[#1877F2] p-3 font-semibold text-white disabled:opacity-60">{busy ? "Холбож байна..." : "Энэ аккаунтад Facebook холбох"}</button>
          <button disabled={busy} onClick={async () => { await logout(); router.push(`/${locale}/login`); }} className="text-sm text-green-700 underline">Өөр аккаунтаар нэвтрэх</button>
        </> : <>
          <p>Өмнө нь бүртгүүлсэн бол Google эсвэл нууц үгээрээ нэвтэрч Facebook-ээ холбоно уу. Facebook-ийн имэйл өөр байсан ч өмнөх аккаунтаа ашиглаж болно.</p>
          {!pending.email && <p className="rounded-lg bg-amber-50 p-3 text-sm">Facebook имэйл хаяг дамжуулсангүй. Өмнөх аккаунтаараа нэвтэрнэ үү. Шинэ хэрэглэгч бол имэйлээр бүртгүүлсний дараа Facebook-ээ холбоно.</p>}
          <Link href={`/${locale}/login`} className="block rounded-lg bg-green-700 p-3 text-center font-semibold text-white">Өмнөх аккаунтаар нэвтрэх</Link>
          {!pending.email && <Link href={`/${locale}/signup`} className="block text-center text-green-700 underline">Имэйлээр бүртгүүлэх</Link>}
          {pending.can_register && <div className="space-y-3 border-t pt-5">
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={creating} onChange={e => setCreating(e.target.checked)} className="mt-1" />Өмнө нь бүртгүүлээгүй. Шинэ аккаунт үүсгэнэ. Өмнөх аккаунтын захиалга шинэ аккаунтад шилжихгүйг ойлголоо.</label>
            {creating && <>
              <p className="text-sm text-gray-600">{pending.email} хаягаа баталгаажуулна уу.</p>
              <button disabled={busy} onClick={() => act("send-code")} className="text-green-700 underline disabled:opacity-60">{busy ? "Түр хүлээнэ үү..." : sent ? "Код дахин илгээх" : "Имэйлд код илгээх"}</button>
              {sent && <form onSubmit={e => { e.preventDefault(); void act("register"); }} className="space-y-3">
                <label className="block text-sm" htmlFor="facebook-email-code">Имэйлд ирсэн 6 оронтой код (Spam/Junk хавтсыг мөн шалгана уу)</label>
                <input id="facebook-email-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required className="w-full rounded-lg border p-3" />
                <button disabled={busy || code.length !== 6} className="w-full rounded-lg bg-[#1877F2] p-3 font-semibold text-white disabled:opacity-60">{busy ? "Бүртгэж байна..." : "Баталгаажуулж бүртгүүлэх"}</button>
              </form>}
            </>}
          </div>}
        </>}
        <button disabled={busy} onClick={() => { clearFacebookPending(); router.replace(`/${locale}/login`); }} className="block text-sm text-gray-500 underline">Холбох хүсэлтийг цуцлах</button>
      </>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  </main>;
}
