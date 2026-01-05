"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function DashboardDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!(e.target instanceof Node)) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        className="rounded-full bg-black text-white px-6 py-3 hover:opacity-90 focus:outline-none"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
      >
        Go to Research Dashboard
      </button>

      <div
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="options-menu"
        className={`absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 ${
          open ? "block" : "hidden"
        }`}
      >
        <div className="py-1">
          <Link href="/nvda" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setOpen(false)}>
            NVDA
          </Link>
          <Link href="/amzn" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setOpen(false)}>
            AMZN
          </Link>
            <Link href="/ctas" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setOpen(false)}>
            CTAS
          </Link>
        </div>
      </div>
    </div>
  );
}
