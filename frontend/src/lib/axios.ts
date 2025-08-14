import axios, { AxiosError } from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api";
const api = axios.create({ baseURL });

// Access token-ийг хүсэлт бүр дээр автоматаар нэмэх
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// (Сонголт) 401 дээр refresh → retry
let isRefreshing = false;
let waiters: Array<(t: string) => void> = [];
api.interceptors.response.use(
  r => r,
  async (err: AxiosError) => {
    const original: any = err.config;
    if (err.response?.status === 401 && !original?._retry) {
      original._retry = true;
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refresh = localStorage.getItem("refresh_token");
          if (!refresh) throw new Error("No refresh token");
          const { data } = await axios.post(`${baseURL}/token/refresh/`, { refresh });
          localStorage.setItem("access_token", data.access);
          waiters.forEach(fn => fn(data.access));
          waiters = [];
          return api(original);
        } finally {
          isRefreshing = false;
        }
      } else {
        return new Promise((resolve, reject) => {
          waiters.push((newToken) => {
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${newToken}`;
            api(original).then(resolve).catch(reject);
          });
        });
      }
    }
    throw err;
  }
);

export default api;
