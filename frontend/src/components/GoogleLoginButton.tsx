"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/axios";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface GoogleCredentialResponse {
  clientId: string;
  credential: string;
  select_by: string;
}

export default function GoogleLoginButton() {
  const router = useRouter();
  const { login } = useAuth();
  const { locale } = useParams() as { locale: string };
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("Google нэвтрэх тохиргоо дутуу байна.");
      return;
    }

    let attempts = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const initializeGoogleButton = () => {
      const googleIdentity = window.google?.accounts?.id;
      if (!googleIdentity || !buttonRef.current) return false;

      googleIdentity.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async (response: GoogleCredentialResponse) => {
          setLoading(true);
          setError(null);
          try {
            const res = await api.post("/auth/google/", {
              id_token: response.credential,
            });

            localStorage.setItem("access_token", res.data.access);
            localStorage.setItem("refresh_token", res.data.refresh);

            await login();
            router.replace(`/${locale}`);
          } catch (err: unknown) {
            console.error("Google login error:", err);
            const responseError =
              typeof err === "object" &&
              err !== null &&
              "response" in err &&
              typeof (err as { response?: { data?: { error?: unknown } } })
                .response?.data?.error === "string"
                ? (err as { response: { data: { error: string } } }).response
                    .data.error
                : null;
            setError(responseError ?? "Google-ээр нэвтрэх үед алдаа гарлаа.");
          } finally {
            setLoading(false);
          }
        },
      });

      buttonRef.current.replaceChildren();
      googleIdentity.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
      return true;
    };

    if (!initializeGoogleButton()) {
      timer = setInterval(() => {
        attempts += 1;
        if (initializeGoogleButton() && timer) {
          clearInterval(timer);
        } else if (attempts >= 50 && timer) {
          clearInterval(timer);
          setError("Google нэвтрэх товчийг ачаалж чадсангүй.");
        }
      }, 100);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [login, router, locale]);

  return (
    <div className="mt-4">
      <div ref={buttonRef} className="flex min-h-10 justify-center" />
      {loading && (
        <p className="mt-2 text-center text-sm text-gray-500">Нэвтэрч байна...</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
