"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/axios";
import { format } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { t } from "@/lib/i18n";

export default function CreateListingPage() {
  const router = useRouter();
  const { locale } = useParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState(1);
  const [maxGuests, setMaxGuests] = useState(1);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState([]);
  const [amenityIds, setAmenityIds] = useState<number[]>([]);
  const [amenityOptions, setAmenityOptions] = useState([]);
  const [images, setImages] = useState<File[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  useEffect(() => {
    api.get("/categories/").then((res) => setCategories(res.data));
    api.get("/amenities/").then((res) => setAmenityOptions(res.data));
  }, []);

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
    images.forEach((img) => {
      formData.append("images", img);
    });
    formData.append("listing", String(listingId));
    await api.post("/listing-images/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const plainPrice = Number(price.replace(/,/g, ""));
    if (!categoryId || plainPrice <= 0 || beds <= 0 || maxGuests <= 0) {
      alert(t(locale as string, "form_invalid_warning"));
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("location_text", location);
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
      await api.post("/availability/bulk/", {
        listing: listingId,
        dates: dateList,
      });

      router.push(`/${locale}/listings/${listingId}`);
    } catch (err: any) {
      console.error("Зар үүсгэж чадсангүй", err.response?.data || err.message);
    }
  };

  const formatPrice = (val: string) =>
    val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-6">
        {t(locale as string, "create_listing_title")}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          {t(locale as string, "title_label")}
          <input
            className="w-full border p-2 mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="block">
          {t(locale as string, "description_label")}
          <textarea
            className="w-full border p-2 mt-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>

        <label className="block">
          {t(locale as string, "location_label")}
          <input
            className="w-full border p-2 mt-1"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </label>

        <label className="block">
          {t(locale as string, "price_label")}
          <input
            className="w-full border p-2 mt-1"
            value={price}
            onChange={(e) => setPrice(formatPrice(e.target.value))}
            required
          />
        </label>

        <label className="block">
          {t(locale as string, "beds_label")}
          <input
            type="number"
            className="w-full border p-2 mt-1"
            value={beds}
            onChange={(e) => setBeds(Number(e.target.value))}
            required
          />
        </label>

        <label className="block">
          {t(locale as string, "guests_label")}
          <input
            type="number"
            className="w-full border p-2 mt-1"
            value={maxGuests}
            onChange={(e) => setMaxGuests(Number(e.target.value))}
            required
          />
        </label>

        <label className="block">
          {t(locale as string, "category_label")}
          <select
            className="w-full border p-2 mt-1"
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            required
          >
            <option value="">{t(locale as string, "select_option")}</option>
            {categories.map((cat: any) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          {t(locale as string, "amenities_label")}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {amenityOptions.map((a: any) => (
              <label key={a.id} className="flex items-center space-x-2">
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
        </label>

        <label className="block">
          {t(locale as string, "images_label")}
          <input
            type="file"
            accept="image/*"
            multiple
            className="block mt-2 text-sm text-gray-700 border border-gray-300 rounded w-full p-1 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            onChange={handleImageChange}
          />
        </label>

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {images.map((file, i) => (
              <div key={i} className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`preview-${i}`}
                  className="w-full h-28 object-cover rounded"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-white text-red-600 rounded-full px-2 py-1 text-xs shadow"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="block">
          {t(locale as string, "available_dates_label")}
          <div className="mt-2 border rounded p-2">
            <DayPicker
              mode="multiple"
              selected={selectedDates}
              onSelect={setSelectedDates}
              required
              fromDate={new Date()}
            />
          </div>
        </label>

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded"
        >
          {t(locale as string, "submit_button")}
        </button>
      </form>
    </div>
  );
}
