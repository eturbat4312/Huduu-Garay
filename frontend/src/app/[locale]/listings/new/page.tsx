// filename: src/app/[locale]/listings/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/axios";
import { format } from "date-fns";
import { DayPicker } from "react-day-picker";
import Image from "next/image";
import "react-day-picker/dist/style.css";
import { t } from "@/lib/i18n";
import NumberStepper from "@/components/NumberStepper";
import LoadingButton from "@/components/LoadingButton";
import LocationField from "@/components/LocationField"; // 🆕 MAP-PIN КОМПОНЕНТ

type Category = { id: number; name: string };
type Amenity = { id: number; name: string };

export default function CreateListingPage() {
  const router = useRouter();
  const { locale } = useParams();

  // ─── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [location, setLocation] = useState({
    location_city: "",
    location_district: "",
    location_khoroo: "",
    location_extra: "",
    location_building: "",
    location_apartment: "",
    location_lat: null as number | null,
    location_lng: null as number | null,
  });

  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState(1);
  const [maxGuests, setMaxGuests] = useState(1);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [amenityIds, setAmenityIds] = useState<number[]>([]);
  const [amenityOptions, setAmenityOptions] = useState<Amenity[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ─── Load options ───────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/categories/").then((res) => setCategories(res.data));
    api.get("/amenities/").then((res) => setAmenityOptions(res.data));
  }, []);

  // ─── Images ─────────────────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    if (images.length + newFiles.length > 6) {
      alert(t(locale as string, "max_images_warning"));
      return;
    }
    setImages((prev) => [...prev, ...newFiles]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageUpload = async (listingId: number) => {
    if (images.length === 0) return;
    const formData = new FormData();
    images.forEach((img) => formData.append("images", img));
    formData.append("listing", String(listingId));
    await api.post("/listing-images/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const plainPrice = Number(price.replace(/,/g, ""));

    if (!location.location_city.trim() || !location.location_district.trim()) {
      alert("Хот/Аймаг болон Дүүрэг/Сум заавал бөглөнө үү.");
      setSubmitting(false);
      return;
    }

    if (location.location_lat == null || location.location_lng == null) {
      alert(
        t(locale as string, "please_drop_pin") ||
          "Газрын зураг дээр байршлаа pin-ээр зааж өгнө үү."
      );
      setSubmitting(false);
      return;
    }

    if (!categoryId || plainPrice <= 0 || beds <= 0 || maxGuests <= 0) {
      alert(t(locale as string, "form_invalid_warning"));
      setSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);

      formData.append("location_city", location.location_city);
      formData.append("location_district", location.location_district);
      formData.append("location_khoroo", location.location_khoroo);
      formData.append("location_extra", location.location_extra);
      formData.append("location_building", location.location_building);
      formData.append("location_apartment", location.location_apartment);
      formData.append("location_lat", String(location.location_lat));
      formData.append("location_lng", String(location.location_lng));

      formData.append("price_per_night", String(plainPrice));
      formData.append("beds", String(beds));
      formData.append("max_guests", String(maxGuests));
      formData.append("category_id", String(categoryId));
      amenityIds.forEach((id) => formData.append("amenity_ids", String(id)));

      const res = await api.post("/listings/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const listingId = res.data.id;
      await handleImageUpload(listingId);

      const dateList = selectedDates.map((d) => format(d, "yyyy-MM-dd"));
      if (dateList.length) {
        await api.post("/availability/bulk/", {
          listing: listingId,
          dates: dateList,
        });
      }

      router.push(`/${locale}/listings/${listingId}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: unknown }; message?: string };
      console.error(
        "Зар үүсгэж чадсангүй",
        error.response?.data || error.message
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (val: string) =>
    val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        {t(locale as string, "create_listing_title")}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Зүүн тал — үндсэн мэдээлэл (2 багана эзэлнэ) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ерөнхий мэдээлэл */}
          <section className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">
              📄 {t(locale as string, "general_info")}
            </h2>

            <label className="block mb-4">
              <span className="block text-sm font-medium">
                {t(locale as string, "title_label")}
              </span>
              <input
                className="w-full border p-2 mt-1 rounded-md"
                placeholder={t(locale as string, "title_placeholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            <label className="block mb-4">
              <span className="block text-sm font-medium">
                {t(locale as string, "description_label")}
              </span>
              <textarea
                className="w-full border p-2 mt-1 rounded-md"
                placeholder={t(locale as string, "description_placeholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </label>

            {/* 🆕 Байршил: зөвхөн map pin (+ optional текст) */}
            <LocationField
              value={location}
              onChange={setLocation}
              language={locale as string}
            />

            {/* Үнэ */}
            <label className="block mt-6">
              <span className="block text-sm font-medium">
                {t(locale as string, "price_label")}
              </span>
              <input
                className="w-full border p-2 mt-1 rounded-md"
                placeholder={t(locale as string, "price_placeholder")}
                value={price}
                onChange={(e) => setPrice(formatPrice(e.target.value))}
                required
              />
            </label>
          </section>

          {/* Байрны дэлгэрэнгүй */}
          <section className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">
              🛏 {t(locale as string, "details_section")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="block text-sm font-medium mb-1">
                  {t(locale as string, "beds_label")}
                </span>
                <NumberStepper
                  value={beds}
                  onChange={setBeds}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>

              <div>
                <span className="block text-sm font-medium mb-1">
                  {t(locale as string, "guests_label")}
                </span>
                <NumberStepper
                  value={maxGuests}
                  onChange={setMaxGuests}
                  min={1}
                  max={30}
                  step={1}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <label className="block">
                <span className="block text-sm font-medium">
                  {t(locale as string, "category_label")}
                </span>
                <select
                  className="w-full border p-2 mt-1 rounded-md"
                  value={categoryId ?? ""}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  required
                >
                  <option value="">
                    {t(locale as string, "select_option")}
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="block">
                <span className="block text-sm font-medium">
                  {t(locale as string, "amenities_label")}
                </span>
                <div className="grid grid-cols-2 gap-2 mt-2 border rounded-md p-3 max-h-44 overflow-auto">
                  {amenityOptions.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        value={a.id}
                        checked={amenityIds.includes(a.id)}
                        onChange={(e) => {
                          const id = Number(e.target.value);
                          setAmenityIds((prev) =>
                            prev.includes(id)
                              ? prev.filter((x) => x !== id)
                              : [...prev, id]
                          );
                        }}
                      />
                      <span>{a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Баруун тал: зураг + календар */}
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">
              🖼 {t(locale as string, "images_label")}
            </h2>
            <input
              type="file"
              accept="image/*"
              multiple
              className="block text-sm text-gray-700 border border-dashed border-gray-300 rounded-lg w-full p-4 cursor-pointer hover:bg-gray-50"
              onChange={handleImageChange}
            />
            {!!images.length && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {images.map((file, i) => (
                  <div key={i} className="relative">
                    <Image
                      src={URL.createObjectURL(file)}
                      alt={`preview-${i}`}
                      width={200}
                      height={200}
                      className="w-full h-28 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 bg-white text-red-600 rounded-full px-2 py-1 text-xs shadow"
                      aria-label="remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {t(locale as string, "image_tip_max6")}
            </p>
          </section>

          <section className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">
              📅 {t(locale as string, "available_dates_label")}
            </h2>
            <div className="border rounded p-2">
              <DayPicker
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates ?? [])}
                fromDate={new Date()}
              />
            </div>
          </section>

          <LoadingButton
            type="submit"
            text={t(locale as string, "submit_button")}
            loadingText={t(locale as string, "submitting_button")}
            loading={submitting}
            className="w-full bg-green-600 hover:bg-green-700"
          />
        </div>
      </form>
    </div>
  );
}
