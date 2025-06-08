"use client";

import { useEffect, useState, ChangeEvent } from "react";
import api from "@/lib/axios";

type UserProfile = {
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  is_host?: boolean;
  // Нэмэлт талбарууд нэмэж болно, жишээ:
  full_name?: string;
  bio?: string;
  address?: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Edit mode state
  const [editMode, setEditMode] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Нэмэлт талбарууд
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/me/");
        setUser(res.data);
        setUsername(res.data.username);
        setEmail(res.data.email);
        setPhone(res.data.phone || "");
        setAvatarPreview(res.data.avatar || null);
        setFullName(res.data.full_name || "");
        setBio(res.data.bio || "");
        setAddress(res.data.address || "");
      } catch {
        setErrorMsg("Профайл авахад алдаа гарлаа.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    const formData = new FormData();
    formData.append("username", username);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("full_name", fullName);
    formData.append("bio", bio);
    formData.append("address", address);
    if (avatarFile) {
      formData.append("avatar", avatarFile);
    }

    try {
      const res = await api.patch("/me/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(res.data);
      setSuccessMsg("Мэдээлэл амжилттай хадгалагдлаа.");
      setEditMode(false);
    } catch (error: any) {
      setErrorMsg(
        error?.response?.data?.detail || "Мэдээлэл хадгалахад алдаа гарлаа."
      );
    }
  };

  const handleBecomeHost = async () => {
    try {
      await api.patch("/me/", { is_host: true });
      setUser((prev) => (prev ? { ...prev, is_host: true } : null));
      alert("Таны хүсэлт хүлээн авлаа. Та одоо host боллоо!");
    } catch (error) {
      alert("Host болох үед алдаа гарлаа.");
    }
  };

  if (loading) return <p className="p-6">Ачааллаж байна...</p>;

  if (!user) return <p className="p-6 text-red-600">Профайл олдсонгүй.</p>;

  return (
    <main className="max-w-3xl mx-auto p-6 bg-white rounded shadow space-y-6">
      <h1 className="text-3xl font-bold text-green-700">Миний профайл</h1>

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}
      {successMsg && <p className="text-green-600">{successMsg}</p>}

      <div className="flex items-center gap-6">
        <div className="w-24 h-24 rounded-full overflow-hidden border border-gray-300 bg-gray-100">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt={username}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-gray-600 text-4xl font-bold">
              {username[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {editMode && (
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="border rounded p-1"
          />
        )}
      </div>

      {/* User info: View or Edit */}
      <div>
        <label className="block text-gray-700 font-semibold">Нэр:</label>
        {editMode ? (
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        ) : (
          <p className="mt-1">{username}</p>
        )}
      </div>

      <div>
        <label className="block text-gray-700 font-semibold">И-мэйл:</label>
        {editMode ? (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        ) : (
          <p className="mt-1">{email}</p>
        )}
      </div>

      <div>
        <label className="block text-gray-700 font-semibold">Утас:</label>
        {editMode ? (
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        ) : (
          <p className="mt-1">{phone || "-"}</p>
        )}
      </div>

      {/* Нэмэлт талбарууд */}
      <div>
        <label className="block text-gray-700 font-semibold">Бүтэн нэр:</label>
        {editMode ? (
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        ) : (
          <p className="mt-1">{fullName || "-"}</p>
        )}
      </div>

      <div>
        <label className="block text-gray-700 font-semibold">
          Танилцуулга:
        </label>
        {editMode ? (
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        ) : (
          <p className="mt-1 whitespace-pre-line">{bio || "-"}</p>
        )}
      </div>

      <div>
        <label className="block text-gray-700 font-semibold">Хаяг:</label>
        {editMode ? (
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        ) : (
          <p className="mt-1">{address || "-"}</p>
        )}
      </div>

      {/* Засварлах / Хадгалах товч */}
      <div className="flex gap-4 mt-6">
        {editMode ? (
          <>
            <button
              onClick={handleSubmit}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
            >
              Хадгалах
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded"
            >
              Болих
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
          >
            Засварлах
          </button>
        )}
      </div>

      {/* Host болох товч */}
      {!user.is_host && !editMode && (
        <button
          onClick={handleBecomeHost}
          className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded"
        >
          Host болох
        </button>
      )}
    </main>
  );
}
