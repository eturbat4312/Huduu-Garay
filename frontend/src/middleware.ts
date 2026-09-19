import { NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;
const defaultLocale = "mn";
const disabledLocales = ["en", "fr"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Хуучин гадаад хэлний холбоосыг ижил Монгол хуудас руу шилжүүлнэ.
  const disabledLocale = disabledLocales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
  if (disabledLocale) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(`/${disabledLocale}`, `/${defaultLocale}`);
    return NextResponse.redirect(url);
  }

  // Системийн зам, файл болон Монгол хэлтэй замыг шууд нэвтрүүлнэ.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes("/.well-known") ||
    PUBLIC_FILE.test(pathname) ||
    pathname === `/${defaultLocale}` ||
    pathname.startsWith(`/${defaultLocale}/`)
  ) {
    return NextResponse.next();
  }

  // Хэл заагаагүй бүх замыг Монгол хувилбар руу шилжүүлнэ.
  const url = req.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname}`;
  return NextResponse.redirect(url);
}
