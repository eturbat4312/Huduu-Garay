import axios from "axios";

const isBrowser = typeof window !== "undefined";

// const clientBase =
//   process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010/api";

const clientBase = process.env.NEXT_PUBLIC_API_URL || "http://54.64.78.102/api";

const serverBase =
  process.env.INTERNAL_API_URL || clientBase; // docker дотроос backend руу

const api = axios.create({
  baseURL: isBrowser ? clientBase : serverBase,
});

api.interceptors.request.use(
  (config) => {
    if (isBrowser) {
      const access = localStorage.getItem("access_token");
      if (access) config.headers.Authorization = `Bearer ${access}`;
    }
    return config;
  },
  (e) => Promise.reject(e)
);

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (!isBrowser) return Promise.reject(error); // SSR дээр refresh хийлгэхгүй

    const originalRequest: any = error.config;
    const refresh = localStorage.getItem("refresh_token");

    if (error.response?.status === 401 && !originalRequest._retry && refresh) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(
          `${clientBase}/token/refresh/`,
          { refresh }
        );
        const newAccessToken = res.data.access;
        localStorage.setItem("access_token", newAccessToken);
        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (err) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        const locale = window.location.pathname.split("/")[1] || "mn";
        window.location.href = `/${locale}/`;
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
