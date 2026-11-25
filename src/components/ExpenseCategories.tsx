import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
import { ExpenseCategory, ExpenseCategoryType } from "../types";
import { CustomSelect } from "./common/CustomSelect";
import {
  filterExpenseCategoryTree,
  parseImportedExpenseCategories,
} from "../utils/syncSanitizers";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  Tag,
  TrendingUp,
  TrendingDown,
  Package,
  Zap,
  Users,
  Briefcase,
  MoreHorizontal,
  Save,
  X,
  Coffee,
  Home,
  Shield,
  Gift,
  BookOpen,
  Wallet,
  Flame,
  Wifi,
  Droplets,
  ShoppingCart,
  Box,
  Settings,
  FolderTree,
  Layers,
  GitBranch,
  CheckCircle2,
  Search,
  Filter,
  ChevronsUpDown,
  RotateCcw,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CsvImportExport } from "./common/CsvImportExport";
import { ConfirmModal } from "./common/ConfirmModal";
import { isCoreExpenseCategory } from "../utils/systemGuards";
import { Lock } from "lucide-react";

// ─── Icon Map ───────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.FC<any>> = {
  tag: Tag,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  package: Package,
  zap: Zap,
  users: Users,
  briefcase: Briefcase,
  "more-horizontal": MoreHorizontal,
  coffee: Coffee,
  home: Home,
  shield: Shield,
  gift: Gift,
  "book-open": BookOpen,
  wallet: Wallet,
  flame: Flame,
  wifi: Wifi,
  droplets: Droplets,
  "shopping-cart": ShoppingCart,
  box: Box,
  settings: Settings,
  utensils: Coffee,
  "plus-circle": Plus,
  megaphone: Tag,
  "cup-soda": Coffee,
  "trash-2": Trash2,
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

const CATEGORY_TYPES: { value: ExpenseCategoryType; label: string; description: string }[] = [
  { value: "PENDAPATAN", label: "Pendapatan", description: "Penjualan menu, omzet kasir, & pemasukan lain" },
  { value: "PENGELUARAN", label: "Pengeluaran", description: "Biaya sewa, kebersihan, marketing, & operasional" },
  { value: "BAHAN_BAKU", label: "Bahan Baku", description: "Pembelian kopi, susu, sirup, & inventori HPP" },
  { value: "UTILITAS", label: "Utilitas", description: "Listrik PLN, air PAM, WiFi internet, gas LPG" },
  { value: "HRD", label: "HRD & Tim", description: "Gaji staf, bonus barista, lembur, & seragam" },
  { value: "ASET", label: "Aset / Inventaris", description: "Mesin espresso, grinder, renovasi, & peralatan" },
  { value: "LAINNYA", label: "Lainnya", description: "Biaya administrasi bank, pajak, & pos rupa-rupa" },
];

const PRESET_COLORS = [
  "#1b2cc0", "#059669", "#0284c7", "#1624a0", "#8b5cf6",
  "#6d28d9", "#d97706", "#f59e0b", "#e11d48", "#dc2626",
  "#db2777", "#0d9488", "#ea580c", "#0891b2", "#64748b",
];

const TYPE_CONFIG: Record<
  ExpenseCategoryType,
  { label: string; badgeClass: string; borderClass: string; icon: any }
> = {
  PENDAPATAN: {
    label: "Pendapatan",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    borderClass: "border-l-emerald-500",
    icon: TrendingUp,
  },
  PENGELUARAN: {
    label: "Pengeluaran",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
    borderClass: "border-l-rose-500",
    icon: TrendingDown,
  },
  BAHAN_BAKU: {
    label: "Bahan Baku",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    borderClass: "border-l-amber-500",
    icon: Package,
  },
  UTILITAS: {
    label: "Utilitas",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
    borderClass: "border-l-sky-500",
    icon: Zap,
  },
  HRD: {
    label: "HRD",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
    borderClass: "border-l-violet-500",
    icon: Users,
  },
  ASET: {
    label: "Aset",
    badgeClass: "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30",
    borderClass: "border-l-brand-500",
    icon: Box,
  },
  LAINNYA: {
    label: "Lainnya",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    borderClass: "border-l-slate-400",
    icon: Tag,
  },
};

