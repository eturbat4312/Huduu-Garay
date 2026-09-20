// filename: src/app/[locale]/layout.tsx
import type { Metadata } from "next";
import "../globals.css";
import { notFound } from "next/navigation";
import { ReactNode } from "react";
import Script from "next/script";

import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Танайд Хоноё",
  description: "Монголын гэр, амралт, байр түрээсийн платформ",
};

const locales = ["mn"];

export async function generateStaticParams() {
  return [{ locale: "mn" }];
}

// ✅ params-ийг await хийдэг болголоо
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  // ✅ Next 15+ дээр Promise гэж тайлбарлавал TS алдаа арилна
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale)) notFound();

  return (
    <html lang={locale}>
      <head>
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased bg-pattern">
        <AuthProvider>
          <NotificationProvider>
            <Navbar />
            {children}
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
