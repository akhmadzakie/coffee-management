import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, X, Check, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const MONTH_NAMES_ID = [
  { num: "01", short: "Jan", full: "Januari", index: 0 },
  { num: "02", short: "Feb", full: "Februari", index: 1 },
  { num: "03", short: "Mar", full: "Maret", index: 2 },
  { num: "04", short: "Apr", full: "April", index: 3 },
  { num: "05", short: "Mei", full: "Mei", index: 4 },
  { num: "06", short: "Jun", full: "Juni", index: 5 },
  { num: "07", short: "Jul", full: "Juli", index: 6 },
  { num: "08", short: "Agu", full: "Agustus", index: 7 },
  { num: "09", short: "Sep", full: "September", index: 8 },
  { num: "10", short: "Okt", full: "Oktober", index: 9 },
  { num: "11", short: "Nov", full: "November", index: 10 },
  { num: "12", short: "Des", full: "Desember", index: 11 },
];

export interface CustomMonthPickerProps {
  // Mode 1: String "YYYY-MM"
  value?: string;
  onChange?: (value: string) => void;

  // Mode 2: Numeric month (0-11 or -1 for "Semua Bulan") & year (e.g. 2026)
  month?: number;
  year?: number;
  onMonthYearChange?: (month: number, year: number) => void;
  allowAllMonths?: boolean;

  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  allowClear?: boolean;
  disabled?: boolean;
}

interface PopoverPosition {
  top: number;
  bottom: number;
  left: number;
  width: number;
  placement: "bottom" | "top";
}

