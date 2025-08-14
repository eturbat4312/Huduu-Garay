"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import { t } from "@/lib/i18n";

export default function SignupPage() {
  const router = useRouter();
  const { locale } = useParams();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post("http://54.64.78.102/api/signup/", {
        username,
        email,
        password,
      });
      setError("");
      router.push(`/${locale}/login`);
    } catch (err) {
      setError(t(locale as string, "signup_failed"));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={handleSignup}
        className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md"
      >
        <h2 className="text-2xl font-bold text-center mb-6">
          {t(locale as string, "signup_title")}
        </h2>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <label className="block text-gray-700 text-sm font-bold mb-2">
          {t(locale as string, "username_label")}
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none"
          required
        />

        <label className="block text-gray-700 text-sm font-bold mb-2">
          {t(locale as string, "email_label")}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none"
          required
        />

        <label className="block text-gray-700 text-sm font-bold mb-2">
          {t(locale as string, "password_label")}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-6 focus:outline-none"
          required
        />

        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          {t(locale as string, "signup_button")}
        </button>

        <div className="my-6 border-t border-gray-300"></div>

        <p className="text-center text-gray-500 mb-2">
          {t(locale as string, "or_with_google")}
        </p>
        <GoogleLoginButton />
      </form>
    </div>
  );
}
