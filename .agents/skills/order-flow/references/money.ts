export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Persentase dari basis points (1000 = 10%), dibulatkan ke Rupiah. */
export function applyBps(base: number, bps: number): number {
  return Math.round((base * bps) / 10000);
}
