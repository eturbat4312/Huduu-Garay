import axios from "axios";
import api from "@/lib/axios";
import { safeAuthReturnPath } from "@/lib/authReturn";

const VERIFIER_KEY = "facebook_login_verifier";
const PENDING_KEY = "facebook_pending_connection";
const RETURN_PATH_KEY = "facebook_login_return_path";
export type FacebookPending = {
  status: "account_required";
  pending_token: string;
  email: string;
  name: string;
  can_register: boolean;
  expires_at: string;
};
export type FacebookResult = FacebookPending
  | { status: "authenticated"; access: string; refresh: string }
  | { status: "cancelled" | "provider_error" };

export function getFacebookPending(): FacebookPending | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    if (value?.pending_token && Date.parse(value.expires_at) > Date.now()) return value;
    sessionStorage.removeItem(PENDING_KEY);
  } catch { /* An expired or unavailable session must be restarted. */ }
  return null;
}

export function clearFacebookPending() {
  sessionStorage.removeItem(PENDING_KEY);
}

export function facebookReturnPath(
  locale: string,
  requestedPath?: string | null,
  fallbackPath = `/${locale}`
) {
  if (getFacebookPending()) return `/${locale}/facebook/connect`;

  const savedPath = sessionStorage.getItem(RETURN_PATH_KEY);
  sessionStorage.removeItem(RETURN_PATH_KEY);
  return safeAuthReturnPath(requestedPath || savedPath || fallbackPath, locale);
}

export async function startFacebook(
  locale: string,
  intent: "login" | "connect",
  returnTo?: string | null
) {
  exchange = null;
  if (returnTo) {
    sessionStorage.setItem(
      RETURN_PATH_KEY,
      safeAuthReturnPath(returnTo, locale)
    );
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
  const { data } = await api.post<{ authorization_url: string }>("/auth/facebook/start/", {
    client: "web", locale, intent, challenge,
  });
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  clearFacebookPending();
  window.location.assign(data.authorization_url);
}

let exchange: { code: string; task: Promise<FacebookResult> } | null = null;
export function forgetFacebookExchange() { exchange = null; }

export function completeFacebook(code: string): Promise<FacebookResult> {
  // React StrictMode/remounts must share the same one-use exchange.
  if (exchange?.code === code) return exchange.task;
  const task = (async () => {
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    if (!verifier) throw new Error("Нэвтрэх хүсэлт олдсонгүй. Facebook товчоор дахин эхлүүлнэ үү.");
    const { data } = await api.post<FacebookResult>("/auth/facebook/exchange/", { code, verifier });
    sessionStorage.removeItem(VERIFIER_KEY);
    if (data.status === "account_required") sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
    if (data.status === "authenticated") storeFacebookTokens(data);
    return data;
  })();
  exchange = { code, task };
  return task;
}

export function storeFacebookTokens(data: { access: string; refresh: string }) {
  localStorage.setItem("access_token", data.access);
  localStorage.setItem("refresh_token", data.refresh);
}

export function facebookError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (typeof error.response?.data?.error === "string") return error.response.data.error;
    if (error.response?.status === 429) return "Хэт олон оролдлого хийсэн байна. Түр хүлээгээд дахин оролдоно уу.";
    return "Facebook нэвтрэхэд алдаа гарлаа. Холболтоо шалгаад дахин оролдоно уу.";
  }
  return error instanceof Error ? error.message : "Facebook нэвтрэхэд алдаа гарлаа.";
}
