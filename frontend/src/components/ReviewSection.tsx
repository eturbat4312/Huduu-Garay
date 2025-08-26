// filename: src/components/ReviewSection.tsx
"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import { t } from "@/lib/i18n";

interface Review {
  id: number;
  listing: number;
  guest: number;
  guest_username: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface Booking {
  id: number;
  listing: { id: number };
  check_in: string;
  check_out: string;
}

export default function ReviewSection({ listingId }: { listingId: number }) {
  const { user } = useAuth();
  const { locale } = useParams() as { locale: string };
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const [error, setError] = useState("");
  const [hasBooking, setHasBooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get<Review[]>(`/listings/${listingId}/reviews/`);
        setReviews(res.data);

        if (user) {
          const bookingRes = await api.get<Booking[]>("/bookings/my/");
          const today = new Date();

          const hasPastBooking = bookingRes.data.some(
            (b) => b.listing.id === listingId && new Date(b.check_out) < today
          );
          setHasBooking(hasPastBooking);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error("Error fetching reviews:", err.message);
        } else {
          console.error("Error fetching reviews:", err);
        }
      }
    };

    fetchData();
  }, [listingId, user]);

  const handleSubmit = async () => {
    if (!comment || rating <= 0) {
      setError(t(locale, "review.error_required"));
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post<Review>(`/listings/${listingId}/reviews/`, {
        listing: listingId,
        rating,
        comment,
      });
      setReviews((prev) => [...prev, res.data]);
      setComment("");
      setRating(0);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Review submit error:", err.message);
      }
      setError(t(locale, "review.error_submit"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-10 space-y-6">
      <h3 className="text-xl font-bold text-green-700">
        {t(locale, "review.title")}
      </h3>

      {reviews.length === 0 ? (
        <p className="text-gray-600">{t(locale, "review.empty")}</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="border-b pb-3">
              <p className="text-sm text-gray-800">
                ⭐ {r.rating} – <strong>{r.guest_username}</strong>
              </p>
              <p className="text-sm text-gray-600">{r.comment}</p>
              <p className="text-xs text-gray-400">
                {new Date(r.created_at).toLocaleDateString(locale)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {user && hasBooking && (
        <div className="mt-6 border-t pt-4">
          <h4 className="font-semibold mb-2">
            {t(locale, "review.leave_review")}
          </h4>
          <div className="flex items-center gap-2 mb-2">
            <label htmlFor="rating">⭐ {t(locale, "review.rating")}:</label>
            <select
              id="rating"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="border p-1 rounded"
            >
              <option value={0}>--</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border p-2 rounded mb-2"
            rows={3}
            placeholder={t(locale, "review.placeholder")}
          ></textarea>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            {t(locale, "review.submit")}
          </button>
        </div>
      )}
    </div>
  );
}
