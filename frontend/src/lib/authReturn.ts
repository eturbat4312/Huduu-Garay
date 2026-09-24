export function safeAuthReturnPath(
  value: string | null | undefined,
  locale: string
) {
  const fallback = `/${locale}`;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://huduu-garay.local");
    const localeRoot = `/${locale}`;
    if (
      url.origin !== "https://huduu-garay.local" ||
      (url.pathname !== localeRoot && !url.pathname.startsWith(`${localeRoot}/`))
    ) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginHref(locale: string, returnTo: string) {
  const safeReturnTo = safeAuthReturnPath(returnTo, locale);
  return `/${locale}/login?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
