export const DEFAULT_STORE_TIMEZONE = "Asia/Makassar";

export function getLocalDateString(
  date: Date = new Date(),
  timeZone: string = DEFAULT_STORE_TIMEZONE
): string {
  const formatter = new Intl.DateTimeFormat("id-ID", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function getLocalPeriodString(
  date: Date = new Date(),
  timeZone: string = DEFAULT_STORE_TIMEZONE
): string {
  return getLocalDateString(date, timeZone).slice(0, 7);
}

/**
 * Mengonversi tanggal lokal toko (YYYY-MM-DD) menjadi rentang timestamp UTC penuh
 * agar transaksi pagi hari (misal 06:00 - 07:59 WITA = 22:00 - 23:59 UTC H-1)
 * tetap masuk ke hari bisnis yang benar.
 */
export function getLocalDayUtcBounds(
  localDateYmd: string,
  utcOffset: string = "+08:00"
): { startUtcIso: string; endUtcIso: string } {
  const start = new Date(`${localDateYmd}T00:00:00.000${utcOffset}`);
  const end = new Date(`${localDateYmd}T23:59:59.999${utcOffset}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const fallback = localDateYmd.slice(0, 10);
    return {
      startUtcIso: `${fallback}T00:00:00.000Z`,
      endUtcIso: `${fallback}T23:59:59.999Z`,
    };
  }
  return {
    startUtcIso: start.toISOString(),
    endUtcIso: end.toISOString(),
  };
}

export function isTimestampOnLocalDate(
  isoTimestamp: string | null | undefined,
  localDateYmd: string,
  timeZone: string = DEFAULT_STORE_TIMEZONE
): boolean {
  if (!isoTimestamp) return false;
  // Jika string hanya YYYY-MM-DD tanpa jam, bandingkan langsung
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoTimestamp.trim())) {
    return isoTimestamp.trim() === localDateYmd;
  }
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp.slice(0, 10) === localDateYmd;
  }
  return getLocalDateString(parsed, timeZone) === localDateYmd;
}
