// filename: src/components/PaymentContent.tsx
"use client";

import axios from "axios";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { Payment } from "@/types";

const localeMap: Record<string, string> = {
  mn: "mn-MN",
  en: "en-US",
  fr: "fr-FR",
};

const formatQrImage = (value?: string) => {
  if (!value) return null;
  if (value.startsWith("data:image")) return value;
  return `data:image/png;base64,${value}`;
};

export default function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale: rawLocale } = useParams();
  const locale = (typeof rawLocale === "string" ? rawLocale : "mn") as string;
  const uiLocale = localeMap[locale] || "mn-MN";
  const nf = useMemo(() => new Intl.NumberFormat(uiLocale), [uiLocale]);
  const paymentId = searchParams.get("payment");

  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [mockConfirming, setMockConfirming] = useState(false);
  const [error, setError] = useState("");

  const fetchPayment = useCallback(async () => {
    if (!paymentId) {
      setLoading(false);
      setError("Төлбөрийн дугаар дутуу байна.");
      return;
    }

    try {
      const res = await api.get<Payment>(`/payments/${paymentId}/`);
      setPayment(res.data);
      if (res.data.status === "paid" && res.data.booking_status === "confirmed") {
        router.push(`/${locale}/booking-success?booking=${res.data.booking_id}`);
      }
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || "Төлбөрийн мэдээлэл авахад алдаа гарлаа."
        : "Төлбөрийн мэдээлэл авахад алдаа гарлаа.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [locale, paymentId, router]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  const checkPayment = useCallback(async () => {
    if (!paymentId) return;
    setChecking(true);
    setError("");
    try {
      const res = await api.post<Payment>(`/payments/${paymentId}/check/`);
      setPayment(res.data);
      if (res.data.status === "paid" && res.data.booking_status === "confirmed") {
        router.push(`/${locale}/booking-success?booking=${res.data.booking_id}`);
      }
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || "Төлбөр шалгахад алдаа гарлаа."
        : "Төлбөр шалгахад алдаа гарлаа.";
      setError(msg);
    } finally {
      setChecking(false);
    }
  }, [locale, paymentId, router]);

  const mockConfirm = useCallback(async () => {
    if (!paymentId) return;
    setMockConfirming(true);
    setError("");
    try {
      const res = await api.post<Payment>(`/payments/${paymentId}/mock-confirm/`);
      setPayment(res.data);
      router.push(`/${locale}/booking-success?booking=${res.data.booking_id}`);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || "Local төлбөр баталгаажуулахад алдаа гарлаа."
        : "Local төлбөр баталгаажуулахад алдаа гарлаа.";
      setError(msg);
    } finally {
      setMockConfirming(false);
    }
  }, [locale, paymentId, router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-7 w-44 animate-pulse rounded bg-gray-200" />
        <div className="mt-6 h-80 animate-pulse rounded-2xl bg-gray-100" />
      </main>
    );
  }

  if (!payment) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Төлбөр олдсонгүй."}
        </div>
      </main>
    );
  }

  const qrImage = formatQrImage(payment.raw_response?.qr_image);
  const urls = payment.raw_response?.urls || [];
  const isMock = payment.raw_response?.mode === "mock";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold text-green-700">Төлбөр төлөх</h1>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm text-gray-500">Захиалга #{payment.booking_id}</div>
            <div className="mt-1 text-lg font-semibold">
              {payment.booking.listing.title}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {payment.booking.check_in} → {payment.booking.check_out}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-sm text-gray-500">Нийт төлөх</div>
            <div className="text-2xl font-bold text-green-700">
              ₮{nf.format(payment.amount)}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              Төлөв: {payment.status}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-[240px_1fr]">
          <div className="flex min-h-60 items-center justify-center rounded-xl border bg-gray-50 p-4">
            {qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImage} alt="QPay QR" className="max-h-52 max-w-52" />
            ) : (
              <div className="text-center text-sm text-gray-500">
                {isMock ? "Local mock invoice" : "QR код ирээгүй байна."}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {urls.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {urls.map((item, index) => (
                  <a
                    key={`${item.name || "bank"}-${index}`}
                    href={item.link}
                    className="rounded-lg border px-3 py-2 text-center text-sm font-medium hover:bg-gray-50"
                  >
                    {item.description || item.name || "Банкны апп"}
                  </a>
                ))}
              </div>
            )}

            {payment.raw_response?.qr_text && (
              <textarea
                readOnly
                value={payment.raw_response.qr_text}
                className="h-24 w-full resize-none rounded border bg-gray-50 p-2 text-xs text-gray-600"
              />
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={checkPayment}
                disabled={checking || payment.status !== "pending"}
                className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checking ? "Шалгаж байна..." : "Төлбөр шалгах"}
              </button>

              {isMock && (
                <button
                  type="button"
                  onClick={mockConfirm}
                  disabled={mockConfirming || payment.status !== "pending"}
                  className="rounded border px-4 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {mockConfirming ? "Баталгаажуулж байна..." : "Local mock confirm"}
                </button>
              )}
            </div>

            <p className="text-sm leading-6 text-gray-600">
              Төлбөр төлөгдсөний дараа QPay callback эсвэл энэ шалгах товчоор
              баталгаажиж, захиалга confirmed болно.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
