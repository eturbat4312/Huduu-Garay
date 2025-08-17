// filename: src/lib/axios.ts
import axios, { AxiosError, AxiosRequestConfig, AxiosRequestHeaders } from "axios";

// --- Base URL (normalize) ---
const rawBase = process.env.NEXT_PUBLIC_API_URL || "/api";
const baseURL = rawBase.replace(/\/+$/, "");

const api = axios.create({ baseURL });

// --- Access токен автоматаар хавсаргах ---
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      // headers-ийг аюулгүйгээр бэлдэж онооно
      const hdrs: AxiosRequestHeaders =
        (config.headers as AxiosRequestHeaders) ?? ({} as AxiosRequestHeaders);
      hdrs["Authorization"] = `Bearer ${token}`;
      config.headers = hdrs; // ⬅️ type-safe
    }
  }
  return config;
});

// --- 401 дээр refresh queue ---
let isRefreshing = false;
let waiters: Array<(t: string) => void> = [];

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as (AxiosRequestConfig & { _retry?: boolean });
    const status = err.response?.status;
    const url = (original?.url || "").toString();
    const isRefreshCall = url.includes("/token/refresh/");

    if (status === 401 && !original?._retry && !isRefreshCall) {
      original._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refresh =
            typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
          if (!refresh) throw new Error("No refresh token");

          // refresh-ийг interceptor-гүй axios-оор дуудна
          const { data } = await axios.post(
            `${baseURL}/token/refresh/`,
            { refresh },
            { headers: { "Content-Type": "application/json" } }
          );

          const newAccess: string = (data as any).access;

          if (typeof window !== "undefined") {
            localStorage.setItem("access_token", newAccess);
          }
          // дараагийн хүсэлтүүдэд шууд хэрэгжинэ
          (api.defaults.headers.common as any).Authorization = `Bearer ${newAccess}`;

          // дарааллаар хүлээгчдийг сэргээе
          waiters.forEach((fn) => fn(newAccess));
          waiters = [];

          // анхны хүсэлтийг шинэ токеноор дахин явуулна
          const hdrs: AxiosRequestHeaders =
            (original.headers as AxiosRequestHeaders) ?? ({} as AxiosRequestHeaders);
          hdrs["Authorization"] = `Bearer ${newAccess}`;
          original.headers = hdrs;

          return api(original);
        } catch (e) {
          // refresh бүтэлгүй
          waiters = [];
          if (typeof window !== "undefined") {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/login";
          }
          throw e;
        } finally {
          isRefreshing = false;
        }
      } else {
        // refresh дуусахыг хүлээе
        return new Promise((resolve, reject) => {
          waiters.push((newToken) => {
            const hdrs: AxiosRequestHeaders =
              (original.headers as AxiosRequestHeaders) ?? ({} as AxiosRequestHeaders);
            hdrs["Authorization"] = `Bearer ${newToken}`;
            original.headers = hdrs;
            api(original).then(resolve).catch(reject);
          });
        });
      }
    }

    throw err;
  }
);

export default api;
