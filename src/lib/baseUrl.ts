// src/lib/baseUrl.ts

export function getApiBaseUrl() {
  // Prefer explicit base URL you set
  const explicit =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL;

  if (explicit) return explicit.replace(/\/$/, "");

  // Vercel provides VERCEL_URL without protocol
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");

  // Local dev fallback
  return "http://localhost:3000";
}
