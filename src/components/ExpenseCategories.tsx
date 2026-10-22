import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { ExpenseCategory, ExpenseCategoryType } from "../types";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
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
  AlertTriangle,
  FolderPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CsvImportExport } from "./common/CsvImportExport";
import { ConfirmModal } from "./common/ConfirmModal";

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
  "#10B981", "#059669", "#3B82F6", "#1D4ED8", "#8B5CF6",
  "#6D28D9", "#F59E0B", "#D97706", "#EF4444", "#DC2626",
  "#EC4899", "#14B8A6", "#F97316", "#06B6D4", "#64748B",
];

const TYPE_CONFIG: Record<
  ExpenseCategoryType,
  { label: string; badgeClass: string; borderClass: string; icon: any }
> = {
  PENDAPATAN: {
    label: "Pendapatan",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    borderClass: "border-l-emerald-500",
    icon: TrendingUp,
  },
  PENGELUARAN: {
    label: "Pengeluaran",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    borderClass: "border-l-rose-500",
    icon: TrendingDown,
  },
  BAHAN_BAKU: {
    label: "Bahan Baku",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    borderClass: "border-l-amber-500",
    icon: Package,
  },
  UTILITAS: {
    label: "Utilitas",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    borderClass: "border-l-blue-500",
    icon: Zap,
  },
  HRD: {
    label: "HRD",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    borderClass: "border-l-violet-500",
    icon: Users,
  },
  ASET: {
    label: "Aset",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    borderClass: "border-l-indigo-500",
    icon: Box,
  },
  LAINNYA: {
    label: "Lainnya",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    borderClass: "border-l-slate-400",
    icon: Tag,
  },
};

