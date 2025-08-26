// filename: src/lib/axios.ts
import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
} from "axios";

// --- Base URL (normalize) ---
const rawBase = process.env.NEXT_PUBLIC_API_URL || "/api";
const baseURL = rawBase.replace(/\/+$/, "");

const api = axios.create({ baseURL });

// --- Access токен автоматаар хавсаргах ---
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      const hdrs: AxiosRequestHeaders =
        (config.headers as AxiosRequestHeaders) ?? {};
      hdrs["Authorization"] = `Bearer ${token}`;
      config.headers = hdrs;
    }
  }
  return config;
});

// --- Refresh response type ---
interface RefreshResponse {
  access: string;
}

let isRefreshing = false;
let waiters: Array<(t: string) => void> = [];

api.interceptors.response.use(
  (r: AxiosResponse) => r,
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
            typeof window !== "undefined"
              ? localStorage.getItem("refresh_token")
              : null;
          if (!refresh) throw new Error("No refresh token");

          // refresh хийх
          const { data } = await axios.post<RefreshResponse>(
            `${baseURL}/token/refresh/`,
            { refresh },
            { headers: { "Content-Type": "application/json" } }
          );

          const newAccess = data.access;

          if (typeof window !== "undefined") {
            localStorage.setItem("access_token", newAccess);
          }
          api.defaults.headers.common["Authorization"] = `Bearer ${newAccess}`;

          waiters.forEach((fn) => fn(newAccess));
          waiters = [];

          const hdrs: AxiosRequestHeaders =
            (original.headers as AxiosRequestHeaders) ?? {};
          hdrs["Authorization"] = `Bearer ${newAccess}`;
          original.headers = hdrs;

          return api(original);
        } catch (e) {
          waiters = [];
          if (typeof window !== "undefined") {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
          }
          throw e;
        } finally {
          isRefreshing = false;
        }
      } else {
        return new Promise((resolve, reject) => {
          waiters.push((newToken) => {
            const hdrs: AxiosRequestHeaders =
              (original.headers as AxiosRequestHeaders) ?? {};
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
