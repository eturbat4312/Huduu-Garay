"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { DayPicker } from "react-day-picker";
import Image from "next/image";
import "react-day-picker/dist/style.css";
import { t } from "@/lib/i18n";

type Amenity = { id: number; name: string };
type Category = { id: number; name: string };

type FormState = {
  title: string;
  description: string;
  price_per_night: string;
  location_text: string;
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
    beds: 1,
    max_guests: 1,
    category_id: null,
    amenity_ids: [],
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [initialDates, setInitialDates] = useState<string[]>([]);

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
        beds: listing.beds,
        max_guests: listing.max_guests,
        category_id: listing.category?.id || null,
        amenity_ids: listing.amenities.map((a: any) => a.id),
      });

      setImages(listing.images || []);
      setAllAmenities(amenitiesRes.data);
      setCategories(categoriesRes.data);

      const available = availabilityRes.data.map((a: any) => a.date);
      setInitialDates(available);
      setSelectedDates(available.map((d: string) => new Date(d + "T00:00:00")));

      const booked: string[] = [];
      bookingsRes.data.forEach((booking: any) => {
        if (booking.listing.id !== Number(id)) return;
        if (booking.is_cancelled_by_host) return;
        let date = new Date(booking.check_in);
        const end = new Date(booking.check_out);
        while (date < end) {
          booked.push(formatDate(date));
          date.setDate(date.getDate() + 1);
        }
      });
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
      // Шинээр нэмэгдсэн зураг бол зүгээр frontend талаас устгана
      setNewImages((prev) => prev.filter((_, i) => i !== index));
    } else {
      try {
        await api.delete(`/listing-images/${imageToDelete.id}/delete/`);
        setImages((prev) => prev.filter((_, i) => i !== index));
      } catch (err) {
        console.error("Зураг устгах үед алдаа:", err);
      }
    }
  };

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (!dates) return;

    // Booked огноонуудыг үлдээж, зөвхөн booked биш огноог update хийнэ
    const filtered = dates.filter((date) => {
      const dateStr = formatDate(date);
      return !bookedDates.has(dateStr);
    });

    setSelectedDates(filtered);
  };

  const handleDelete = async () => {
    // if (!confirm("Та энэ зар устгахдаа итгэлтэй байна уу?")) return;
    if (!confirm(t(locale, "confirm_delete_listing"))) return;
    try {
      await api.delete(`/listings/${id}/delete/`);
      //   alert("Зар амжилттай устлаа");
      alert(t(locale, "alert_deleted_success"));

      // router.push("/my-listings");
      router.push(`/${locale}/my-listings`);
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert(t(locale, "alert_has_bookings_cannot_delete"));
      } else {
        alert(t(locale, "alert_delete_failed"));
      }
    }
  };

  const handleSubmit = async () => {
    try {
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
      // router.push(`/listings/${id}`);
      router.push(`/${locale}/listings/${id}`);
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "response" in err) {
        const errorData = (err as any).response?.data;
        console.error("Хадгалах үед алдаа:", errorData || err);
      } else {
        console.error("Алдааны мэдээлэл тодорхойгүй:", err);
      }
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t(locale, "edit_listing_title")}</h1>

      {/* --- INPUT FIELDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div>
          <label className="text-sm font-medium">
            {t(locale, "form_beds")}
          </label>
          <input
            type="number"
            name="beds"
            value={form.beds}
            onChange={handleInputChange}
            className="border p-2 rounded w-full"
          />
        </div>
        <div>
          <label className="text-sm font-medium">
            {t(locale, "form_guests")}
          </label>
          <input
            type="number"
            name="max_guests"
            value={form.max_guests}
            onChange={handleInputChange}
            className="border p-2 rounded w-full"
          />
        </div>
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
        <div className="md:col-span-2">
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
      </div>

      {/* --- AMENITIES --- */}
      <div>
        <h2 className="font-semibold mb-2">{t(locale, "form_amenities")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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

      {/* --- IMAGES --- */}
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

      {/* --- CALENDAR --- */}
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

      {/* --- BUTTONS --- */}
      <div className="flex gap-4">
        <button
          onClick={handleSubmit}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          {t(locale, "form_save_button")}
        </button>
        <button
          onClick={() => router.back()}
          className="bg-gray-300 px-4 py-2 rounded"
        >
          {t(locale, "form_cancel_button")}
        </button>
        <button
          onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          {t(locale, "form_delete_button")}
        </button>
      </div>
    </main>
  );
}
