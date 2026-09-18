"use client";

import { useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle, Description } from "@headlessui/react";
import { isAxiosError } from "axios";
import { LoaderCircle } from "lucide-react";
import api from "@/lib/axios";
import type { Booking } from "@/types";

export default function HostCancellationAction({ booking, locale, onChange }: {
  booking: Booking;
  locale: string;
  onChange: (booking: Booking) => void;
}) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const cancellation = booking.host_cancellation;

  const cancelBooking = async () => {
    if (!accepted || !reason.trim() || !cancellation?.allowed || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api.post<Booking>(`/bookings/${booking.id}/host-cancel/`, {
        policy_accepted: true,
        policy_version: cancellation.policy_version,
        reason,
      });
      onChange(response.data);
      setOpen(false);
    } catch (err) {
      setError(isAxiosError(err) && typeof err.response?.data?.error === "string"
        ? err.response.data.error
        : "Цуцлах хүсэлтийг баталгаажуулж чадсангүй. Захиалгаа шинэчилж шалгаад дахин оролдоно уу.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  if (!cancellation?.allowed) {
    return booking.status === "confirmed" && !booking.guest_cancelled_at && cancellation?.blocked_reason
      ? <p className="text-sm text-gray-600">{cancellation.blocked_reason}</p>
      : null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAccepted(false);
          setReason("");
          setError("");
          setOpen(true);
        }}
        className="rounded border border-red-700 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Захиалга цуцлах
      </button>
      <Dialog open={open} onClose={() => { if (!busy) setOpen(false); }} className="fixed inset-0 z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <DialogPanel className="w-full max-w-lg space-y-4 rounded-lg bg-white p-5 text-gray-900 shadow-lg sm:p-6">
              <DialogTitle className="text-xl font-semibold">Захиалга цуцлах уу?</DialogTitle>
              <Description className="break-words text-sm text-gray-600">
                Захиалга #{booking.id}: {booking.listing.title}
              </Description>
              <ul className="list-disc space-y-3 pl-5 text-sm leading-6">
                {cancellation.policy.map((paragraph) => <li key={paragraph}>{paragraph}</li>)}
              </ul>
              <a href={`/${locale}/host-terms`} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-green-800 underline">
                Түрээслүүлэгчийн нөхцөл
              </a>
              <label className="block space-y-2 text-sm">
                <span>Цуцлах шалтгаан</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={busy}
                  required
                  maxLength={1000}
                  rows={4}
                  className="block w-full resize-y rounded border border-gray-400 p-2"
                  placeholder="Жишээ: байранд яаралтай засвар хийх шаардлагатай болсон"
                />
                <span className="block text-right text-xs text-gray-500">{reason.length}/1000</span>
              </label>
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={accepted}
                  disabled={busy}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-1 size-4 shrink-0"
                />
                <span>Цуцлалтын нөхцөл болон зочинд 100% буцаалт олгохыг зөвшөөрлөө.</span>
              </label>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
                <button type="button" data-autofocus disabled={busy} onClick={() => setOpen(false)} className="rounded border px-4 py-2 text-sm disabled:opacity-50">
                  Захиалгаа хадгалах
                </button>
                <button
                  type="button"
                  disabled={!accepted || !reason.trim() || busy}
                  onClick={cancelBooking}
                  className="flex items-center justify-center gap-2 rounded bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
                  {busy ? "Цуцалж байна..." : "Цуцлалтыг батлах"}
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}
