"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Clock3, Headphones, Loader2, Send } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import api from "@/lib/axios";

type SupportRequest = {
  id: number;
  category: string;
  category_display: string;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "answered" | "closed";
  status_display: string;
  admin_reply: string;
  responded_at: string | null;
  created_at: string;
};

const categories = [
  { value: "booking", label: "Захиалга" },
  { value: "payment", label: "Төлбөр, буцаалт" },
  { value: "listing", label: "Зар, түрээслүүлэлт" },
  { value: "account", label: "Бүртгэл" },
  { value: "other", label: "Бусад" },
];

const faqs = [
  {
    question: "Байранд орох, гарах цаг хэд вэ?",
    answer: "Платформын бүх байрны стандарт орох цаг 14:00, гарах цаг 12:00 байна. Түрээслүүлэгч байрны боломжид үндэслэн эрт оруулах эсвэл хожуу гаргахыг зөвшөөрч болох ч энэ нь урьдчилан тохиролцсон нэмэлт боломж юм.",
  },
  {
    question: "Захиалга хэзээ баталгаажих вэ?",
    answer: "QPay төлбөр амжилттай төлөгдөж, систем төлбөрийг шалгасны дараа захиалга баталгаажна. Төлбөр хүлээгдэж байгаа үед сонгосон өдрүүд 15 минут түр хадгалагдана.",
  },
  {
    question: "Захиалгаа хэрхэн цуцлах вэ?",
    answer: "Миний захиалгууд хэсгээс тухайн захиалгын дэлгэрэнгүй рүү орж цуцлах боломжтой. Цуцлахаас өмнө буцаан олголтын нөхцөл дэлгэцэд харагдана.",
  },
  {
    question: "Төлбөрийн буцаалт хэзээ орох вэ?",
    answer: "Цуцалсан захиалгын төлбөрийг манай ажилтан нөхцөлтэй нь тулган хянаж, буцаан олголтыг гараар шийдвэрлэнэ. Явцыг тодруулах шаардлагатай бол доорх хүсэлтийн төрлөөс “Төлбөр, буцаалт”-ыг сонгоно уу.",
  },
  {
    question: "Байрны хаалганы тоот, бүтэн хаяг хэзээ харагдах вэ?",
    answer: "Нууцлал, аюулгүй байдлын үүднээс байрны барилга болон хаалганы тоот зөвхөн төлбөртэй захиалга баталгаажсаны дараа тухайн зочинд харагдана.",
  },
  {
    question: "Түрээслүүлэгч болох хүсэлтийг хэр удаан шалгах вэ?",
    answer: "Хүсэлт илгээсний дараа манай ажилтан бүрдүүлсэн мэдээллийг шалгана. Шийдвэр гармагц танд системийн мэдэгдэл болон цахим шуудан очно.",
  },
  {
    question: "Тусламжийн хүсэлтийн хариуг хаанаас харах вэ?",
    answer: "Админ хариу өгмөгц танд мэдэгдэл болон цахим шуудан очно. Хариуг энэ хуудасны “Миний хүсэлтүүд” хэсгээс бүрэн харж болно.",
  },
];

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      const first = Object.values(data as Record<string, unknown>)[0];
      if (typeof first === "string") return first;
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
  }
  return "Хүсэлт илгээхэд алдаа гарлаа. Дахин оролдоно уу.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function SupportPage() {
  const { locale } = useParams() as { locale: string };
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState("booking");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      const response = await api.get<SupportRequest[]>("/support-requests/");
      setRequests(response.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/${locale}/login`);
      return;
    }
    loadRequests();
  }, [authLoading, loadRequests, locale, router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (subject.trim().length < 3 || message.trim().length < 10) {
      setError("Гарчиг болон асуудлын дэлгэрэнгүйг бүрэн бичнэ үү.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post<SupportRequest>("/support-requests/", {
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setRequests((current) => [response.data, ...current]);
      setSubject("");
      setMessage("");
      setSuccess("Таны хүсэлтийг хүлээн авлаа. Манай ажилтан шалгаад хариу өгнө.");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <main className="mx-auto flex min-h-[45vh] max-w-4xl items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-green-700" aria-label="Ачааллаж байна" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <Headphones className="h-7 w-7 text-green-700" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900">Тусламж</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
          Захиалга, төлбөр, зар эсвэл бүртгэлтэй холбоотой асуудлаа бичнэ үү. Манай ажилтан таны бүртгэлтэй цахим шуудан болон энэ хуудсаар хариу өгнө.
        </p>
      </header>

      <section className="border-b border-gray-200 py-7" aria-labelledby="faq-title">
        <h2 id="faq-title" className="text-lg font-semibold text-gray-900">
          Түгээмэл асуулт
        </h2>
        <div className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
          {faqs.map((item) => (
            <details key={item.question} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-gray-900">
                <span>{item.question}</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-gray-500 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="max-w-3xl pb-4 pr-8 text-sm leading-6 text-gray-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-b border-gray-200 py-7" aria-labelledby="new-request-title">
        <h2 id="new-request-title" className="text-lg font-semibold text-gray-900">
          Шинэ хүсэлт илгээх
        </h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-800">
              Асуудлын төрөл
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-2 block h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-gray-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-800">
              Гарчиг
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={160}
                placeholder="Асуудлаа товч бичнэ үү"
                className="mt-2 block h-11 w-full rounded-md border border-gray-300 px-3 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-gray-800">
            Дэлгэрэнгүй
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={3000}
              rows={6}
              placeholder="Юу болсон, ямар тусламж хэрэгтэй байгааг дэлгэрэнгүй бичнэ үү"
              className="mt-2 block w-full resize-y rounded-md border border-gray-300 px-3 py-3 text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
            <span className="mt-1 block text-right text-xs text-gray-500">{message.length}/3000</span>
          </label>

          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          {success && <p className="text-sm text-green-700" role="status">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-green-700 px-5 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "Илгээж байна..." : "Хүсэлт илгээх"}
          </button>
        </form>
      </section>

      <section className="py-7" aria-labelledby="request-history-title">
        <h2 id="request-history-title" className="text-lg font-semibold text-gray-900">
          Миний хүсэлтүүд
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Ачааллаж байна...
          </div>
        ) : requests.length === 0 ? (
          <p className="py-8 text-sm text-gray-600">Одоогоор илгээсэн хүсэлт байхгүй байна.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {requests.map((request) => {
              const answered = Boolean(request.admin_reply);
              return (
                <article key={request.id} className="rounded-md border border-gray-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-green-700">#{request.id} · {request.category_display}</p>
                      <h3 className="mt-1 font-semibold text-gray-900">{request.subject}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
                      {answered ? <CheckCircle2 className="h-4 w-4 text-green-700" /> : <Clock3 className="h-4 w-4 text-amber-600" />}
                      {request.status_display}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{request.message}</p>
                  <p className="mt-3 text-xs text-gray-500">Илгээсэн: {formatDate(request.created_at)}</p>
                  {answered && (
                    <div className="mt-5 border-l-4 border-green-600 bg-green-50 px-4 py-3">
                      <p className="text-sm font-semibold text-green-900">Манай ажилтны хариу</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">{request.admin_reply}</p>
                      {request.responded_at && (
                        <p className="mt-2 text-xs text-gray-500">Хариулсан: {formatDate(request.responded_at)}</p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
