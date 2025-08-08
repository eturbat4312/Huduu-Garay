"use client";

import { useEffect, useState, ChangeEvent } from "react";
import api from "@/lib/axios";
import HostBankInfoSection from "@/components/HostBankInfoSection";
import { User } from "@/types";
import { useRefreshUser } from "@/context/AuthContext";
import { t } from "@/lib/i18n";
import { useParams } from "next/navigation";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [hostApp, setHostApp] = useState<any | null>(null);
  const { locale } = useParams();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [editMode, setEditMode] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hostPhoneNumber, setHostPhoneNumber] = useState(""); // 🆕
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [address, setAddress] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const refreshUser = useRefreshUser();

  // 🟡 Профайл fetch хийх
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/me/");
        setUser(res.data);
        setUsername(res.data.username);
        setEmail(res.data.email);
        setPhone(res.data.phone || "");
        setHostPhoneNumber(res.data.host_phone_number || ""); // 🆕
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

  // 🟡 HostApplication fetch хийх
  useEffect(() => {
    const fetchHostApp = async () => {
      try {
        const res = await api.get("/host/application/me/");
        setHostApp(res.data);
        setBankName(res.data.bank_name || "");
        setAccountNumber(res.data.account_number || "");
      } catch (err) {
        console.warn("❌ HostApplication not found.");
      }
    };

    if (user?.is_host) {
      fetchHostApp();
    }
  }, [user]);

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
    formData.append("host_phone_number", hostPhoneNumber); // ✅
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
      setAvatarPreview(res.data.avatar || null);
      await refreshUser();
      // setSuccessMsg({t(locale, "success_save_profile")});
      setSuccessMsg(t(locale, "success_save_profile"));
      setEditMode(false);

      if (user?.is_host && hostApp) {
        await api.patch("/host/application/me/", {
          bank_name: bankName,
          account_number: accountNumber,
        });
      }
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
      <h1 className="text-3xl font-bold text-green-700">
        {t(locale, "profile_title")}
      </h1>

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}
      {successMsg && <p className="text-green-600">{successMsg}</p>}

      {/* 🖼 Avatar */}
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 rounded-full overflow-hidden border bg-gray-100">
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

      {/* 👤 User fields */}
      <div>
        <label className="block text-gray-700 font-semibold">
          {t(locale, "label_username")}
        </label>
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
        <label className="block text-gray-700 font-semibold">
          {t(locale, "label_email")}
        </label>
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
        <label className="block text-gray-700 font-semibold">
          {t(locale, "label_phone")}
        </label>
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

      {user.is_host && (
        <div>
          <label className="block text-gray-700 font-semibold">
            {t(locale, "host_phone")}
          </label>
          {editMode ? (
            <input
              type="tel"
              value={hostPhoneNumber}
              onChange={(e) => setHostPhoneNumber(e.target.value)}
              className="mt-1 block w-full border rounded px-3 py-2"
            />
          ) : (
            <p className="mt-1">{hostPhoneNumber || "-"}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-gray-700 font-semibold">
          {t(locale, "full_name")}
        </label>
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
          {t(locale, "label_introduction")}
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
        <label className="block text-gray-700 font-semibold">
          {t(locale, "label_address")}
        </label>
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

      {/* 🏦 Host only bank info */}
      {user?.is_host && hostApp?.status === "approved" && (
        <HostBankInfoSection
          user={user}
          bankName={bankName}
          accountNumber={accountNumber}
          editMode={editMode}
          onBankNameChange={(e) => setBankName(e.target.value)}
          onAccountNumberChange={(e) => setAccountNumber(e.target.value)}
        />
      )}

      {/* 🔘 Buttons */}
      <div className="flex gap-4 mt-6">
        {editMode ? (
          <>
            <button
              onClick={handleSubmit}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
            >
              {t(locale, "save")}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded"
            >
              {t(locale, "cancel")}
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
          >
            {t(locale, "edit")}
          </button>
        )}
      </div>

      {!user.is_host && !editMode && (
        <button
          onClick={handleBecomeHost}
          className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded"
        >
          {t(locale, "become_host")}
        </button>
      )}
    </main>
  );
}
