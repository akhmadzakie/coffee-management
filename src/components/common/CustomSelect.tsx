import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface CustomSelectOption {
  value: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
  group?: string;
  disabled?: boolean;
  description?: string;
}

export interface CustomSelectProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  labelPrefix?: string;
  required?: boolean;
  name?: string;
  title?: string;
  ariaLabel?: string;
}

interface MenuPosition {
  top: number;
  bottom: number;
  left: number;
  width: number;
  maxListHeight: number;
  placement: "bottom" | "top";
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  defaultValue,
  onChange,
  options,
  placeholder = "Pilih salah satu...",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  align = "left",
  disabled = false,
  searchable,
  searchPlaceholder = "Cari pilihan...",
  icon,
  labelPrefix,
  required = false,
  name,
  title,
  ariaLabel,
}) => {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string>(defaultValue ?? "");
  const currentValue = isControlled ? (value ?? "") : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-enable search if options >= 7 and not explicitly disabled
  const isSearchable = searchable ?? options.length >= 7;

  // Selected option metadata
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === currentValue);
  }, [options, currentValue]);

  // Filtered options based on search query (label, group, description)
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.trim().toLowerCase();
    return options.filter((opt) => {
      const inLabel = opt.label.toLowerCase().includes(q);
      const inGroup = opt.group ? opt.group.toLowerCase().includes(q) : false;
      const inDesc = opt.description ? opt.description.toLowerCase().includes(q) : false;
      return inLabel || inGroup || inDesc;
    });
  }, [options, searchQuery]);

  // Enabled options for keyboard navigation
  const enabledOptions = useMemo(() => {
    return filteredOptions.filter((opt) => !opt.disabled);
  }, [filteredOptions]);

  // Group filtered options while preserving insertion order
  const groupedSections = useMemo(() => {
    const sections: {
      groupName: string | null;
      items: CustomSelectOption[];
    }[] = [];
    const groupMap = new Map<string, { groupName: string | null; items: CustomSelectOption[] }>();
    let ungroupedSection: { groupName: string | null; items: CustomSelectOption[] } | null = null;

    for (const opt of filteredOptions) {
      if (!opt.group) {
        if (!ungroupedSection) {
          ungroupedSection = { groupName: null, items: [] };
          sections.push(ungroupedSection);
        }
        ungroupedSection.items.push(opt);
      } else {
        let groupSection = groupMap.get(opt.group);
        if (!groupSection) {
          groupSection = { groupName: opt.group, items: [] };
          groupMap.set(opt.group, groupSection);
          sections.push(groupSection);
        }
        groupSection.items.push(opt);
      }
    }

    return sections;
  }, [filteredOptions]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 8;
    const gap = 6;

    const minUsefulWidth = Math.min(220, viewportW - margin * 2);
    const width = Math.min(Math.max(rect.width, minUsefulWidth), viewportW - margin * 2);

    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.max(margin, Math.min(left, viewportW - width - margin));

    const spaceBelow = Math.max(0, viewportH - rect.bottom - gap - margin);
    const spaceAbove = Math.max(0, rect.top - gap - margin);
    const estimatedMenuHeight = Math.min(
      320,
      (isSearchable ? 48 : 0) + Math.max(filteredOptions.length, 1) * 34 + 16
    );

    const placement: "bottom" | "top" =
      spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? "top" : "bottom";
    const availableSpace = placement === "bottom" ? spaceBelow : spaceAbove;
    const maxMenuHeight = Math.max(150, Math.min(310, availableSpace));
    const maxListHeight = Math.max(100, maxMenuHeight - (isSearchable ? 48 : 12));

    setMenuPos({
      top: rect.bottom + gap,
      bottom: viewportH - rect.top + gap,
      left,
      width,
      maxListHeight,
      placement,
    });
  }, [align, isSearchable, filteredOptions.length]);

  // Recalculate position on open and viewport changes
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

  // Click outside (checks both trigger wrapper and portal menu)
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inTrigger = containerRef.current?.contains(target);
      const inMenu = menuRef.current?.contains(target);
      if (!inTrigger && !inMenu) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus search input and set initial keyboard highlight when menu opens
  useEffect(() => {
    if (isOpen) {
      const activeIdx = enabledOptions.findIndex((o) => o.value === currentValue);
      setHighlightedIndex(activeIdx >= 0 ? activeIdx : enabledOptions.length > 0 ? 0 : -1);
      if (isSearchable) {
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 30);
        return () => clearTimeout(timer);
      }
    } else {
      setSearchQuery("");
      setHighlightedIndex(-1);
    }
  }, [isOpen, isSearchable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset highlight index cleanly when filtered list changes
  useEffect(() => {
    if (!isOpen) return;
    const activeIdx = enabledOptions.findIndex((o) => o.value === currentValue);
    setHighlightedIndex(activeIdx >= 0 ? activeIdx : enabledOptions.length > 0 ? 0 : -1);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(
    (val: string) => {
      if (!isControlled) {
        setInternalValue(val);
      }
      onChange?.(val);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [isControlled, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (enabledOptions.length === 0) return;
      setHighlightedIndex((prev) => (prev + 1) % enabledOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (enabledOptions.length === 0) return;
      setHighlightedIndex((prev) => (prev - 1 + enabledOptions.length) % enabledOptions.length);
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && enabledOptions[highlightedIndex]) {
        e.preventDefault();
        handleSelect(enabledOptions[highlightedIndex].value);
      }
    }
  };

  // Smart Tailwind class merging so custom badge/pill colors & widths aren't overridden
  const isFullWidth = /\bw-full\b/.test(className) || /\bw-full\b/.test(buttonClassName);
  const hasCustomBg = /\bbg-[^\s]+/.test(buttonClassName);
  const hasCustomBorder =
    /\bborder(-[^\s]+)?\b/.test(buttonClassName) && !/\bborder-none\b/.test(buttonClassName);
  const hasCustomRounded = /\brounded(-[^\s]+)?\b/.test(buttonClassName);
  const hasCustomPadding = /\bp[xy]?-[^\s]+/.test(buttonClassName);
  const hasCustomTextSize = /\btext-(xs|sm|base|lg|\[)/.test(buttonClassName);
  const hasCustomTextColor =
    /\btext-(slate|gray|zinc|neutral|stone|red|rose|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|brand|white|black)-[0-9]+/.test(
      buttonClassName
    ) || /\btext-(white|black)\b/.test(buttonClassName);

  const wrapperClasses = `${isFullWidth ? "relative block w-full" : "relative inline-block"} ${className}`;

  const triggerClasses = [
    "flex items-center justify-between gap-2 text-left transition-all cursor-pointer select-none focus:outline-none",
    isFullWidth ? "w-full" : "",
    hasCustomPadding ? "" : "px-3 py-1.5",
    hasCustomRounded ? "" : "rounded-xl",
    hasCustomTextSize ? "" : "text-xs",
    hasCustomBg ? "" : "bg-white hover:bg-slate-50/50",
    hasCustomBorder
      ? ""
      : isOpen
      ? "border border-brand-500 shadow-xs"
      : "border border-slate-200/90 hover:border-slate-300 shadow-2xs",
    isOpen ? "ring-2 ring-brand-500/15" : "",
    disabled ? "opacity-55 cursor-not-allowed" : "",
    buttonClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const portalMenu =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {isOpen && menuPos && (
              <motion.div
                ref={menuRef}
                role="listbox"
                onKeyDown={handleKeyDown}
                initial={{
                  opacity: 0,
                  y: menuPos.placement === "bottom" ? 6 : -6,
                  scale: 0.98,
                }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: menuPos.placement === "bottom" ? 4 : -4,
                  scale: 0.98,
                }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  left: menuPos.left,
                  width: menuPos.width,
                  ...(menuPos.placement === "bottom"
                    ? { top: menuPos.top }
                    : { bottom: menuPos.bottom }),
                }}
                className={`z-[9999] bg-white rounded-2xl border border-slate-200/95 shadow-xl p-1.5 space-y-1 ${menuClassName}`}
              >
                {/* Search Input */}
                {isSearchable && (
                  <div className="p-1 border-b border-slate-100 mb-0.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white text-slate-800"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          aria-label="Hapus pencarian"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Options List */}
                <div
                  style={{ maxHeight: menuPos.maxListHeight }}
                  className="overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar"
                >
                  {filteredOptions.length === 0 ? (
                    <div className="py-4 px-2 text-center text-xs text-slate-400">
                      Tidak ditemukan pilihan
                    </div>
                  ) : (
                    groupedSections.map((section, sectionIdx) => (
                      <div key={section.groupName ?? `ungrouped-${sectionIdx}`} className="space-y-0.5">
                        {section.groupName && (
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 pt-2 pb-1 select-none">
                            {section.groupName}
                          </div>
                        )}
                        {section.items.map((opt, itemIdx) => {
                          const isSelected = opt.value === currentValue;
                          const isHighlighted =
                            !opt.disabled &&
                            highlightedIndex >= 0 &&
                            enabledOptions[highlightedIndex] === opt;

                          return (
                            <button
                              key={`${opt.group ?? ""}:${opt.value}:${itemIdx}`}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              disabled={opt.disabled}
                              onMouseEnter={() => {
                                if (!opt.disabled) {
                                  const idx = enabledOptions.indexOf(opt);
                                  if (idx >= 0) setHighlightedIndex(idx);
                                }
                              }}
                              onClick={() => {
                                if (!opt.disabled) {
                                  handleSelect(opt.value);
                                }
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-all text-left border ${
                                opt.disabled
                                  ? "opacity-50 cursor-not-allowed text-slate-400 border-transparent"
                                  : isSelected
                                  ? "bg-brand-50 text-brand-700 font-bold border-brand-200/70 shadow-2xs cursor-pointer"
                                  : isHighlighted
                                  ? "bg-slate-100 text-slate-900 font-semibold border-transparent cursor-pointer"
                                  : "text-slate-700 font-semibold hover:bg-slate-100 hover:text-slate-900 border-transparent cursor-pointer"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                                <div className="min-w-0 flex-1">
                                  <div className="truncate">{opt.label}</div>
                                  {opt.description && (
                                    <div className="text-[10px] font-normal text-slate-400 truncate">
                                      {opt.description}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {opt.badge !== undefined && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                      isSelected
                                        ? "bg-brand-200/60 text-brand-800"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {opt.badge}
                                  </span>
                                )}
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))
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
          value={currentValue}
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
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={triggerClasses}
      >
        <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
          {icon && <span className="text-slate-500 shrink-0">{icon}</span>}
          {labelPrefix && (
            <span className="text-slate-500 font-medium whitespace-nowrap">
              {labelPrefix}:
            </span>
          )}
          <span
            className={`font-semibold truncate ${
              hasCustomTextColor
                ? ""
                : selectedOption
                ? "text-slate-800"
                : "text-slate-400"
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge !== undefined && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-brand-600" : ""
          }`}
        />
      </button>

      {portalMenu}
    </div>
  );
};

export default CustomSelect;
