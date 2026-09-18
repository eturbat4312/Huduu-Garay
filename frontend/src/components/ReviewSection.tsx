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

interface ReviewEligibility {
  can_review: boolean;
  reason: string;
  reason_code: string;
  booking_id: number | null;
}

interface LoadedReviewEligibility extends ReviewEligibility {
  listingId: number;
  userId: number;
}

function getApiErrorMessage(error: unknown): string | null {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) {
    return data.find((value): value is string => typeof value === "string") ?? null;
  }
  if (data && typeof data === "object") {
    for (const value of Object.values(data as Record<string, unknown>)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value)) {
        const message = value.find((item): item is string => typeof item === "string");
        if (message) return message;
      }
    }
  }
  return null;
}

export default function ReviewSection({ listingId }: { listingId: number }) {
  const { user } = useAuth();
  const { locale } = useParams() as { locale: string };
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const [error, setError] = useState("");
  const [reviewEligibility, setReviewEligibility] =
    useState<LoadedReviewEligibility | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Claude: hover state for interactive star rating UI
  const [hoverRating, setHoverRating] = useState(0);
  const canReview =
    !!user &&
    reviewEligibility?.listingId === listingId &&
    reviewEligibility.userId === user.id &&
    reviewEligibility.can_review;

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const res = await api.get<Review[]>(`/listings/${listingId}/reviews/`);
        if (isMounted) setReviews(res.data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error("Error fetching reviews:", err.message);
        } else {
          console.error("Error fetching reviews:", err);
        }
      }

      if (!user) return;
      try {
        const res = await api.get<ReviewEligibility>(
          `/listings/${listingId}/review-eligibility/`
        );
        if (isMounted) {
          setReviewEligibility({
            ...res.data,
            listingId,
            userId: user.id,
          });
        }
      } catch (err: unknown) {
        if (isMounted) {
          setReviewEligibility({
            can_review: false,
            reason: "",
            reason_code: "no_completed_stay",
            booking_id: null,
            listingId,
            userId: user.id,
          });
        }
        console.error("Error fetching review eligibility:", err);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
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
      setReviewEligibility((current) =>
        current ? { ...current, can_review: false, booking_id: null } : current
      );
      api
        .get<ReviewEligibility>(`/listings/${listingId}/review-eligibility/`)
        .then((eligibility) => {
          if (user) {
            setReviewEligibility({
              ...eligibility.data,
              listingId,
              userId: user.id,
            });
          }
        })
        .catch(() => {});
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Review submit error:", err.message);
      }
      setError(getApiErrorMessage(err) ?? t(locale, "review.error_submit"));
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
              {/* Claude: display stars as filled/empty characters instead of emoji + number */}
              <p className="text-sm text-gray-800 flex items-center gap-1">
                <span className="text-yellow-400 text-base">
                  {"★".repeat(r.rating)}
                  <span className="text-gray-300">{"★".repeat(5 - r.rating)}</span>
                </span>
                <strong className="ml-1">{r.guest_username}</strong>
              </p>
              <p className="text-sm text-gray-600">{r.comment}</p>
              <p className="text-xs text-gray-400">
                {new Date(r.created_at).toLocaleDateString(locale)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {user && canReview && (
        <div className="mt-6 border-t pt-4">
          <h4 className="font-semibold mb-2">
            {t(locale, "review.leave_review")}
          </h4>
          {/* Claude: replaced <select> with interactive star buttons; rating state stays number 0-5, no other logic changed */}
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm mr-1">{t(locale, "review.rating")}:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-2xl transition-colors focus:outline-none"
                aria-label={`${n} star`}
              >
                <span
                  className={
                    n <= (hoverRating || rating)
                      ? "text-yellow-400"
                      : "text-gray-300"
                  }
                >
                  ★
                </span>
              </button>
            ))}
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
