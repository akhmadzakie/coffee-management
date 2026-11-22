import React, { useLayoutEffect, useRef } from "react";

/**
 * Menghilangkan tanda pemisah ribuan (.) dari string input dan mengembalikan
 * string angka murni yang valid untuk state/kalkulasi JS (titik desimal `.`).
 */
export function parseThousandInput(raw: string, allowDecimals = false): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";

  if (!allowDecimals) {
    return trimmed.replace(/\D/g, "");
  }

  // Izinkan koma sebagai desimal (gaya Indonesia), hapus pemisah ribuan (titik).
  // Jika pengguna mengetik titik terakhir tanpa angka setelahnya saat tidak ada koma,
  // perlakukan seperlunya; lebih aman: di UI Indonesia, titik adalah pemisah ribuan, koma adalah desimal.
  const withoutThousandDots = trimmed.replace(/\./g, "");
  const cleaned = withoutThousandDots.replace(/[^0-9,]/g, "");
  const parts = cleaned.split(",");
  if (parts.length === 1) {
    return parts[0];
  }
  const intPart = parts[0];
  const decPart = parts.slice(1).join("");
  return `${intPart}.${decPart}`;
}

/**
 * Memformat angka atau string numerik JS menjadi tampilan bertitik pemisah ribuan (ID),
 * contoh: 1500000 -> "1.500.000", "18.5" (allowDecimals) -> "18,5".
 */
export function formatThousandInput(
  val: string | number | null | undefined,
  allowDecimals = false,
  emptyWhenZero = false
): string {
  if (val === null || val === undefined || val === "") return "";

  if (typeof val === "number") {
    if (!Number.isFinite(val)) return "";
    if (emptyWhenZero && val === 0) return "";
  }

  const str = String(val);
  if (!str) return "";
  if (emptyWhenZero && (str === "0" || str === "0.0")) return "";

  if (!allowDecimals) {
    const digitsOnly = str.replace(/\D/g, "");
    if (!digitsOnly) return "";
    if (emptyWhenZero && Number(digitsOnly) === 0) return "";
    // Hilangkan leading zero berlebih kecuali single "0"
    const normalized = digitsOnly.replace(/^0+(?=\d)/, "");
    return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Nilai JS menggunakan '.' sebagai desimal
  const dotIdx = str.indexOf(".");
  let intPart = dotIdx >= 0 ? str.slice(0, dotIdx) : str;
  const decPart = dotIdx >= 0 ? str.slice(dotIdx + 1).replace(/\D/g, "") : "";
  const hasDecimal = dotIdx >= 0;

  intPart = intPart.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!intPart && hasDecimal) intPart = "0";
  if (!intPart && !hasDecimal) return "";

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return hasDecimal ? `${formattedInt},${decPart}` : formattedInt;
}

export interface CurrencyInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "value" | "onChange"
  > {
  value: string | number | null | undefined;
  onValueChange: (rawNumericString: string, numericValue: number) => void;
  allowDecimals?: boolean;
  emptyWhenZero?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Input nominal Rupiah dengan tanda bantu titik pemisah ribuan otomatis (misal 1.500.000)
 * sambil menjaga posisi kursor dan mengembalikan nilai numerik murni ke parent state.
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onValueChange,
  allowDecimals = false,
  emptyWhenZero = false,
  onChange,
  className = "",
  placeholder = "0",
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const nextCursorDigitsRef = useRef<number | null>(null);

  const formattedValue = formatThousandInput(
    value,
    allowDecimals,
    emptyWhenZero
  );

  useLayoutEffect(() => {
    const el = inputRef.current;
    const targetDigits = nextCursorDigitsRef.current;
    if (!el || targetDigits === null) return;
    nextCursorDigitsRef.current = null;

    let count = 0;
    let newPos = formattedValue.length;
    for (let i = 0; i < formattedValue.length; i++) {
      if (/[0-9,]/.test(formattedValue[i])) {
        count++;
      }
      if (count >= targetDigits) {
        newPos = i + 1;
        break;
      }
    }
    if (targetDigits === 0) newPos = 0;
    try {
      el.setSelectionRange(newPos, newPos);
    } catch {
      // Abaikan jika elemen tidak fokus atau tidak mendukung selectionRange
    }
  }, [formattedValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawText = e.target.value;
    const selStart = e.target.selectionStart ?? rawText.length;

    // Hitung jumlah karakter bermakna (digit & koma jika desimal) sebelum kursor
    const beforeCursor = rawText.slice(0, selStart);
    const meaningfulRegex = allowDecimals ? /[0-9,]/g : /\d/g;
    const meaningfulMatches = beforeCursor.match(meaningfulRegex);
    nextCursorDigitsRef.current = meaningfulMatches ? meaningfulMatches.length : 0;

    // Izinkan pengguna mengetik titik pada mode non-decimal hanya jika merupakan separator atau ketik baru:
    // parseThousandInput menghapus semua non-digit (pada non-decimal), jadi mengetik digit berjalan normal.
    const cleanString = parseThousandInput(rawText, allowDecimals);
    const numericValue = cleanString ? Number(cleanString) || 0 : 0;

    onValueChange(cleanString, numericValue);
    if (onChange) {
      onChange({
        ...e,
        target: {
          ...e.target,
          value: cleanString,
        },
        currentTarget: {
          ...e.currentTarget,
          value: cleanString,
        },
      });
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={allowDecimals ? "decimal" : "numeric"}
      value={formattedValue}
      onChange={handleInputChange}
      placeholder={placeholder}
      className={`tabular-nums ${className}`}
      {...rest}
    />
  );
};
