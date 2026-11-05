import type { ViewState } from "../types";

/**
 * Feature flag modul operasional.
 *
 * Sistem ini difokuskan sebagai aplikasi MANAGEMENT (back-office). Kasir/POS dan
 * layar dapur (KDS) dijalankan di aplikasi lain, sehingga modul-modul berikut
 * dinonaktifkan secara default. Kode tetap ada dan dapat diaktifkan kembali
 * tanpa mengubah kode, cukup lewat environment variable saat build:
 *
 *   VITE_ENABLE_POS=true   -> Terminal POS, Shift & Kas Laci, Otorisasi Void/Refund
 *   VITE_ENABLE_KDS=true   -> Layar dapur / bar (KDS)
 *
 * Sisi server membaca ENABLE_POS / ENABLE_KDS (lihat server.ts).
 */
const flag = (value: unknown): boolean => String(value ?? "").toLowerCase() === "true";

export const FEATURES = {
  POS: flag(import.meta.env.VITE_ENABLE_POS),
  KDS: flag(import.meta.env.VITE_ENABLE_KDS),
} as const;

/** View yang tidak boleh diakses ketika modul terkait dinonaktifkan. */
export const DISABLED_VIEWS: ViewState[] = [
  ...(FEATURES.POS ? [] : (["pos_cashier", "shifts"] as ViewState[])),
  ...(FEATURES.KDS ? [] : (["kitchen_display"] as ViewState[])),
];

export const isViewEnabled = (view: ViewState): boolean => !DISABLED_VIEWS.includes(view);
