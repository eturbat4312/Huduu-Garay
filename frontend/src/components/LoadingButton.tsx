// filename: src/components/LoadingButton.tsx
"use client";

import { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

// classname merge хийх туслах функц (байхгүй бол зүгээр л string нэмээд явж болно)
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean; // одоо ажиллаж байгаа эсэх
  text: string; // default товчны текст
  loadingText?: string; // loading үед харуулах текст
}

export default function LoadingButton({
  loading = false,
  text,
  loadingText = "Ачааллаж байна...",
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={cn(
        "px-4 py-2 rounded bg-primary text-white font-medium flex items-center justify-center gap-2 transition",
        loading || props.disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-primary/80",
        className
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? loadingText : text}
    </button>
  );
}
