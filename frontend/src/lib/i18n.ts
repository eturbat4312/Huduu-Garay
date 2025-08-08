// filename: src/lib/i18n.ts
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import mn from "@/locales/mn.json";

const translations: Record<string, Record<string, string>> = {
  en,
  fr,
  mn,
};

export function t(locale: string | string[] | undefined, key: string): string {
  if (!locale || typeof locale !== "string") return key;
  return translations[locale]?.[key] ?? key;
}
