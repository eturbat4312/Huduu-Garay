"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/axios";
import type { Booking } from "@/types";

type Message = { id: number; body: string; is_mine: boolean; created_at: string };

export default function BookingContact({ booking, host = false }: { booking: Booking; host?: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const retry = useRef<{ body: string; id: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const phone = host ? booking.guest_phone : booking.host_phone;
  const allowed = booking.can_contact && !blocked;

  useEffect(() => {
    if (!open || !allowed) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let after = 0;
    const poll = async () => {
      try {
        const { data } = await api.get<{ messages: Message[]; has_more: boolean }>(`/bookings/${booking.id}/messages/?after=${after}`);
        if (!active) return;
        setError("");
        if (data.messages.length) {
          after = data.messages[data.messages.length - 1].id;
          setMessages(previous => [...new Map([...previous, ...data.messages].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id));
          await api.post(`/bookings/${booking.id}/messages/read/`, { through: after });
        }
        if (active) timer = setTimeout(poll, data.has_more ? 50 : 5000);
      } catch (e: unknown) {
        if (!active) return;
        const status = (e as { response?: { status: number } }).response?.status;
        if (status === 403 || status === 404) { setBlocked(true); setMessages([]); }
        setError("Мессеж татаж чадсангүй. Дахин оролдоно уу.");
        if (status !== 403 && status !== 404) timer = setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [open, allowed, booking.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    if (retry.current?.body !== text) retry.current = { body: text, id: crypto.randomUUID() };
    setSending(true);
    try {
      const { data: sent } = await api.post<Message>(`/bookings/${booking.id}/messages/`, { body: text, client_id: retry.current.id });
      setMessages(prev => [...new Map([...prev, sent].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id));
      setBody(""); retry.current = null; setError("");
    } catch { setError("Илгээж чадсангүй. Бичсэн мессежээ дахин илгээнэ үү."); }
    finally { setSending(false); }
  }

  if (!allowed) return <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">Чат, утас нь төлбөр төлөгдөж, захиалга баталгаажсаны дараа нээгдэнэ.</p>;
  return <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
    <h2 className="font-semibold">{host ? "Зочинтой холбогдох" : "Түрээслүүлэгчтэй холбогдох"}</h2>
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="rounded-lg bg-green-700 px-4 py-2 text-white">Мессеж бичих{!open && booking.unread_message_count ? ` (${booking.unread_message_count})` : ""}</button>
      {phone && <><a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="rounded-lg border px-4 py-2">Залгах · {phone}</a><button type="button" className="text-sm underline" onClick={() => navigator.clipboard.writeText(phone).catch(() => setError("Дугаарыг хуулж чадсангүй."))}>Дугаар хуулах</button></>}
    </div>
    {open && <>
      <p className="text-sm text-gray-500">Захиалга #{booking.id} · {booking.check_in} — {booking.check_out}</p>
      <div role="log" aria-label="Захиалгын чат" className="max-h-80 space-y-3 overflow-y-auto">
        {!messages.length && <p className="text-sm text-gray-500">Одоогоор мессеж алга.</p>}
        {messages.map(m => <div key={m.id} className={`max-w-[90%] rounded-lg p-3 ${m.is_mine ? "ml-auto bg-green-50" : "bg-gray-100"}`}><p className="whitespace-pre-wrap break-words">{m.body}</p><time className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</time></div>)}
        <div ref={end} />
      </div>
      <form onSubmit={e => { e.preventDefault(); void send(); }} className="space-y-2">
        <textarea aria-label="Мессеж" maxLength={2000} value={body} disabled={sending} onChange={e => setBody(e.target.value)} placeholder="Мессежээ бичнэ үү…" className="w-full rounded-lg border p-3" rows={3} />
        <button disabled={sending || !body.trim()} className="rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-50">{sending ? "Илгээж байна…" : "Илгээх"}</button>
      </form>
    </>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
