// 📄 CategorySelector.tsx

"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { cn } from "@/lib/utils";

const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "/media";

type Category = {
  id: number;
  name: string;
  icon?: string;
  image?: string;
};

export default function CategorySelector() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    axios
      .get("/api/categories/")
      .then((res) => {
        console.log("✅ Categories loaded:", res.data);
        setCategories(res.data);
      })
      .catch((err) => console.error("❌ Category fetch error:", err));
  }, []);

  return (
    <div className="flex gap-4 overflow-x-auto py-4 px-2 bg-white border-b">
      {categories.map((cat) => {
        const imageSrc =
          cat.image && cat.image.startsWith("http")
            ? cat.image
            : `${MEDIA_URL}${cat.image || ""}`;

        return (
          <button
            key={cat.id}
            onClick={() => setSelectedId(cat.id)}
            className={cn(
              "flex flex-col items-center justify-center px-4 py-2 rounded-lg border hover:bg-gray-100 min-w-[90px]",
              selectedId === cat.id
                ? "bg-green-100 border-green-500"
                : "border-gray-300"
            )}
          >
            {cat.image ? (
              <img
                src={imageSrc}
                alt={cat.name}
                className="w-8 h-8 mb-1 rounded object-cover"
              />
            ) : (
              <div className="mb-1 text-2xl">{cat.icon}</div>
            )}
            <span className="text-sm text-gray-700">{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
