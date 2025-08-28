"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import api from "@/lib/axios";
import { useAuth, useRefreshUser } from "@/context/AuthContext";
import { t } from "@/lib/i18n";
import LoadingButton from "@/components/LoadingButton"; // ⭐ CHANGE: импорт хийсэн

const BANK_OPTIONS = [
  "Хаан Банк",
  "Голомт Банк",
  "ХХБанк",
  "Төрийн Банк",
  "Капитрон",
  "ХАС Банк",
  "Чингис Хаан Банк",
];

export default function BecomeHostPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { locale } = useParams();
  const refreshUser = useRefreshUser();

  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    bank_name: "",
    bank_account: "",
  });

  const [idCardImage, setIdCardImage] = useState<File | null>(null);
  const [selfieImage, setSelfieImage] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false); // ⭐ CHANGE: state нэмсэн

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // ⭐ CHANGE: double-submit хамгаалалт
    setSubmitting(true);

    if (!idCardImage || !selfieImage) {
      alert(t(locale, "become_host_alert_missing_images"));
      setSubmitting(false);
      return;
    }

    const data = new FormData();
    data.append("full_name", form.full_name);
    data.append("phone_number", form.phone_number);
    data.append("bank_name", form.bank_name);
    data.append("account_number", form.bank_account);
    data.append("id_card_image", idCardImage);
    data.append("selfie_with_id", selfieImage);

    try {
      await api.post("/host/apply/", data);
      await refreshUser();
      router.refresh();
      alert(t(locale, "become_host_success"));
      router.push(`/${locale}`);
    } catch (err) {
      const error = err as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      if (
        error.response?.data?.detail ===
        "Та аль хэдийн түрээслүүлэгч болох хүсэлт илгээсэн байна."
      ) {
        await refreshUser();
        router.refresh();
        router.push(`/${locale}`);
      } else {
        alert(t(locale, "become_host.alert_error"));
      }
    } finally {
      setSubmitting(false); // ⭐ CHANGE: үргэлж reset
    }
  };

  if (user?.is_host) {
    return (
      <div className="max-w-xl mx-auto mt-10 text-center text-green-600 font-medium">
        {t(locale, "become_host_already_sent")}
      </div>
    );
  }

  if (user?.host_application_status === "pending") {
    return (
      <div className="max-w-xl mx-auto mt-10 text-center text-yellow-600 font-medium">
        {t(locale, "become_host_pending")}
      </div>
    );
  }

  if (user?.host_application_status === "rejected") {
    return (
      <div className="max-w-xl mx-auto mt-10 text-center text-red-600 font-medium">
        {t(locale, "become_host_rejected")}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow rounded-lg mt-6">
      <h1 className="text-3xl font-bold mb-6 text-center">
        {t(locale, "become_host.title")}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="full_name"
          onChange={handleChange}
          placeholder={t(locale, "become_host.full_name")}
          className="w-full border p-2 rounded"
          required
        />
        <input
          name="phone_number"
          onChange={handleChange}
          placeholder={t(locale, "become_host.phone")}
          className="w-full border p-2 rounded"
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            name="bank_name"
            value={form.bank_name}
            onChange={handleChange}
            required
            className="w-full border p-2 rounded"
          >
            <option value="">{t(locale, "become_host.select_bank")}</option>
            {BANK_OPTIONS.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </select>
          <input
            name="bank_account"
            onChange={handleChange}
            placeholder={t(locale, "become_host.account_number")}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">
            {t(locale, "become_host.id_card_label")}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setIdCardImage(e.target.files?.[0] || null)}
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">
            {t(locale, "become_host.selfie_label")}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSelfieImage(e.target.files?.[0] || null)}
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            {t(locale, "become_host.selfie_note")}
          </p>
          <div className="mt-2">
            <Image
              src="/sample_selfie.png"
              alt="selfie"
              width={300}
              height={200}
              className="rounded border"
            />
          </div>
        </div>

        <LoadingButton
          type="submit"
          text={t(locale, "become_host.submit")}
          loadingText={t(locale, "become_host.submitting")}
          loading={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded mt-4"
        />
      </form>
    </div>
  );
}
