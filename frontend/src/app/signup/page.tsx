"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:8010/api/signup/", {
        username,
        email,
        password,
      });
      setError("");
      router.push("/login"); // signup хийсний дараа login руу шилжинэ
    } catch (err) {
      setError(
        "Бүртгэл амжилтгүй. Хэрэглэгчийн нэр давхардсан эсвэл буруу мэдээлэл байна."
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={handleSignup}
        className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md"
      >
        <h2 className="text-2xl font-bold text-center mb-6">Бүртгүүлэх</h2>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <label className="block text-gray-700 text-sm font-bold mb-2">
          Хэрэглэгчийн нэр
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none"
          required
        />

        <label className="block text-gray-700 text-sm font-bold mb-2">
          Имэйл
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none"
          required
        />

        <label className="block text-gray-700 text-sm font-bold mb-2">
          Нууц үг
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
          Бүртгүүлэх
        </button>
      </form>
    </div>
  );
}
