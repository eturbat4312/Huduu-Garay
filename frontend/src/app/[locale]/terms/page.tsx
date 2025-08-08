// filename: src/app/[locale]/terms/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { t } from "@/lib/i18n";

export default function TermsPage() {
  const { locale } = useParams();
  const router = useRouter();

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">{t(locale, "terms_title")}</h1>

      <section className="space-y-4 text-gray-700 text-sm leading-6">
        <p>{t(locale, "terms_intro")}</p>

        <h2 className="font-semibold text-lg mt-6">
          {t(locale, "terms_guests")}
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>{t(locale, "guest_no_cancel")}</li>
          <li>{t(locale, "guest_no_show_no_refund")}</li>
          <li>{t(locale, "guest_payment_final")}</li>
        </ul>

        <h2 className="font-semibold text-lg mt-6">
          {t(locale, "terms_hosts")}
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>{t(locale, "host_first_cancel_warning")}</li>
          <li>{t(locale, "host_second_cancel_hide_10d")}</li>
          <li>{t(locale, "host_third_cancel_block")}</li>
          <li>{t(locale, "host_responsible_listing")}</li>
        </ul>

        <h2 className="font-semibold text-lg mt-6">
          {t(locale, "terms_platform")}
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>{t(locale, "platform_fee_nonrefundable")}</li>
          <li>{t(locale, "platform_moderation_rights")}</li>
          <li>{t(locale, "platform_terms_change")}</li>
        </ul>

        <p className="text-xs text-gray-500 mt-8">
          {t(locale, "terms_last_updated")} 2025-08-02
        </p>
      </section>
      {/* Back Button */}
      <div className="mt-10">
        <button
          onClick={() => router.back()}
          className="text-sm text-green-600 hover:underline hover:text-green-800"
        >
          ← {t(locale, "go_back")}
        </button>
      </div>
    </main>
  );
}
