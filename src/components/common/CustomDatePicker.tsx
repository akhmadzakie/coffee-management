import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, X, Check } from "lucide-react";
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Handle outside click to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
    }[] = [];

    // 1. Previous month padding days
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

    // 2. Current month days
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

    // 3. Next month filler days (fill up to 35 or 42 cells)
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
  };

  const handleSelectToday = () => {
    onChange(todayStr);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
  };

  const handleSelectYesterday = () => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = getLocalDateString(yest);
    onChange(yestStr);
    setViewYear(yest.getFullYear());
    setViewMonth(yest.getMonth());
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const currentMonthLabel = MONTH_NAMES_ID[viewMonth]?.full || "";

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* ── TRIGGER BUTTON ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white border text-left transition-all cursor-pointer select-none ${
          isOpen
            ? "border-brand-500 ring-2 ring-brand-500/15 shadow-xs"
            : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-slate-100" : ""} ${buttonClassName}`}
      >
        <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
        <span className="text-xs font-bold text-slate-800 tracking-tight whitespace-nowrap">
          {labelPrefix ? `${labelPrefix}: ` : ""}
          {parsedValue ? parsedValue.formatted : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-brand-600" : ""
          }`}
        />
      </button>

      {/* ── DROPDOWN CALENDAR POPOVER ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute z-50 mt-2 w-72 sm:w-80 bg-white rounded-3xl border border-slate-200/90 shadow-xl p-4.5 space-y-3.5 ${
              align === "right" ? "right-0" : "left-0"
            }`}
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
      </AnimatePresence>
    </div>
  );
};
export default CustomDatePicker;
