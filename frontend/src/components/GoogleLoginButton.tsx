// filename: src/components/GoogleLoginButton.tsx
"use client";

import { useEffect } from "react";
import api from "@/lib/axios"; // ⬅️ энд api instance-ийг зөв нэрлэ
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

interface GoogleCredentialResponse {
  clientId: string;
  credential: string;
  select_by: string;
}

export default function GoogleLoginButton() {
  const router = useRouter();
  const { login } = useAuth();
  const { locale } = useParams() as { locale: string };

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.google?.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      callback: async (response: GoogleCredentialResponse) => {
        try {
          const url = "/auth/google/";
          console.log("🔎 Requesting:", url);
          const res = await axios.post(url, {
            access_token: response.credential,
          });
          console.log("✅ Response:", res.data);
          console.log("🔎 api baseURL:", api.defaults.baseURL);

          localStorage.setItem("access_token", res.data.access);
          localStorage.setItem("refresh_token", res.data.refresh);

          await login();
          router.push(`/${locale}`);
        } catch (err) {
          console.error("Google login error:", err);
        }
      },
    });

    window.google?.accounts.id.renderButton(
      document.getElementById("google-login-btn"),
      { theme: "outline", size: "large" }
    );
  }, [login, router, locale]);

  return <div id="google-login-btn" className="flex justify-center mt-4" />;
}
