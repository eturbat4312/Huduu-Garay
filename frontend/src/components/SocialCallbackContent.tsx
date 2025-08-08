// components/SocialCallbackContent.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import axios from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/i18n";

export default function SocialCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { locale } = useParams() as { locale: string };
  const { login } = useAuth();

  useEffect(() => {
    const code = params.get("code");

    if (!code) return;

    const fetchToken = async () => {
      try {
        const res = await axios.post("/dj-rest-auth/google/", {
          code,
          redirect_uri: `${window.location.origin}/${locale}/social/callback`,
        });

        const { access_token, refresh_token } = res.data;
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);

        await login();
        router.push(`/${locale}`);
      } catch (error) {
        console.error("Google login failed:", error);
      }
    };

    fetchToken();
  }, [params, login, router, locale]);

  return <p className="p-6">{t(locale, "social.login_in_progress")}</p>;
}