// ─── Build Tree Structure ────────────────────────────────────────────────────
function buildTree(categories: ExpenseCategory[]): ExpenseCategory[] {
  const map = new Map<string, ExpenseCategory>();
  categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: ExpenseCategory[] = [];
  map.forEach((cat) => {
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children!.push(cat);
    } else {
      roots.push(cat);
    }
  });
  return roots.sort((a, b) => a.sortOrder - b.sortOrder);
}

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
    initial?.color ?? defaultParent?.color ?? "#3B82F6",
  );
  const [icon, setIcon] = useState(initial?.icon ?? "tag");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  // Sync state if initial or defaultParent changes
  React.useEffect(() => {
    if (isOpen) {
      setName(initial?.name ?? "");
      setType(initial?.type ?? defaultParent?.type ?? "PENGELUARAN");
      setParentId(initial?.parentId ?? defaultParent?.id ?? null);
      setColor(initial?.color ?? defaultParent?.color ?? "#3B82F6");
      setIcon(initial?.icon ?? "tag");
      setIsActive(initial?.isActive ?? true);
    }
  }, [isOpen, initial, defaultParent]);

  if (!isOpen) return null;

  const rootCategories = categories.filter(
    (c) => !c.parentId && c.id !== initial?.id,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      type,
      parentId,
      color,
      icon,
      isActive,
      sortOrder: initial?.sortOrder ?? 0,
    });
  };

  const IconComp = ICON_MAP[icon] ?? Tag;
  const currentConfig = TYPE_CONFIG[type] || TYPE_CONFIG.LAINNYA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", stiffness: 450, damping: 32 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs"
              style={{
                backgroundColor: `${color}18`,
                border: `1.5px solid ${color}40`,
              }}
            >
              <IconComp className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {initial?.id ? "Edit Kategori" : "Tambah Kategori"}
              </h3>
              <p className="text-xs text-slate-500">
                {parentId
                  ? `Sub-kategori di bawah "${categories.find((c) => c.id === parentId)?.name || "Induk"}"`
                  : "Kategori utama dalam bagan akun kafe"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Nama Pos Kategori *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kopi & Espresso / Sewa Tempat"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 transition-all shadow-2xs"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Tipe Akun
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ExpenseCategoryType)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer shadow-2xs"
              >
                {CATEGORY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Parent Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Kategori Induk (Grup)
              </label>
              <select
                value={parentId ?? ""}
                onChange={(e) => setParentId(e.target.value || null)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer shadow-2xs"
              >
                <option value="">— Pos Utama (Header / Root) —</option>
                {rootCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
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
                      ? "scale-115 ring-2 ring-slate-900 ring-offset-2 ring-offset-white shadow-xs"
                      : "hover:scale-105 opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }}
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
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              Pilih Ikon Simbol
            </label>
            <div className="grid grid-cols-8 gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-200 max-h-32 overflow-y-auto no-scrollbar">
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
                        : "bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/80"
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
          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs"
                style={{
                  backgroundColor: `${color}20`,
                  border: `1.5px solid ${color}45`,
                }}
              >
                <IconComp className="w-4.5 h-4.5" style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {name || "Nama Kategori Anda"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentConfig.badgeClass}`}
                  >
                    {currentConfig.label}
                  </span>
                  {parentId && (
                    <span className="text-[10px] text-slate-400">
                      • Sub-kategori
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Active Toggle Switch */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-semibold text-slate-600">
                {isActive ? "Aktif" : "Nonaktif"}
              </span>
              <div
                onClick={() => setIsActive(!isActive)}
                className={`w-9 h-5 rounded-full relative transition-colors ${
                  isActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-transform ${
                    isActive ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Kategori</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ─── Tree Node Component (Modern Accordion Row) ─────────────────────────────
interface TreeNodeProps {
  category: ExpenseCategory;
  onEdit: (c: ExpenseCategory) => void;
  onDelete: (c: ExpenseCategory) => void;
  onAddChild: (parent: ExpenseCategory) => void;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  category,
  onEdit,
  onDelete,
  onAddChild,
  isExpanded,
  onToggleExpand,
}) => {
  const hasChildren = (category.children?.length ?? 0) > 0;
  const IconComp = ICON_MAP[category.icon] ?? Tag;
  const config = TYPE_CONFIG[category.type] || TYPE_CONFIG.LAINNYA;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all overflow-hidden"
    >
      {/* Root Category Bar */}
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
        <div className="flex items-center gap-3 min-w-0">
          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => onToggleExpand(category.id)}
            disabled={!hasChildren}
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              hasChildren
                ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                : "text-slate-200 cursor-default"
            }`}
            title={hasChildren ? (isExpanded ? "Ciutkan sub-pos" : "Buka sub-pos") : "Tidak ada sub-pos"}
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-200 ${
                isExpanded && hasChildren ? "rotate-90 text-brand-600" : ""
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
                  category.isActive ? "text-slate-900" : "text-slate-400 line-through"
                }`}
              >
                {category.name}
              </h4>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.badgeClass}`}
              >
                {config.label}
              </span>
              {!category.isActive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                  Nonaktif
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span>{hasChildren ? `${category.children!.length} Sub-kategori` : "Pos Utama Tunggal"}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => onAddChild(category)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            title="Tambah Sub-kategori di bawah pos ini"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tambah Sub</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(category)}
            className="p-2 rounded-xl text-slate-600 hover:text-brand-700 hover:bg-brand-50 border border-slate-200/80 transition-colors cursor-pointer shadow-2xs"
            title="Edit Kategori"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(category)}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 transition-colors cursor-pointer shadow-2xs"
            title="Hapus Kategori"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Children Sub-Categories List */}
      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4 space-y-2 overflow-hidden"
          >
            <div className="border-l-2 border-brand-200/80 ml-3.5 pl-3 sm:pl-4 space-y-2">
              {category.children!
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((child) => {
                  const ChildIcon = ICON_MAP[child.icon] ?? Tag;
                  return (
                    <div
                      key={child.id}
                      className="p-2.5 sm:p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3 group/child hover:border-brand-200 transition-colors"
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
                        <div className="min-w-0">
                          <span
                            className={`text-xs font-semibold truncate block ${
                              child.isActive
                                ? "text-slate-800"
                                : "text-slate-400 line-through"
                            }`}
                          >
                            {child.name}
                          </span>
                        </div>
                      </div>

                      {/* Sub-item Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/child:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onEdit(child)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                          title="Edit Sub-kategori"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(child)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus Sub-kategori"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
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
  const { expenseCategories, dispatch } = useStore() as any;
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

  // Filter categories
  const filtered = useMemo(() => {
    return categories.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === "ALL" || c.type === filterType;
      return matchSearch && matchType;
    });
  }, [categories, search, filterType]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  // Set default expanded for all root items on load
  React.useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    tree.forEach((t) => {
      initialExpanded[t.id] = true;
    });
    setExpandedIds(initialExpanded);
  }, [categories.length]);

  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.isActive).length;
    const roots = categories.filter((c) => !c.parentId).length;
    const subCategories = total - roots;
    return { total, active, roots, subCategories };
  }, [categories]);

  // Expand / Collapse all
  const handleToggleExpandAll = () => {
    const areAllExpanded = tree.every((t) => expandedIds[t.id]);
    const nextState: Record<string, boolean> = {};
    tree.forEach((t) => {
      nextState[t.id] = !areAllExpanded;
    });
    setExpandedIds(nextState);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = (data: Omit<ExpenseCategory, "id" | "children">) => {
    if (editingCategory) {
      dispatch({
        type: "UPDATE_EXPENSE_CATEGORY",
        payload: { ...editingCategory, ...data },
      });
    } else {
      const newCat: ExpenseCategory = {
        id: `cat-${Date.now()}`,
        ...data,
        parentId: defaultParent?.id ?? data.parentId,
      };
      dispatch({ type: "ADD_EXPENSE_CATEGORY", payload: newCat });
      if (newCat.parentId) {
        setExpandedIds((prev) => ({ ...prev, [newCat.parentId!]: true }));
      }
    }
    setShowFormModal(false);
    setEditingCategory(null);
    setDefaultParent(null);
  };

  const handleEdit = (cat: ExpenseCategory) => {
    setEditingCategory(cat);
    setDefaultParent(null);
    setShowFormModal(true);
  };

  const handleDeletePrompt = (cat: ExpenseCategory) => {
    setCategoryToDelete(cat);
  };

  const handleConfirmDelete = () => {
    if (categoryToDelete) {
      dispatch({
        type: "DELETE_EXPENSE_CATEGORY",
        payload: categoryToDelete.id,
      });
      setCategoryToDelete(null);
    }
  };

  const handleAddChild = (parent: ExpenseCategory) => {
    setEditingCategory(null);
    setDefaultParent(parent);
    setShowFormModal(true);
  };

  const handleAddRoot = () => {
    setEditingCategory(null);
    setDefaultParent(null);
    setShowFormModal(true);
  };

  const handleImportCategories = (data: any[]) => {
    let imported = 0;
    let updated = 0;
    data.forEach((row) => {
      const idSistem = row["ID_SISTEM (JANGAN DIUBAH)"];
      const name = row["Nama Kategori"] || row.name;
      const type = (
        row["Tipe"] ||
        row.type ||
        "LAINNYA"
      ).toUpperCase() as ExpenseCategoryType;
      const color = row["Warna"] || row.color || "#3B82F6";
      const icon = row["Icon"] || row.icon || "tag";

      if (name) {
        if (idSistem) {
          const existing = categories.find((c) => c.id === idSistem);
          if (existing) {
            dispatch({
              type: "UPDATE_EXPENSE_CATEGORY",
              payload: { ...existing, name, type, color, icon },
            });
            updated++;
          }
        } else {
          const newCat: ExpenseCategory = {
            id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            type,
            color,
            icon,
            parentId: null,
            isActive: true,
            sortOrder: 0,
          };
          dispatch({ type: "ADD_EXPENSE_CATEGORY", payload: newCat });
          imported++;
        }
      }
    });
    if (imported > 0 || updated > 0)
      alert(
        `Berhasil menambahkan ${imported} pos baru dan memperbarui ${updated} kategori.`,
      );
    else alert("Tidak ada data valid yang diimpor.");
  };

  return (
    <div className="space-y-6">
      {/* ─── Header Card ─────────────────────────────────────────────────── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 text-brand-700 uppercase border border-brand-200/70">
              Chart of Accounts • Klasifikasi Keuangan
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              Julia's • Specialty Room • Coffee • Eatery
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            Kategori Kas & Biaya
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Kelola bagan pos pendapatan, biaya operasional, utilitas, dan modal kafe untuk otomatisasi Buku Kas & Laba Rugi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <CsvImportExport
            onImport={handleImportCategories}
            templateHeaders={["Nama Kategori", "Tipe", "Warna", "Icon"]}
            templateExampleRow={["Gaji Karyawan", "HRD", "#8B5CF6", "users"]}
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
              Warna: "Kode HEX warna, contoh: #8B5CF6",
              Icon: "Nama icon (misal: users, coffee, tag, wallet, package)",
            }}
          />

          <button
            onClick={handleAddRoot}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kategori</span>
          </button>
        </div>
      </div>

      {/* ─── 4 Bento KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Pos Kategori
            </p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-mono">
              {stats.total}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Bagan akun terdaftar</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
            <FolderTree className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Active Categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600">
              Kategori Aktif
            </p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1 font-mono">
              {stats.active}
            </p>
            <p className="text-[11px] text-emerald-600/70 mt-0.5">Siap di entri kas</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Root Categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-brand-600">
              Kategori Utama (Header)
            </p>
            <p className="text-2xl sm:text-3xl font-black text-brand-700 mt-1 font-mono">
              {stats.roots}
            </p>
            <p className="text-[11px] text-brand-600/70 mt-0.5">Grup induk akun</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Sub-Categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-violet-600">
              Rincian Sub-Kategori
            </p>
            <p className="text-2xl sm:text-3xl font-black text-violet-700 mt-1 font-mono">
              {stats.subCategories}
            </p>
            <p className="text-[11px] text-violet-600/70 mt-0.5">Pos detail turunan</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shadow-2xs shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* ─── Filter & Search Bar ─────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pos pengeluaran, pendapatan, atau sub-kategori..."
              className="w-full bg-slate-50 border border-slate-200/90 rounded-2xl pl-10 pr-10 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 transition-all shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Expand/Collapse All Button */}
          <button
            type="button"
            onClick={handleToggleExpandAll}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {tree.every((t) => expandedIds[t.id]) ? "Ciutkan Semua" : "Buka Semua"}
            </span>
          </button>
        </div>

        {/* Quick Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1 shrink-0 uppercase tracking-wider text-[10px]">
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
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 border border-slate-200/60"
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
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-400 shadow-xs">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <h4 className="text-base font-bold text-slate-700">Tidak ada kategori ditemukan</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {search || filterType !== "ALL"
                ? "Tidak ada pos yang cocok dengan pencarian atau filter tipe Anda."
                : "Belum ada bagan akun yang dibuat. Mulai tambahkan pos kategori pertama Anda."}
            </p>
            <button
              onClick={handleAddRoot}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-xs hover:bg-brand-700 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tambah Kategori Pertama
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tree.map((cat) => (
              <TreeNode
                key={cat.id}
                category={cat}
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
      <AnimatePresence>
        {showFormModal && (
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
        )}
      </AnimatePresence>

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
