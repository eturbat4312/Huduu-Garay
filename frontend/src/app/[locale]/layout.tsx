// filename: src/app/[locale]/layout.tsx
import type { Metadata } from "next";
import "../globals.css";
import { notFound } from "next/navigation";
import { ReactNode } from "react";
import Script from "next/script";

import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import Navbar from "@/components/Navbar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Танайд Хоноё",
  description: "Монголын гэр, амралт, байр түрээсийн платформ",
};

const locales = ["mn", "en", "fr"];

export async function generateStaticParams() {
  return [{ locale: "mn" }, { locale: "en" }, { locale: "fr" }];
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-pattern`}
      >
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
