// filename: middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;
const locales = ["mn", "en", "fr"];
const defaultLocale = "mn";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip next internal files, API routes, or already-localized paths
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    PUBLIC_FILE.test(pathname) ||
    locales.some((locale) => pathname.startsWith(`/${locale}`))
  ) {
    return NextResponse.next();
  }

  // Redirect to locale-prefixed path
  const locale = defaultLocale;
  return NextResponse.redirect(new URL(`/${locale}${pathname}`, req.url));
}
