import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MONTH_NAMES_ID } from "./CustomMonthPicker";
import { getLocalDateString } from "../../utils/dateUtils";

const WEEKDAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export interface CustomDatePickerProps {
  value: string; // Format "YYYY-MM-DD", e.g. "2026-10-22", or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  allowClear?: boolean;
  disabled?: boolean;
  labelPrefix?: string;
  required?: boolean;
  name?: string;
}

interface PopoverPosition {
  top: number;
  bottom: number;
  left: number;
  width: number;
  placement: "bottom" | "top";
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  placeholder = "Pilih Tanggal",
  className = "",
  buttonClassName = "",
  align = "left",
  allowClear = true,
  disabled = false,
  labelPrefix,
  required = false,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Current real date
  const now = new Date();
  const todayStr = getLocalDateString(now);

  // Parse current selected value
  const parsedValue = useMemo(() => {
    if (!value || !value.includes("-")) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    const dateObj = new Date(y, m - 1, d);
    const monthObj = MONTH_NAMES_ID[m - 1];
    return {
      year: y,
      month: m,
      day: d,
      dateObj,
      formatted: `${d} ${monthObj ? monthObj.short : m} ${y}`,
      fullFormatted: `${d} ${monthObj ? monthObj.full : m} ${y}`,
    };
  }, [value]);

  // Calendar View State (Year & Month being viewed)
  const [viewYear, setViewYear] = useState<number>(
    parsedValue ? parsedValue.year : now.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    parsedValue ? parsedValue.month - 1 : now.getMonth() // 0-indexed
  );

  // Sync view when value changes
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month - 1);
    }
  }, [parsedValue?.year, parsedValue?.month]);

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
    const estimatedHeight = 350;
    const placement: "bottom" | "top" =
      spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? "top" : "bottom";

    setPopoverPos({
      top: rect.bottom + gap,
      bottom: viewportH - rect.top + gap,
      left,
      width,
      placement,
    });
  }, [align]);

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

  // Handle outside click & Escape key to close
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

  // Navigate Months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Generate Calendar Matrix
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
    }[] = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevMonthNum = viewMonth === 0 ? 12 : viewMonth;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        day,
        dateStr,
        isCurrentMonth: false,
        isSelected: value === dateStr,
        isToday: todayStr === dateStr,
      });
    }

    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        day: d,
        dateStr,
        isCurrentMonth: true,
        isSelected: value === dateStr,
        isToday: todayStr === dateStr,
      });
    }

    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthNum = viewMonth === 11 ? 1 : viewMonth + 2;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextYear}-${String(nextMonthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        day: d,
        dateStr,
        isCurrentMonth: false,
        isSelected: value === dateStr,
        isToday: todayStr === dateStr,
      });
    }

    return cells;
  }, [viewYear, viewMonth, value, todayStr]);

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleSelectToday = () => {
    onChange(todayStr);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleSelectYesterday = () => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = getLocalDateString(yest);
    onChange(yestStr);
    setViewYear(yest.getFullYear());
    setViewMonth(yest.getMonth());
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const currentMonthLabel = MONTH_NAMES_ID[viewMonth]?.full || "";

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
                {/* Header: Bulan, Tahun & Navigasi */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                    title="Bulan Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 tracking-tight">
                      {currentMonthLabel} {viewYear}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                    title="Bulan Berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Nama Hari (Min, Sen, Sel, ...) */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS_ID.map((dayName, idx) => (
                    <div
                      key={dayName}
                      className={`text-[11px] font-bold py-1 ${
                        idx === 0 ? "text-rose-500" : "text-slate-400"
                      }`}
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Grid Tanggal */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell, idx) => (
                    <button
                      key={`${cell.dateStr}-${idx}`}
                      type="button"
                      onClick={() => handleSelectDate(cell.dateStr)}
                      className={`h-8 sm:h-9 w-full rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer relative ${
                        cell.isSelected
                          ? "bg-brand-600 text-white font-bold shadow-xs shadow-brand-500/25 scale-[1.05]"
                          : cell.isToday
                          ? "bg-brand-50 text-brand-700 font-bold border border-brand-200 hover:bg-brand-100"
                          : !cell.isCurrentMonth
                          ? "text-slate-300 hover:bg-slate-50"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {cell.day}
                      {cell.isToday && !cell.isSelected && (
                        <span className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-600" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Quick Actions Footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleSelectToday}
                      className="text-brand-600 hover:text-brand-700 font-bold text-xs py-1 px-2 rounded-lg hover:bg-brand-50 transition-colors cursor-pointer"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectYesterday}
                      className="text-slate-600 hover:text-slate-800 font-semibold text-xs py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Kemarin
                    </button>
                  </div>

                  {allowClear && value && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-slate-500 hover:text-rose-600 font-medium text-xs py-1 px-2 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Hapus</span>
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
      {(name || required) && (
        <input
          type="text"
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
        />
      )}

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
            {labelPrefix ? `${labelPrefix}: ` : ""}
            {parsedValue ? parsedValue.formatted : placeholder}
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
export default CustomDatePicker;
