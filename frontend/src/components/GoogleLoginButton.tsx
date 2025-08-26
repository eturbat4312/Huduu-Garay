// filename: src/components/GoogleLoginButton.tsx
"use client";

import { useEffect } from "react";
import axios from "@/lib/axios";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// Google response type
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
          const res = await axios.post("auth/google/", {
            access_token: response.credential,
          });

          localStorage.setItem("access_token", res.data.access);
          localStorage.setItem("refresh_token", res.data.refresh);

          await login();
          router.push(`/${locale}`); // ✅ locale-той redirect
        } catch (err) {
          console.error("Google login error:", err);
          console.log("Google response:", response);
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