export const CustomMonthPicker: React.FC<CustomMonthPickerProps> = ({
  value,
  onChange,
  month,
  year,
  onMonthYearChange,
  allowAllMonths = false,
  placeholder = "Pilih Bulan & Tahun",
  className = "",
  buttonClassName = "",
  align = "left",
  allowClear = true,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isNumericMode = typeof month === "number" && typeof year === "number";

  const now = new Date();
  const currentActualYear = now.getFullYear();
  const currentActualMonthIndex = now.getMonth();
  const currentActualMonthNum = String(currentActualMonthIndex + 1).padStart(2, "0");
  const currentActualPeriod = `${currentActualYear}-${currentActualMonthNum}`;

  const parsedValue = useMemo(() => {
    if (isNumericMode) {
      if (month === -1) {
        return {
          year: year!,
          monthNum: "",
          monthIndex: -1,
          monthLabel: "Semua Bulan",
          monthShort: "Semua",
          isAllMonths: true,
        };
      }
      const mObj = MONTH_NAMES_ID[month!];
      return {
        year: year!,
        monthNum: mObj?.num || "",
        monthIndex: month!,
        monthLabel: mObj?.full || "",
        monthShort: mObj?.short || "",
        isAllMonths: false,
      };
    }

    if (!value || !value.includes("-")) return null;
    const [y, m] = value.split("-");
    const monthNum = parseInt(m, 10);
    const monthObj = MONTH_NAMES_ID.find((item) => parseInt(item.num, 10) === monthNum);
    return {
      year: parseInt(y, 10),
      monthNum: m,
      monthIndex: monthNum - 1,
      monthLabel: monthObj ? monthObj.full : m,
      monthShort: monthObj ? monthObj.short : m,
      isAllMonths: false,
    };
  }, [isNumericMode, month, year, value]);

  const [viewYear, setViewYear] = useState<number>(
    parsedValue ? parsedValue.year : currentActualYear
  );

  useEffect(() => {
    if (isNumericMode && year) {
      setViewYear(year);
    } else if (parsedValue?.year) {
      setViewYear(parsedValue.year);
    }
  }, [isNumericMode, year, parsedValue?.year]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 8;
    const gap = 8;

    const preferredW = viewportW >= 640 ? 320 : 288;
    const width = Math.min(preferredW, viewportW - margin * 2);

    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.max(margin, Math.min(left, viewportW - width - margin));

    const spaceBelow = Math.max(0, viewportH - rect.bottom - gap - margin);
    const spaceAbove = Math.max(0, rect.top - gap - margin);
    const estimatedHeight = allowAllMonths ? 360 : 320;
    const placement: "bottom" | "top" =
      spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? "top" : "bottom";

    setPopoverPos({
      top: rect.bottom + gap,
      bottom: viewportH - rect.top + gap,
      left,
      width,
      placement,
    });
  }, [align, allowAllMonths]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
        return;
      }
      updatePosition();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectMonth = (monthIndex: number, monthNum: string) => {
    if (isNumericMode && onMonthYearChange) {
      onMonthYearChange(monthIndex, viewYear);
    } else if (onChange) {
      const selected = `${viewYear}-${monthNum}`;
      onChange(selected);
    }
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleSelectAllMonths = () => {
    if (isNumericMode && onMonthYearChange) {
      onMonthYearChange(-1, viewYear);
    }
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleSelectThisMonth = () => {
    setViewYear(currentActualYear);
    if (isNumericMode && onMonthYearChange) {
      onMonthYearChange(currentActualMonthIndex, currentActualYear);
    } else if (onChange) {
      onChange(currentActualPeriod);
    }
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isNumericMode && onMonthYearChange) {
      onMonthYearChange(-1, currentActualYear);
    } else if (onChange) {
      onChange("");
    }
    setIsOpen(false);
  };

  const triggerLabel = useMemo(() => {
    if (isNumericMode) {
      if (month === -1) {
        return `Semua Bulan ${year}`;
      }
      return `${MONTH_NAMES_ID[month!]?.full || ""} ${year}`;
    }
    return parsedValue ? `${parsedValue.monthLabel} ${parsedValue.year}` : placeholder;
  }, [isNumericMode, month, year, parsedValue, placeholder]);

  const isFullWidth = /\bw-full\b/.test(className) || /\bw-full\b/.test(buttonClassName);
  const hasCustomBg = /\bbg-[^\s]+/.test(buttonClassName);
  const hasCustomBorder =
    /\bborder(-[^\s]+)?\b/.test(buttonClassName) && !/\bborder-none\b/.test(buttonClassName);
  const hasCustomRounded = /\brounded(-[^\s]+)?\b/.test(buttonClassName);
  const hasCustomPadding = /\bp[xy]?-[^\s]+/.test(buttonClassName);

  const wrapperClasses = `${isFullWidth ? "relative block w-full" : "relative inline-block"} ${className}`;

  const triggerClasses = [
    "flex items-center justify-between gap-2.5 text-left transition-all cursor-pointer select-none focus:outline-none",
    isFullWidth ? "w-full" : "",
    hasCustomPadding ? "" : "px-3.5 py-2",
    hasCustomRounded ? "" : "rounded-2xl",
    hasCustomBg ? "" : "bg-white hover:bg-slate-50/50",
    hasCustomBorder
      ? ""
      : isOpen
      ? "border border-brand-500 shadow-xs"
      : "border border-slate-200/90 hover:border-slate-300 shadow-2xs",
    isOpen ? "ring-2 ring-brand-500/15" : "",
    disabled ? "opacity-55 cursor-not-allowed bg-slate-100" : "",
    buttonClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const portalPopover =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {isOpen && popoverPos && (
              <motion.div
                ref={menuRef}
                initial={{
                  opacity: 0,
                  y: popoverPos.placement === "bottom" ? 8 : -8,
                  scale: 0.96,
                }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: popoverPos.placement === "bottom" ? 6 : -6,
                  scale: 0.96,
                }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  left: popoverPos.left,
                  width: popoverPos.width,
                  ...(popoverPos.placement === "bottom"
                    ? { top: popoverPos.top }
                    : { bottom: popoverPos.bottom }),
                }}
                className="z-[9999] bg-white rounded-3xl border border-slate-200/95 shadow-xl p-4.5 space-y-3.5"
              >
                {/* Header: Tahun & Navigasi */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setViewYear((prev) => prev - 1)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                    title="Tahun Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 tracking-tight">
                      Tahun {viewYear}
                    </span>
                    {viewYear === currentActualYear && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-200/70">
                        Sekarang
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewYear((prev) => prev + 1)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                    title="Tahun Berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Opsi "Semua Bulan (Sepanjang Tahun)" jika allowAllMonths diaktifkan */}
                {allowAllMonths && (
                  <button
                    type="button"
                    onClick={handleSelectAllMonths}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                      isNumericMode && month === -1 && viewYear === year
                        ? "bg-brand-600 text-white font-bold shadow-xs shadow-brand-500/25"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Semua Bulan (Sepanjang Tahun {viewYear})</span>
                    </span>
                    {isNumericMode && month === -1 && viewYear === year && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>
                )}

                {/* Grid 12 Bulan */}
                <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                  {MONTH_NAMES_ID.map((m) => {
                    const isSelected = isNumericMode
                      ? year === viewYear && month === m.index
                      : parsedValue?.year === viewYear && parsedValue?.monthNum === m.num;

                    const isCurrentMonth =
                      viewYear === currentActualYear && m.num === currentActualMonthNum;

                    return (
                      <button
                        key={m.num}
                        type="button"
                        onClick={() => handleSelectMonth(m.index, m.num)}
                        className={`relative py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? "bg-brand-600 text-white font-bold shadow-xs shadow-brand-500/25 scale-[1.02]"
                            : isCurrentMonth
                            ? "bg-brand-50 text-brand-700 font-bold border border-brand-200/80 hover:bg-brand-100"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <span>{m.short}</span>
                        <span
                          className={`text-[10px] leading-none ${
                            isSelected ? "text-brand-100" : "text-slate-400"
                          }`}
                        >
                          {m.num}
                        </span>
                        {isSelected && (
                          <span className="absolute top-1 right-1">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Quick Actions Footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectThisMonth}
                    className="text-brand-600 hover:text-brand-700 font-bold text-xs py-1 px-2 rounded-lg hover:bg-brand-50 transition-colors cursor-pointer"
                  >
                    Bulan Ini
                  </button>

                  {allowClear && (isNumericMode ? month !== -1 : Boolean(value)) && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-slate-500 hover:text-rose-600 font-medium text-xs py-1 px-2 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>{isNumericMode ? "Reset" : "Hapus"}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <div className={wrapperClasses} ref={containerRef}>
      {/* ── TRIGGER BUTTON ── */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={triggerClasses}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800 tracking-tight whitespace-nowrap truncate">
            {triggerLabel}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-brand-600" : ""
          }`}
        />
      </button>

      {portalPopover}
    </div>
  );
};
export default CustomMonthPicker;
