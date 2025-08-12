// filename: src/components/NumberStepper.tsx
"use client";

import { useCallback } from "react";

type Props = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string; // a11y
  className?: string;
};

export default function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
  label = "",
  className = "",
}: Props) {
  const clamp = useCallback(
    (v: number) => Math.max(min, Math.min(max, v)),
    [min, max]
  );

  const inc = () => onChange(clamp(value + step));
  const dec = () => onChange(clamp(value - step));

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, "");
    if (digits === "") {
      onChange(min);
      return;
    }
    onChange(clamp(parseInt(digits, 10)));
  };

  const handleWheel: React.WheelEventHandler<HTMLInputElement> = (e) => {
    // санамсаргүй өөрчлөгдөхөөс хамгаална
    (e.target as HTMLInputElement).blur();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      inc();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      dec();
    }
  };

  return (
    <div
      className={`flex items-center rounded-xl border border-gray-300 overflow-hidden ${className}`}
      aria-label={label}
    >
      <button
        type="button"
        onClick={dec}
        className="px-3 py-2 text-lg hover:bg-gray-50 disabled:opacity-40"
        disabled={value <= min}
        aria-label="Decrease"
      >
        –
      </button>

      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={Number.isFinite(value) ? String(value) : ""}
        onChange={handleInput}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        className="w-full text-center outline-none py-2"
        aria-live="polite"
      />

      <button
        type="button"
        onClick={inc}
        className="px-3 py-2 text-lg hover:bg-gray-50 disabled:opacity-40"
        disabled={value >= max}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
