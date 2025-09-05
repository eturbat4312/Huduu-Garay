// filename: src/app/[locale]/edit-listing/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import Image from "next/image";
import { t } from "@/lib/i18n";
import LoadingButton from "@/components/LoadingButton";
import NumberStepper from "@/components/NumberStepper";
import LocationField from "@/components/LocationField";

type Amenity = { id: number; name: string; translation_key?: string };
type Category = { id: number; name: string };
type ListingImage = { id: number; image: string };

type FormState = {
  title: string;
  description: string;
  price_per_night: string;
  location_text: string;
  location_lat: number | null;
  location_lng: number | null;
  beds: number;
  max_guests: number;
  category_id: number | null;
  amenity_ids: number[];
};

export default function EditListingPage() {
  const { id, locale } = useParams<{ id: string; locale: string }>();
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    price_per_night: "",
    location_text: "",
    location_lat: null,
    location_lng: null,
    beds: 1,
    max_guests: 1,
    category_id: null,
    amenity_ids: [],
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [initialDates, setInitialDates] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  useEffect(() => {
    const fetchData = async () => {
      const [
        listingRes,
        amenitiesRes,
        categoriesRes,
        availabilityRes,
        bookingsRes,
      ] = await Promise.all([
        api.get(`/listings/${id}/`),
        api.get("/amenities/"),
        api.get("/categories/"),
        api.get(`/availability/?listing=${id}`),
        api.get("/host-bookings/"),
      ]);

      const listing = listingRes.data;
      setForm({
        title: listing.title,
        description: listing.description,
        price_per_night: listing.price_per_night.toString(),
        location_text: listing.location_text,
        location_lat: listing.location_lat,
        location_lng: listing.location_lng,
        beds: listing.beds,
        max_guests: listing.max_guests,
        category_id: listing.category?.id || null,
        amenity_ids: listing.amenities.map((a: Amenity) => a.id),
      });

      setImages(listing.images || []);
      setAllAmenities(amenitiesRes.data);
      setCategories(categoriesRes.data);

      const available = availabilityRes.data.map(
        (a: { date: string }) => a.date
      );
      setInitialDates(available);
      setSelectedDates(available.map((d: string) => new Date(d + "T00:00:00")));

      const booked: string[] = [];
      bookingsRes.data.forEach(
        (booking: {
          listing: { id: number };
          is_cancelled_by_host: boolean;
          check_in: string;
          check_out: string;
        }) => {
          if (booking.listing.id !== Number(id)) return;
          if (booking.is_cancelled_by_host) return;
          const date = new Date(booking.check_in);
          const end = new Date(booking.check_out);
          while (date < end) {
            booked.push(formatDate(date));
            date.setDate(date.getDate() + 1);
          }
        }
      );
      setBookedDates(new Set(booked));
    };

    if (id) fetchData();
  }, [id]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAmenityToggle = (amenityId: number) => {
    setForm((prev) => ({
      ...prev,
      amenity_ids: prev.amenity_ids.includes(amenityId)
        ? prev.amenity_ids.filter((id) => id !== amenityId)
        : [...prev.amenity_ids, amenityId],
    }));
  };

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 6 - images.length);
    setNewImages((prev) => [...prev, ...files]);
  };

  const handleImageRemove = async (index: number) => {
    const imageToDelete = images[index];
    const isNew = !imageToDelete.id;

    if (isNew) {
      setNewImages((prev) => prev.filter((_, i) => i !== index));
    } else {
      try {
        await api.delete(`/listing-images/${imageToDelete.id}/delete/`);
        setImages((prev) => prev.filter((_, i) => i !== index));
      } catch (err: unknown) {
        console.error("Зураг устгах үед алдаа:", err);
      }
    }
  };

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (!dates) return;
    const filtered = dates.filter((date) => {
      const dateStr = formatDate(date);
      return !bookedDates.has(dateStr);
    });
    setSelectedDates(filtered);
  };

  const handleDelete = async () => {
    if (!confirm(t(locale, "confirm_delete_listing"))) return;
    try {
      setDeleting(true);
      await api.delete(`/listings/${id}/delete/`);
      alert(t(locale, "alert_deleted_success"));
      router.push(`/${locale}/my-listings`);
    } catch {
      alert(t(locale, "alert_delete_failed"));
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);

      const payload = {
        ...form,
        price_per_night: parseInt(form.price_per_night),
        beds: Number(form.beds),
        max_guests: Number(form.max_guests),
      };

      await api.put(`/listings/${id}/edit/`, payload);

      const currentDateStrings = selectedDates.map(formatDate);
      const changed =
        currentDateStrings.length !== initialDates.length ||
        !currentDateStrings.every((d) => initialDates.includes(d));

      if (changed) {
        await api.post(`/availability/delete-by-listing/`, { listing: id });
        await api.post(`/availability/bulk/`, {
          listing: id,
          dates: currentDateStrings,
        });
      }

      if (newImages.length > 0) {
        const formData = new FormData();
        for (const img of newImages) {
          formData.append("images", img);
        }
        formData.append("listing", id!.toString());

        await api.post("/listing-images/", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      alert(t(locale, "alert_saved_successfully"));
      router.push(`/${locale}/listings/${id}`);
    } catch (err: unknown) {
      console.error("Хадгалах үед алдаа:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-6">
        {t(locale, "edit_listing_title")}
      </h1>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Зүүн талын үндсэн мэдээлэл */}
        <div className="md:col-span-2 space-y-6">
          {/* Title + Location */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">
                {t(locale, "form_title")}
              </label>
              <input
                name="title"
                value={form.title}
                onChange={handleInputChange}
                className="border p-2 rounded w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                {t(locale, "form_location")}
              </label>
              <input
                name="location_text"
                value={form.location_text}
                onChange={handleInputChange}
                className="border p-2 rounded w-full"
              />
            </div>
          </div>

          {/* Map */}
          <LocationField
            value={{
              location_text: form.location_text,
              location_lat: form.location_lat,
              location_lng: form.location_lng,
            }}
            onChange={(v) =>
              setForm((prev) => ({
                ...prev,
                location_text: v.location_text,
                location_lat: v.location_lat,
                location_lng: v.location_lng,
              }))
            }
            placeholder="Жишээ: Архангай, Цэнхэр"
            language={locale}
          />

          {/* Price */}
          <div>
            <label className="text-sm font-medium">
              {t(locale, "form_price")}
            </label>
            <input
              type="number"
              name="price_per_night"
              value={form.price_per_night}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">
              {t(locale, "form_description")}
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleInputChange}
              className="border p-2 rounded w-full h-32"
            />
          </div>

          {/* Images */}
          <div>
            <label className="text-sm font-medium block mb-1">
              {t(locale, "form_images")}
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageAdd}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <Image
                    src={img.image}
                    alt="preview"
                    width={100}
                    height={100}
                    className="rounded"
                  />
                  <button
                    onClick={() => handleImageRemove(i)}
                    className="absolute top-0 right-0 bg-red-600 text-white text-xs rounded px-1"
                  >
                    x
                  </button>
                </div>
              ))}
              {newImages.map((file, i) => (
                <div key={`new-${i}`} className="relative">
                  <Image
                    src={URL.createObjectURL(file)}
                    alt="new"
                    width={100}
                    height={100}
                    className="rounded"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div>
            <h2 className="font-semibold mb-2">
              {t(locale, "form_available_dates")}
            </h2>
            <DayPicker
              mode="multiple"
              selected={selectedDates}
              onSelect={handleDateSelect}
              modifiers={{
                booked: Array.from(bookedDates).map(
                  (d) => new Date(d + "T00:00:00")
                ),
              }}
              modifiersStyles={{
                booked: { backgroundColor: "#f87171", color: "white" },
              }}
            />
            <p className="text-sm text-gray-600 mt-2">
              🔒 {t(locale, "form_booked_dates_note")}
            </p>
          </div>
        </div>

        {/* Баруун талын sidebar */}
        <div className="space-y-6">
          {/* Beds */}
          <div>
            <label className="text-sm font-medium">
              {t(locale, "form_beds")}
            </label>
            <NumberStepper
              value={form.beds}
              onChange={(v) => setForm((prev) => ({ ...prev, beds: v }))}
              min={1}
              max={20}
            />
          </div>

          {/* Guests */}
          <div>
            <label className="text-sm font-medium">
              {t(locale, "form_guests")}
            </label>
            <NumberStepper
              value={form.max_guests}
              onChange={(v) => setForm((prev) => ({ ...prev, max_guests: v }))}
              min={1}
              max={50}
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium">
              {t(locale, "form_category")}
            </label>
            <select
              name="category_id"
              value={form.category_id || ""}
              onChange={handleInputChange}
              className="border p-2 rounded w-full"
            >
              <option value="">Сонгох...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amenities */}
          <div>
            <h2 className="font-semibold mb-2">
              {t(locale, "form_amenities")}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {allAmenities.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.amenity_ids.includes(a.id)}
                    onChange={() => handleAmenityToggle(a.id)}
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-2">
            <LoadingButton
              onClick={handleSubmit}
              text={t(locale, "form_save_button")}
              loadingText={t(locale, "form_saving_button")}
              loading={saving}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded w-full"
            />
            <button
              onClick={() => router.back()}
              className="bg-gray-300 px-4 py-2 rounded w-full"
            >
              {t(locale, "form_cancel_button")}
            </button>
            <LoadingButton
              onClick={handleDelete}
              text={t(locale, "form_delete_button")}
              loadingText={t(locale, "form_deleting_button")}
              loading={deleting}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded w-full"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
