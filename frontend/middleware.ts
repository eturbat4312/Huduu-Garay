// filename: middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;
const locales = ["mn", "en", "fr"];
const defaultLocale = "mn";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // static/_next/api/.well-known эсвэл аль хэдийн locale-той path бол шууд нэвтрүүлнэ
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes("/.well-known") ||
    PUBLIC_FILE.test(pathname) ||
    locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  ) {
    return NextResponse.next();
  }

  // Locale-гүй бүх замыг /{locale}{pathname} руу
  return NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, req.url));
}
