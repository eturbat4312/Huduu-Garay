// filename: src/app/[locale]/signup/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import { t } from "@/lib/i18n";
import api from "@/lib/axios";
import LoadingButton from "@/components/LoadingButton"; // ⭐ CHANGE: импорт нэмсэн

type FieldErrors = Record<string, string[]>;

export default function SignupPage() {
  const router = useRouter();
  const raw = useParams().locale;
  const locale = (typeof raw === "string" ? raw : "mn") as string;
  const L = (k: string, fb: string) => t(locale, k) || fb;

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false); // ⭐ CHANGE: LoadingButton-д ашиглана

  const [formErr, setFormErr] = useState<string>("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const emailLocal = useMemo(
    () => email.split("@")[0]?.toLowerCase() || "",
    [email]
  );

  const pwChecks = useMemo(() => {
    const lower = /[a-z]/.test(pw1);
    const upper = /[A-Z]/.test(pw1);
    const digit = /\d/.test(pw1);
    const symbol = /[^A-Za-z0-9]/.test(pw1);

    const longEnough = pw1.length >= 8;
    const notOnlyDigits = !/^\d+$/.test(pw1);
    const notSimilar =
      pw1 &&
      !pw1.toLowerCase().includes(username.toLowerCase()) &&
      !pw1.toLowerCase().includes(emailLocal);

    const classes = [lower, upper, digit, symbol].filter(Boolean).length;
    const strength = !pw1
      ? 0
      : !longEnough || !notOnlyDigits
      ? 1
      : classes >= 3
      ? 3
      : 2;

    return { longEnough, notOnlyDigits, notSimilar, classes, strength };
  }, [pw1, username, emailLocal]);

  const strengthLabel = [
    "",
    L("weak", "Сул"),
    L("okay", "Дунд"),
    L("strong", "Хүчтэй"),
  ][pwChecks.strength];

  const firstError = (key: string) => errors[key]?.[0];

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // ⭐ CHANGE: double-submit хамгаалалт
    setFormErr("");
    setErrors({});
    setLoading(true);

    const fieldErrs: FieldErrors = {};
    if (!username.trim())
      fieldErrs.username = [
        L("username_required", "Хэрэглэгчийн нэр шаардлагатай"),
      ];
    if (!email.trim())
      fieldErrs.email = [L("email_required", "И-мэйл шаардлагатай")];
    if (pw1 !== pw2)
      fieldErrs.password2 = [
        L("passwords_mismatch", "Нууц үг хоёр таарахгүй байна"),
      ];
    if (!pwChecks.longEnough)
      fieldErrs.password1 = [
        L("password_too_short", "Дор хаяж 8 тэмдэгт байна"),
      ];
    if (!pwChecks.notOnlyDigits)
      fieldErrs.password1 = [
        ...(fieldErrs.password1 || []),
        L("password_not_numeric", "Зөвхөн тоо байж болохгүй"),
      ];

    if (Object.keys(fieldErrs).length) {
      setErrors(fieldErrs);
      setLoading(false);
      return;
    }

    try {
      await api.post("/auth/registration/", {
        username,
        email,
        password1: pw1,
        password2: pw2,
      });
      router.push(`/${locale}/login?registered=1`);
    } catch (err: unknown) {
      if (typeof err === "object" && err && "response" in err) {
        const e = err as {
          response?: { data?: Record<string, string[] | undefined> };
        };
        const data = e.response?.data || {};
        const mapped: FieldErrors = {};
        for (const k of [
          "username",
          "email",
          "password1",
          "password2",
          "non_field_errors",
        ] as const) {
          const arr = data[k];
          if (Array.isArray(arr) && arr.length) mapped[k] = arr;
        }
        setErrors(mapped);
        setFormErr(
          mapped.non_field_errors?.[0] ||
            L(
              "signup_failed",
              "Бүртгэл амжилтгүй. Оруулсан мэдээллээ шалгаарай."
            )
        );
      } else {
        setFormErr(
          L("signup_failed", "Бүртгэл амжилтгүй. Оруулсан мэдээллээ шалгаарай.")
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSignup}
        className="bg-white shadow-md rounded-2xl px-8 pt-8 pb-6 w-full max-w-md"
      >
        <h2 className="text-3xl font-bold text-center mb-6">
          {L("signup_title", "Бүртгүүлэх")}
        </h2>

        {formErr && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
            {formErr}
          </p>
        )}

        {/* Username */}
        <label className="block text-gray-700 text-sm font-medium mb-1">
          {L("username_label", "Хэрэглэгчийн нэр")}
        </label>
        <input
          autoComplete="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={`w-full border rounded-lg px-3 py-2 mb-2 ${
            firstError("username") ? "border-red-500" : "border-gray-300"
          }`}
          required
        />
        {firstError("username") && (
          <p className="text-xs text-red-600 mb-3">{firstError("username")}</p>
        )}

        {/* Email */}
        <label className="block text-gray-700 text-sm font-medium mb-1">
          {L("email_label", "И-мэйл хаяг")}
        </label>
        <input
          autoComplete="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`w-full border rounded-lg px-3 py-2 mb-2 ${
            firstError("email") ? "border-red-500" : "border-gray-300"
          }`}
          required
        />
        {firstError("email") && (
          <p className="text-xs text-red-600 mb-3">{firstError("email")}</p>
        )}

        {/* Password */}
        <label className="block text-gray-700 text-sm font-medium mb-1">
          {L("password_label", "Нууц үг")}
        </label>
        <div className="relative">
          <input
            autoComplete="new-password"
            name="password1"
            type={showPw ? "text" : "password"}
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 pr-12 mb-2 focus:outline-none ${
              firstError("password1") ? "border-red-500" : "border-gray-300"
            }`}
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
        {firstError("password1") && (
          <p className="text-xs text-red-600 mb-2">{firstError("password1")}</p>
        )}

        {/* Password confirm */}
        <label className="block text-gray-700 text-sm font-medium mb-1">
          {L("confirm_password_label", "Нууц үг (давтах)")}
        </label>
        <input
          autoComplete="new-password"
          name="password2"
          type={showPw ? "text" : "password"}
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className={`w-full border rounded-lg px-3 py-2 mb-2 focus:outline-none ${
            firstError("password2") ? "border-red-500" : "border-gray-300"
          }`}
          required
        />
        {firstError("password2") && (
          <p className="text-xs text-red-600 mb-2">{firstError("password2")}</p>
        )}

        {/* Strength meter + Django rules */}
        <div className="mt-1 mb-3">
          <div className="h-1.5 rounded bg-gray-200">
            <div
              className={`h-1.5 rounded ${
                pwChecks.strength === 1
                  ? "bg-red-500 w-1/4"
                  : pwChecks.strength === 2
                  ? "bg-yellow-500 w-2/4"
                  : pwChecks.strength === 3
                  ? "bg-green-600 w-4/4"
                  : "w-0"
              }`}
            />
          </div>
          <div className="text-xs text-gray-600 mt-1">{strengthLabel}</div>

          <div className="text-xs text-gray-600 mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  pwChecks.longEnough ? "bg-green-600" : "bg-gray-300"
                }`}
              />
              <span>{L("pw_rule_len", "Дор хаяж 8 тэмдэгт байх")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  pwChecks.notOnlyDigits ? "bg-green-600" : "bg-gray-300"
                }`}
              />
              <span>{L("pw_rule_not_numeric", "Зөвхөн тоо байхгүй")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  pwChecks.notSimilar ? "bg-green-600" : "bg-gray-300"
                }`}
              />
              <span>
                {L(
                  "pw_rule_not_similar",
                  "Хэрэглэгчийн нэр/имэйлтэй төстэй биш"
                )}
              </span>
            </div>
            <div className="text-[11px] text-gray-500">
              {L(
                "pw_rule_common",
                "Хэт нийтлэг нууц үг ашиглахгүй (123456, password гэх мэт)"
              )}
            </div>
          </div>
        </div>

        <LoadingButton
          type="submit"
          text={L("signup_button", "Бүртгүүлэх")}
          loadingText={L("signing_up", "Бүртгэж байна…")}
          loading={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg mt-2"
        />

        <div className="my-6 border-t border-gray-200" />

        <p className="text-center text-gray-500 mb-2">
          {L("or_with_google", "эсвэл Google-ээр")}
        </p>
        <div className="flex justify-center">
          <GoogleLoginButton />
        </div>
      </form>
    </div>
  );
}
