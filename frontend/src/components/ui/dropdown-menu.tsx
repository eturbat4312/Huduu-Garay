// 📄 components/ui/dropdown-menu.tsx
"use client";

import {
  Menu,
  MenuButton,
  MenuItems,
  MenuItem,
  Transition,
} from "@headlessui/react";
import { Fragment } from "react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function DropdownMenu({ children }: { children: ReactNode }) {
  return (
    <Menu as="div" className="relative inline-block text-left">
      {children}
    </Menu>
  );
}

export function DropdownMenuTrigger({ children }: { children: ReactNode }) {
  return (
    <MenuButton className="flex items-center gap-2 focus:outline-none">
      {children}
      <ChevronDown className="w-4 h-4 text-gray-500" />
    </MenuButton>
  );
}

export function DropdownMenuContent({
  children,
  align = "end",
  className = "",
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <Transition
      as={Fragment}
      enter="transition ease-out duration-100"
      enterFrom="transform opacity-0 scale-95"
      enterTo="transform opacity-100 scale-100"
      leave="transition ease-in duration-75"
      leaveFrom="transform opacity-100 scale-100"
      leaveTo="transform opacity-0 scale-95"
    >
      <MenuItems
        className={`absolute z-50 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none ${
          align === "end"
            ? "right-0"
            : align === "center"
            ? "left-1/2 -translate-x-1/2"
            : "left-0"
        } ${className}`}
      >
        {children}
      </MenuItems>
    </Transition>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <MenuItem>
      {({ active }) => (
        <button
          type="button"
          onClick={onClick}
          className={`w-full text-left px-4 py-2 text-sm ${
            active ? "bg-gray-100" : ""
          } ${className}`}
        >
          {children}
        </button>
      )}
    </MenuItem>
  );
}
