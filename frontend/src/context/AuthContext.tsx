"use client";

import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/axios";

type User = {
  id: number;
  username: string;
  email: string;
  is_host: boolean;
  is_guest: boolean;
  avatar?: string;
  host_application_status?: "pending" | "approved" | "rejected" | "none";
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  setUser: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get("/me/");
      setUser(res.data);
    } catch {
      logout(); // refresh token expired or unauthorized
    }
  };

  const login = async () => {
    await fetchUser();
  };

  const logout = async () => {
    console.log("Logging out context...");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setLoading(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    fetchUser().finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

// ✅ ЭНЭГҮЙ БОЛ refreshUser ажиллахгүй
export const useRefreshUser = () => {
  const { setUser } = useContext(AuthContext);

  return async () => {
    try {
      const res = await api.get("/me/");
      setUser(res.data);
    } catch (err: unknown) {
      const error = err as { response?: { status: number } };

      if (error.response?.status === 401) {
        try {
          const refresh = localStorage.getItem("refresh_token");
          const res = await fetch("/api/token/refresh/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refresh }),
          });

          if (!res.ok) throw new Error("Refresh token expired");

          const data = await res.json();
          const newAccessToken = data.access;
          localStorage.setItem("access_token", newAccessToken);

          const retry = await api.get("/me/", {
            headers: {
              Authorization: `Bearer ${newAccessToken}`,
            },
          });

          setUser(retry.data);
        } catch (_refreshErr) {
          console.error("🔴 Refresh token expired or invalid");
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          setUser(null);
        }
      } else {
        console.error("Failed to refresh user", err);
        setUser(null);
      }
    }
  };
};

export { AuthContext };
