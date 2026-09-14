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
  const [redirecting, setRedirecting] = useState(false);

  const redirectIfPaid = useCallback(
    (nextPayment: Payment) => {
      if (
        nextPayment.status === "paid" &&
        nextPayment.booking_status === "confirmed"
      ) {
        setRedirecting(true);
        router.push(`/${locale}/booking-success?booking=${nextPayment.booking_id}`);
        return true;
      }
      return false;
    },
    [locale, router]
  );

  const fetchPayment = useCallback(async () => {
    if (!paymentId) {
      setLoading(false);
      setError("Төлбөрийн дугаар дутуу байна.");
      return;
    }

    try {
      const res = await api.get<Payment>(`/payments/${paymentId}/`);
      setPayment(res.data);
      redirectIfPaid(res.data);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || "Төлбөрийн мэдээлэл авахад алдаа гарлаа."
        : "Төлбөрийн мэдээлэл авахад алдаа гарлаа.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [paymentId, redirectIfPaid]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  const checkPayment = useCallback(async (silent = false) => {
    if (!paymentId) return;
    if (!silent) {
      setChecking(true);
      setError("");
    }
    try {
      const res = await api.post<Payment>(`/payments/${paymentId}/check/`);
      setPayment(res.data);
      redirectIfPaid(res.data);
    } catch (err) {
      if (silent) return;
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || "Төлбөр шалгахад алдаа гарлаа."
        : "Төлбөр шалгахад алдаа гарлаа.";
      setError(msg);
    } finally {
      if (!silent) {
        setChecking(false);
      }
    }
  }, [paymentId, redirectIfPaid]);

  useEffect(() => {
    if (!paymentId || payment?.status !== "pending") return undefined;

    const intervalId = window.setInterval(() => {
      void checkPayment(true);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [checkPayment, payment?.status, paymentId]);

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

      {redirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 text-center shadow-xl">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
            <div className="text-base font-semibold text-gray-900">
              Төлбөр баталгаажлаа
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Захиалгын амжилтын хуудас руу шилжүүлж байна...
            </div>
          </div>
        </div>
      )}

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
                onClick={() => checkPayment()}
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

            {payment.status === "pending" && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-200 border-t-green-700" />
                <span>Төлбөр автоматаар шалгаж байна...</span>
              </div>
            )}

            <p className="text-sm leading-6 text-gray-600">
              Төлбөр төлөгдсөний дараа автоматаар шалгаж, баталгаажмагц захиалгын
              амжилтын хуудас руу шилжинэ.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