// ─── Modal Form Component ────────────────────────────────────────────────────
interface CategoryModalFormProps {
  isOpen: boolean;
  initial?: Partial<ExpenseCategory> | null;
  defaultParent?: ExpenseCategory | null;
  categories: ExpenseCategory[];
  onSave: (data: Omit<ExpenseCategory, "id" | "children">) => void;
  onClose: () => void;
}

const CategoryModalForm: React.FC<CategoryModalFormProps> = ({
  isOpen,
  initial,
  defaultParent,
  categories,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ExpenseCategoryType>(
    initial?.type ?? defaultParent?.type ?? "PENGELUARAN",
  );
  const [parentId, setParentId] = useState<string | null>(
    initial?.parentId ?? defaultParent?.id ?? null,
  );
  const [color, setColor] = useState(
    initial?.color ?? defaultParent?.color ?? "#1b2cc0",
  );
  const [icon, setIcon] = useState(initial?.icon ?? "tag");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  // Sync state if initial or defaultParent changes
  React.useEffect(() => {
    if (isOpen) {
      setName(initial?.name ?? "");
      setType(initial?.type ?? defaultParent?.type ?? "PENGELUARAN");
      setParentId(initial?.parentId ?? defaultParent?.id ?? null);
      setColor(initial?.color ?? defaultParent?.color ?? "#1b2cc0");
      setIcon(initial?.icon ?? "tag");
      setIsActive(initial?.isActive ?? true);
    }
  }, [isOpen, initial, defaultParent]);

  if (typeof document === "undefined") return null;

  const isCoreSystem = isCoreExpenseCategory(initial?.id);
  const hasExistingChildren = Boolean(
    initial?.id && categories.some((c) => c.parentId === initial.id),
  );

  const rootCategories = categories.filter(
    (c) => !c.parentId && c.id !== initial?.id,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      type: isCoreSystem && initial?.type ? initial.type : type,
      parentId: isCoreSystem
        ? (initial?.parentId ?? null)
        : (hasExistingChildren ? null : parentId),
      color,
      icon,
      isActive,
      sortOrder: initial?.sortOrder ?? 0,
    });
  };

  const IconComp = ICON_MAP[icon] ?? Tag;
  const currentConfig = TYPE_CONFIG[type] || TYPE_CONFIG.LAINNYA;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="category-form-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs"
                  style={{
                    backgroundColor: `${color}18`,
                    border: `1.5px solid ${color}40`,
                  }}
                >
                  <IconComp className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {initial?.id ? "Edit Kategori" : "Tambah Kategori"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {parentId && !hasExistingChildren
                      ? `Sub-kategori di bawah "${categories.find((c) => c.id === parentId)?.name || "Induk"}"`
                      : "Kategori utama dalam bagan akun kafe"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Tutup modal kategori"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {isCoreSystem && (
                <div className="p-3 rounded-2xl bg-brand-50/80 dark:bg-brand-500/15 border border-brand-200/80 dark:border-brand-500/30 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium text-brand-900 dark:text-brand-200 leading-relaxed">
                    <strong>Kategori bawaan sistem:</strong> Anda bebas mengubah Nama, Warna, dan Ikon. Tipe Akun &amp; Kategori Induk dikunci agar laporan Laba Rugi, HPP, dan Kas tetap akurat.
                  </p>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nama Pos Kategori *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Kopi & Espresso / Sewa Tempat"
                  className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-2xs"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Tipe Akun
                  </label>
                  <CustomSelect
                    value={type}
                    onChange={(val) => setType(val as ExpenseCategoryType)}
                    disabled={isCoreSystem}
                    options={CATEGORY_TYPES.map((t) => ({
                      value: t.value,
                      label: t.label,
                    }))}
                    buttonClassName="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 shadow-2xs"
                  />
                </div>

                {/* Parent Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Kategori Induk (Grup)
                  </label>
                  <CustomSelect
                    value={hasExistingChildren ? "" : (parentId ?? "")}
                    onChange={(val) => setParentId(val || null)}
                    disabled={isCoreSystem || hasExistingChildren}
                    options={[
                      { value: "", label: "— Pos Utama (Header / Root) —" },
                      ...rootCategories.map((c) => ({
                        value: c.id,
                        label: c.name,
                      })),
                    ]}
                    buttonClassName="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 shadow-2xs"
                  />
                  {hasExistingChildren && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 font-medium">
                      Pos induk dengan sub-kategori aktif tetap menjadi Header agar struktur tidak terputus.
                    </p>
                  )}
                </div>
              </div>

              {/* Color Palette */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                  Warna Penanda
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-xl transition-all cursor-pointer ${
                        color === c
                          ? "scale-110 ring-2 ring-brand-600 dark:ring-brand-300 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-xs"
                          : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                      title={`Warna ${c}`}
                    />
                  ))}
                  <div className="relative flex items-center">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 rounded-xl cursor-pointer border-0 bg-transparent"
                      title="Pilih Warna Kustom"
                    />
                  </div>
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                  Pilih Ikon Simbol
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 p-2 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto no-scrollbar">
                  {AVAILABLE_ICONS.map((ic) => {
                    const Ic = ICON_MAP[ic] || Tag;
                    const isSelected = icon === ic;
                    return (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setIcon(ic)}
                        className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-brand-600 text-white shadow-xs scale-105"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700"
                        }`}
                        title={ic}
                      >
                        <Ic className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Preview Box */}
              <div className="p-3.5 bg-slate-50/90 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs shrink-0"
                    style={{
                      backgroundColor: `${color}20`,
                      border: `1.5px solid ${color}45`,
                    }}
                  >
                    <IconComp className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {name || "Nama Kategori Anda"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentConfig.badgeClass}`}
                      >
                        {currentConfig.label}
                      </span>
                      {parentId && !hasExistingChildren && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          • Sub-kategori
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active Toggle Switch */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isActive ? "Aktif" : "Nonaktif"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => setIsActive(!isActive)}
                    className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${
                      isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  >
                    <span
                      className={`block absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-2xs transition-transform ${
                        isActive ? "translate-x-4.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm shadow-brand-600/20 transition-all cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Kategori</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ─── Tree Node Component (Modern Accordion Row) ─────────────────────────────
interface TreeNodeProps {
  category: ExpenseCategory;
  isReadOnly?: boolean;
  onEdit: (c: ExpenseCategory) => void;
  onDelete: (c: ExpenseCategory) => void;
  onAddChild: (parent: ExpenseCategory) => void;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  category,
  isReadOnly = false,
  onEdit,
  onDelete,
  onAddChild,
  isExpanded,
  onToggleExpand,
}) => {
  const hasChildren = (category.children?.length ?? 0) > 0;
  const IconComp = ICON_MAP[category.icon] ?? Tag;
  const config = TYPE_CONFIG[category.type] || TYPE_CONFIG.LAINNYA;
  const isCore = isCoreExpenseCategory(category.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm hover:shadow-coffee transition-all overflow-hidden"
    >
      {/* Root Category Bar */}
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
        <div className="flex items-center gap-3 min-w-0">
          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => onToggleExpand(category.id)}
            disabled={!hasChildren}
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
              hasChildren
                ? "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                : "text-slate-200 dark:text-slate-700 cursor-default"
            }`}
            title={hasChildren ? (isExpanded ? "Ciutkan sub-pos" : "Buka sub-pos") : "Tidak ada sub-pos"}
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-200 ${
                isExpanded && hasChildren ? "rotate-90 text-brand-600 dark:text-brand-300" : ""
              }`}
            />
          </button>

          {/* Color & Icon Badge */}
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs"
            style={{
              backgroundColor: `${category.color}15`,
              border: `1.5px solid ${category.color}35`,
            }}
          >
            <IconComp className="w-5 h-5" style={{ color: category.color }} />
          </div>

          {/* Name & Type Tag */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4
                className={`text-sm font-bold truncate ${
                  category.isActive
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-400 dark:text-slate-500 line-through"
                }`}
              >
                {category.name}
              </h4>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.badgeClass}`}
              >
                {config.label}
              </span>
              {isCore && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-500/30"
                  title="Kategori inti terintegrasi sistem (tidak dapat dihapus, hanya boleh edit nama/warna/ikon)"
                >
                  <Lock className="w-2.5 h-2.5" />
                  Sistem
                </span>
              )}
              {!category.isActive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Nonaktif
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 tabular-nums">
              <span>{hasChildren ? `${category.children!.length} Sub-kategori` : "Pos Utama Tunggal"}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {!isReadOnly && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => onAddChild(category)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 border border-emerald-200/80 dark:border-emerald-500/30 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              title="Tambah Sub-kategori di bawah pos ini"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tambah Sub</span>
            </button>

            <button
              type="button"
              onClick={() => onEdit(category)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/15 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs"
              title={isCore ? "Edit Nama, Warna, atau Ikon" : "Edit Kategori"}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            {isCore ? (
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    `Kategori "${category.name}" terintegrasi dengan laporan Laba Rugi & HPP sehingga tidak dapat dihapus (hanya boleh diubah nama/warna/ikon).`
                  )
                }
                className="p-2 rounded-xl text-amber-600 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-500/15 border border-amber-200/80 dark:border-amber-500/30 transition-colors cursor-pointer shadow-2xs"
                title="Terkunci sistem (hanya bisa edit nama/warna/ikon)"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onDelete(category)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs"
                title="Hapus Kategori"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Children Sub-Categories List */}
      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-3 sm:p-4 space-y-2 overflow-hidden"
          >
            <div className="border-l-2 border-brand-200/80 dark:border-brand-500/40 ml-3.5 pl-3 sm:pl-4 space-y-2">
              {category.children!.map((child) => {
                const ChildIcon = ICON_MAP[child.icon] ?? Tag;
                const isChildCore = isCoreExpenseCategory(child.id);
                return (
                  <div
                    key={child.id}
                    className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center justify-between gap-3 group/child hover:border-brand-200 dark:hover:border-brand-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${child.color}15`,
                          border: `1px solid ${child.color}35`,
                        }}
                      >
                        <ChildIcon
                          className="w-3.5 h-3.5"
                          style={{ color: child.color }}
                        />
                      </div>
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span
                          className={`text-xs font-semibold truncate block ${
                            child.isActive
                              ? "text-slate-800 dark:text-slate-100"
                              : "text-slate-400 dark:text-slate-500 line-through"
                          }`}
                        >
                          {child.name}
                        </span>
                        {isChildCore && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-500/30 shrink-0"
                            title="Sub-kategori inti terintegrasi sistem"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            Sistem
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sub-item Actions */}
                    {!isReadOnly && (
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/child:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onEdit(child)}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/15 transition-colors cursor-pointer"
                          title={isChildCore ? "Edit Nama, Warna, atau Ikon" : "Edit Sub-kategori"}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {isChildCore ? (
                          <button
                            type="button"
                            onClick={() =>
                              toast.info(
                                `Sub-kategori "${child.name}" terintegrasi dengan sistem keuangan sehingga tidak dapat dihapus (hanya boleh diubah nama/warna/ikon).`
                              )
                            }
                            className="p-1.5 rounded-lg text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/15 transition-colors cursor-pointer"
                            title="Terkunci sistem (hanya bisa edit nama/warna/ikon)"
                          >
                            <Lock className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onDelete(child)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors cursor-pointer"
                            title="Hapus Sub-kategori"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export function ExpenseCategories() {
  const {
    expenseCategories,
    addExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    restoreDefaultExpenseCategories,
    isReadOnly,
  } = useStore();
  const categories: ExpenseCategory[] = expenseCategories ?? [];

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [defaultParent, setDefaultParent] = useState<ExpenseCategory | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<ExpenseCategoryType | "ALL">("ALL");

  // Expanded items state
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Confirm delete modal state
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null);

  const handleRestoreDefaults = () => {
    if (isReadOnly) return;
    const restoredCount = restoreDefaultExpenseCategories ? restoreDefaultExpenseCategories() : 0;
    if (restoredCount > 0) {
      toast.success(`Berhasil memulihkan ${restoredCount} kategori & sub-kategori standar yang sebelumnya terhapus.`);
    } else {
      toast.info("Seluruh kategori & sub-kategori standar sudah lengkap dan aktif.");
    }
  };

  // Build & filter 2-level category hierarchy safely
  const { tree, autoExpandIds } = useMemo(
    () => filterExpenseCategoryTree(categories, search, filterType),
    [categories, search, filterType],
  );

  // Set default expanded on load and auto-expand parents matching child search/filter
  React.useEffect(() => {
    setExpandedIds((prev) => {
      const next: Record<string, boolean> = { ...prev };
      if (Object.keys(prev).length === 0) {
        tree.forEach((t) => {
          next[t.id] = true;
        });
      }
      Object.entries(autoExpandIds).forEach(([id, val]) => {
        if (val) next[id] = true;
      });
      return next;
    });
  }, [categories.length, autoExpandIds]);

  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.isActive).length;
    const roots = categories.filter((c) => !c.parentId).length;
    const subCategories = total - roots;
    return { total, active, roots, subCategories };
  }, [categories]);

  const expandableRoots = useMemo(
    () => tree.filter((t) => (t.children?.length ?? 0) > 0),
    [tree],
  );

  // Expand / Collapse all
  const handleToggleExpandAll = () => {
    if (expandableRoots.length === 0) return;
    const areAllExpanded = expandableRoots.every((t) => expandedIds[t.id]);
    const nextState: Record<string, boolean> = { ...expandedIds };
    expandableRoots.forEach((t) => {
      nextState[t.id] = !areAllExpanded;
    });
    setExpandedIds(nextState);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = (data: Omit<ExpenseCategory, "id" | "children">) => {
    if (isReadOnly) return;
    const dupExists = categories.some(
      (c) =>
        c.id !== editingCategory?.id &&
        (c.parentId || null) === (data.parentId || null) &&
        c.name.trim().toLowerCase() === data.name.trim().toLowerCase(),
    );
    if (dupExists) {
      toast.warning(`Kategori "${data.name}" sudah ada pada grup induk yang sama.`);
      return;
    }

    if (editingCategory) {
      updateExpenseCategory({ ...editingCategory, ...data });
      toast.success(`Kategori "${data.name}" berhasil diperbarui.`);
    } else {
      const newCat: ExpenseCategory = {
        id: `cat-${Date.now()}`,
        ...data,
        parentId: data.parentId,
      };
      addExpenseCategory(newCat);
      if (newCat.parentId) {
        setExpandedIds((prev) => ({ ...prev, [newCat.parentId!]: true }));
      }
      toast.success(`Kategori "${data.name}" berhasil ditambahkan.`);
    }
    setShowFormModal(false);
    setEditingCategory(null);
    setDefaultParent(null);
  };

  const handleEdit = (cat: ExpenseCategory) => {
    if (isReadOnly) return;
    setEditingCategory(cat);
    setDefaultParent(null);
    setShowFormModal(true);
  };

  const handleDeletePrompt = (cat: ExpenseCategory) => {
    if (isReadOnly) return;
    if (isCoreExpenseCategory(cat.id)) {
      toast.warning(
        `Kategori "${cat.name}" terintegrasi dengan sistem keuangan dan tidak dapat dihapus (hanya boleh diubah nama, warna, atau ikonnya).`
      );
      return;
    }
    setCategoryToDelete(cat);
  };

  const handleConfirmDelete = () => {
    if (isReadOnly) return;
    if (categoryToDelete) {
      if (isCoreExpenseCategory(categoryToDelete.id)) {
        toast.warning(
          `Kategori "${categoryToDelete.name}" tidak dapat dihapus karena terintegrasi dengan sistem.`
        );
        setCategoryToDelete(null);
        return;
      }
      deleteExpenseCategory(categoryToDelete.id);
      toast.success(`Kategori "${categoryToDelete.name}" berhasil dihapus.`);
      setCategoryToDelete(null);
    }
  };

  const handleAddChild = (parent: ExpenseCategory) => {
    if (isReadOnly) return;
    setEditingCategory(null);
    setDefaultParent(parent);
    setShowFormModal(true);
  };

  const handleAddRoot = () => {
    if (isReadOnly) return;
    setEditingCategory(null);
    setDefaultParent(null);
    setShowFormModal(true);
  };

  const handleImportCategories = (data: any[]) => {
    if (isReadOnly) return;
    const { toCreate, toUpdate, skipped } = parseImportedExpenseCategories(
      data,
      categories,
      AVAILABLE_ICONS,
    );

    toUpdate.forEach((cat) => updateExpenseCategory(cat));
    toCreate.forEach((cat, idx) => {
      addExpenseCategory({
        id: `cat-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        ...cat,
      });
    });

    if (toCreate.length > 0 || toUpdate.length > 0) {
      toast.success(
        `Berhasil menambahkan ${toCreate.length} pos baru & memperbarui ${toUpdate.length} kategori${skipped > 0 ? ` (${skipped} baris dilewati)` : ""}.`,
      );
    } else {
      toast.warning("Tidak ada data kategori valid atau baru yang diimpor.");
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header Card ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-7 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 uppercase border border-brand-200/70 dark:border-brand-500/30">
              Chart of Accounts • Klasifikasi Keuangan
            </span>
            {isReadOnly && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                <Eye className="w-3 h-3" />
                Mode Pemantauan Owner (Read-Only)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-500/15 border border-brand-100 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300 shadow-2xs shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            Kategori Kas & Biaya
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Kelola bagan pos pendapatan, biaya operasional, utilitas, dan modal kafe untuk otomatisasi Buku Kas & Laba Rugi.
          </p>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
              title="Kembalikan kategori dan sub-kategori bawaan yang tidak sengaja terhapus"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 shrink-0" />
              <span>Pulihkan Kategori Standar</span>
            </button>

            <CsvImportExport
              onImport={handleImportCategories}
              templateHeaders={["Nama Kategori", "Tipe", "Warna", "Icon"]}
              templateExampleRow={["Gaji Karyawan", "HRD", "#8b5cf6", "users"]}
              currentData={categories.map((c) => ({
                id: c.id,
                "Nama Kategori": c.name,
                Tipe: c.type,
                Warna: c.color,
                Icon: c.icon,
              }))}
              templateFilename="template_kategori_keuangan"
              buttonLabel="Impor/Ekspor Excel"
              templateDropdowns={{
                Tipe: CATEGORY_TYPES.map((t) => t.value),
              }}
              templateHints={{
                "Nama Kategori": "Wajib diisi",
                Tipe: "Pilih tipe kategori dari dropdown",
                Warna: "Kode HEX warna, contoh: #8b5cf6",
                Icon: "Nama icon (misal: users, coffee, tag, wallet, package)",
              }}
            />

            <button
              type="button"
              onClick={handleAddRoot}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm shadow-brand-600/20 cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Tambah Kategori</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── 4 Bento KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-gradient-to-br from-slate-50/80 via-white to-white dark:from-slate-800/70 dark:via-slate-900 dark:to-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Pos Kategori
            </p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono tabular-nums">
              {stats.total}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Bagan akun terdaftar</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-2xs shrink-0">
            <FolderTree className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Active Categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="bg-gradient-to-br from-emerald-50/60 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 p-4 sm:p-5 rounded-3xl border border-emerald-200/70 dark:border-emerald-500/30 shadow-coffee-sm flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Kategori Aktif
            </p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-300 mt-1 font-mono tabular-nums">
              {stats.active}
            </p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">Siap di entri kas</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-100 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shadow-2xs shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Root Categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="bg-gradient-to-br from-brand-50/60 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 p-4 sm:p-5 rounded-3xl border border-brand-200/70 dark:border-brand-500/30 shadow-coffee-sm flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">
              Kategori Utama (Header)
            </p>
            <p className="text-2xl sm:text-3xl font-black text-brand-700 dark:text-brand-300 mt-1 font-mono tabular-nums">
              {stats.roots}
            </p>
            <p className="text-[11px] text-brand-700/80 dark:text-brand-300/80 mt-0.5">Grup induk akun</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-500/20 border border-brand-100 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-300 shadow-2xs shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Sub-Categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="bg-gradient-to-br from-sky-50/60 via-white to-white dark:from-sky-500/15 dark:via-slate-900 dark:to-slate-900 p-4 sm:p-5 rounded-3xl border border-sky-200/70 dark:border-sky-500/30 shadow-coffee-sm flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              Rincian Sub-Kategori
            </p>
            <p className="text-2xl sm:text-3xl font-black text-sky-700 dark:text-sky-300 mt-1 font-mono tabular-nums">
              {stats.subCategories}
            </p>
            <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80 mt-0.5">Pos detail turunan</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-500/20 border border-sky-100 dark:border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-300 shadow-2xs shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* ─── Filter & Search Bar ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pos pengeluaran, pendapatan, atau sub-kategori..."
              className="w-full bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 rounded-2xl pl-10 pr-10 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Expand/Collapse All Button */}
          <button
            type="button"
            onClick={handleToggleExpandAll}
            disabled={expandableRoots.length === 0}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>
              {expandableRoots.length > 0 && expandableRoots.every((t) => expandedIds[t.id])
                ? "Ciutkan Semua"
                : "Buka Semua"}
            </span>
          </button>
        </div>

        {/* Quick Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1 shrink-0 uppercase tracking-wider text-[10px]">
            <Filter className="w-3 h-3" />
            Filter Tipe:
          </span>
          {[
            { id: "ALL", label: `Semua (${categories.length})` },
            ...CATEGORY_TYPES.map((t) => ({
              id: t.value,
              label: `${t.label} (${categories.filter((c) => c.type === t.value).length})`,
            })),
          ].map((tab) => {
            const isSelected = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Category Tree Container ─────────────────────────────────────── */}
      <div className="space-y-3">
        {tree.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-12 text-center text-slate-400 shadow-coffee-sm">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">Tidak ada kategori ditemukan</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {search || filterType !== "ALL"
                ? "Tidak ada pos yang cocok dengan pencarian atau filter tipe Anda."
                : "Belum ada bagan akun yang dibuat. Mulai tambahkan pos kategori pertama Anda."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {(search || filterType !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilterType("ALL");
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
                </button>
              )}
              {!isReadOnly && (
                <>
                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-xs hover:bg-amber-600 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> Pulihkan Kategori Standar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRoot}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Tambah Kategori Baru
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {tree.map((cat) => (
              <TreeNode
                key={cat.id}
                category={cat}
                isReadOnly={isReadOnly}
                onEdit={handleEdit}
                onDelete={handleDeletePrompt}
                onAddChild={handleAddChild}
                isExpanded={Boolean(expandedIds[cat.id])}
                onToggleExpand={handleToggleExpand}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Category Add/Edit Modal Form ─────────────────────────────────── */}
      <CategoryModalForm
        isOpen={showFormModal}
        initial={editingCategory}
        defaultParent={defaultParent}
        categories={categories}
        onSave={handleSave}
        onClose={() => {
          setShowFormModal(false);
          setEditingCategory(null);
          setDefaultParent(null);
        }}
      />

      {/* ─── Delete Confirmation Modal ────────────────────────────────────── */}
      <ConfirmModal
        isOpen={Boolean(categoryToDelete)}
        title="Hapus Pos Kategori"
        message={
          categoryToDelete?.children && categoryToDelete.children.length > 0
            ? `Kategori "${categoryToDelete?.name}" memiliki ${categoryToDelete.children.length} sub-kategori. Seluruh sub-kategori di dalamnya juga akan terhapus. Apakah Anda yakin?`
            : `Apakah Anda yakin ingin menghapus kategori "${categoryToDelete?.name}"?`
        }
        confirmLabel="Ya, Hapus Kategori"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
}
