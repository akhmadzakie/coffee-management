import React, { useState, useMemo } from "react";
import { useStore } from "../store/StoreContext";
import { ExpenseCategory, ExpenseCategoryType } from "../types";
import {
  Plus, Edit2, Trash2, ChevronRight, ChevronDown,
  Tag, TrendingUp, TrendingDown, Package, Zap,
  Users, Briefcase, MoreHorizontal, Save, X,
  Coffee, Home, Shield, Gift, BookOpen, Wallet,
  Flame, Wifi, Droplets, ShoppingCart, Box, Settings,
} from "lucide-react";

// ─── Icon map ───────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.FC<any>> = {
  "tag": Tag, "trending-up": TrendingUp, "trending-down": TrendingDown,
  "package": Package, "zap": Zap, "users": Users, "briefcase": Briefcase,
  "more-horizontal": MoreHorizontal, "coffee": Coffee, "home": Home,
  "shield": Shield, "gift": Gift, "book-open": BookOpen, "wallet": Wallet,
  "flame": Flame, "wifi": Wifi, "droplets": Droplets,
  "shopping-cart": ShoppingCart, "box": Box, "settings": Settings,
  "utensils": Tag, "plus-circle": Plus, "megaphone": Tag, "cup-soda": Coffee,
  "trash-2": Trash2,
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

const CATEGORY_TYPES: { value: ExpenseCategoryType; label: string }[] = [
  { value: "PENDAPATAN", label: "Pendapatan" },
  { value: "PENGELUARAN", label: "Pengeluaran" },
  { value: "BAHAN_BAKU", label: "Bahan Baku" },
  { value: "UTILITAS", label: "Utilitas" },
  { value: "HRD", label: "HRD" },
  { value: "ASET", label: "Aset" },
  { value: "LAINNYA", label: "Lainnya" },
];

const PRESET_COLORS = [
  "#10B981", "#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6",
  "#6366F1", "#6B7280", "#EC4899", "#14B8A6", "#F97316",
  "#84CC16", "#06B6D4", "#A855F7", "#E11D48", "#0EA5E9",
];

const TYPE_LABELS: Record<ExpenseCategoryType, string> = {
  PENDAPATAN: "Pendapatan", PENGELUARAN: "Pengeluaran",
  BAHAN_BAKU: "Bahan Baku", UTILITAS: "Utilitas",
  HRD: "HRD", ASET: "Aset", LAINNYA: "Lainnya",
};

const TYPE_COLORS: Record<ExpenseCategoryType, string> = {
  PENDAPATAN: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  PENGELUARAN: "bg-red-500/20 text-red-300 border-red-500/30",
  BAHAN_BAKU: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  UTILITAS: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  HRD: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  ASET: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  LAINNYA: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

// ─── Build tree from flat list ───────────────────────────────────────────────
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

// ─── Category Form ───────────────────────────────────────────────────────────
interface CategoryFormProps {
  initial?: Partial<ExpenseCategory>;
  categories: ExpenseCategory[];
  onSave: (data: Omit<ExpenseCategory, "id" | "children">) => void;
  onCancel: () => void;
}

function CategoryForm({ initial, categories, onSave, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ExpenseCategoryType>(initial?.type ?? "LAINNYA");
  const [parentId, setParentId] = useState<string | null>(initial?.parentId ?? null);
  const [color, setColor] = useState(initial?.color ?? "#6B7280");
  const [icon, setIcon] = useState(initial?.icon ?? "tag");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const rootCategories = categories.filter((c) => !c.parentId && c.id !== initial?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), type, parentId, color, icon, isActive, sortOrder: initial?.sortOrder ?? 0 });
  };

  const IconComp = ICON_MAP[icon] ?? Tag;

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
      <h3 className="text-base font-semibold text-white">
        {initial?.id ? "Edit Kategori" : "Tambah Kategori"}
      </h3>

      {/* Name */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Nama Kategori *</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Kopi & Espresso"
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Type */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tipe</label>
          <select
            value={type} onChange={(e) => setType(e.target.value as ExpenseCategoryType)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
          >
            {CATEGORY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Parent */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Induk (opsional)</label>
          <select
            value={parentId ?? ""}
            onChange={(e) => setParentId(e.target.value || null)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
          >
            <option value="">— Tidak ada (root) —</option>
            {rootCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">Warna</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c} type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-gray-800" : "hover:scale-110"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent"
            title="Warna kustom"
          />
        </div>
      </div>

      {/* Icon */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">Ikon</label>
        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
          {AVAILABLE_ICONS.map((ic) => {
            const Ic = ICON_MAP[ic];
            return (
              <button
                key={ic} type="button"
                onClick={() => setIcon(ic)}
                className={`p-2 rounded-lg transition-colors ${icon === ic ? "bg-amber-500/30 border border-amber-500" : "bg-gray-700 border border-transparent hover:border-gray-500"}`}
                title={ic}
              >
                <Ic size={16} className="text-gray-300" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "30", border: `1px solid ${color}50` }}>
          <IconComp size={18} style={{ color }} />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{name || "Nama Kategori"}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[type]}`}>
            {TYPE_LABELS[type]}
          </span>
        </div>
      </div>

      {/* Status */}
      <label className="flex items-center gap-2 cursor-pointer">
        <div
          onClick={() => setIsActive(!isActive)}
          className={`w-10 h-5 rounded-full relative transition-colors ${isActive ? "bg-amber-500" : "bg-gray-600"}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? "translate-x-5" : "translate-x-0.5"}`} />
        </div>
        <span className="text-sm text-gray-300">{isActive ? "Aktif" : "Nonaktif"}</span>
      </label>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          <Save size={15} /> Simpan
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-700 transition-colors">
          Batal
        </button>
      </div>
    </form>
  );
}

// ─── Category Tree Node ───────────────────────────────────────────────────────
interface TreeNodeProps {
  category: ExpenseCategory;
  depth?: number;
  onEdit: (c: ExpenseCategory) => void;
  onDelete: (c: ExpenseCategory) => void;
  onAddChild: (parent: ExpenseCategory) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ category, depth = 0, onEdit, onDelete, onAddChild }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (category.children?.length ?? 0) > 0;
  const IconComp = ICON_MAP[category.icon] ?? Tag;

  return (
    <div>
      <div
        className={`flex items-center gap-2 p-2.5 rounded-lg group hover:bg-gray-800 transition-colors ${depth > 0 ? "ml-6 border-l border-gray-700 pl-4 rounded-none" : ""}`}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-300 ${!hasChildren ? "invisible" : ""}`}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Color + icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: category.color + "25", border: `1px solid ${category.color}40` }}>
          <IconComp size={15} style={{ color: category.color }} />
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${category.isActive ? "text-white" : "text-gray-500 line-through"}`}>
              {category.name}
            </span>
            {!category.parentId && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[category.type]}`}>
                {TYPE_LABELS[category.type]}
              </span>
            )}
            {!category.isActive && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400">Nonaktif</span>
            )}
          </div>
          {hasChildren && (
            <p className="text-xs text-gray-500">{category.children!.length} sub-kategori</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!category.parentId && (
            <button onClick={() => onAddChild(category)}
              className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Tambah sub-kategori">
              <Plus size={14} />
            </button>
          )}
          <button onClick={() => onEdit(category)}
            className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(category)}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Hapus">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {category.children!
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((child) => (
              <TreeNode key={child.id} category={child} depth={depth + 1}
                onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild} />
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function ExpenseCategories() {
  const { state, dispatch } = useStore();
  const categories: ExpenseCategory[] = (state as any).expenseCategories ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [defaultParent, setDefaultParent] = useState<ExpenseCategory | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<ExpenseCategoryType | "ALL">("ALL");

  const filtered = useMemo(() => {
    return categories.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === "ALL" || c.type === filterType;
      return matchSearch && matchType;
    });
  }, [categories, search, filterType]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  const stats = useMemo(() => ({
    total: categories.length,
    active: categories.filter((c) => c.isActive).length,
    roots: categories.filter((c) => !c.parentId).length,
  }), [categories]);

  const handleSave = (data: Omit<ExpenseCategory, "id" | "children">) => {
    if (editingCategory) {
      dispatch({ type: "UPDATE_EXPENSE_CATEGORY", payload: { ...editingCategory, ...data } });
    } else {
      const newCat: ExpenseCategory = {
        id: `cat-${Date.now()}`,
        ...data,
        parentId: defaultParent?.id ?? data.parentId,
      };
      dispatch({ type: "ADD_EXPENSE_CATEGORY", payload: newCat });
    }
    setShowForm(false);
    setEditingCategory(null);
    setDefaultParent(null);
  };

  const handleEdit = (cat: ExpenseCategory) => {
    setEditingCategory(cat);
    setDefaultParent(null);
    setShowForm(true);
  };

  const handleDelete = (cat: ExpenseCategory) => {
    const childCount = categories.filter((c) => c.parentId === cat.id).length;
    const msg = childCount > 0
      ? `Hapus "${cat.name}"? Kategori ini memiliki ${childCount} sub-kategori yang juga akan dihapus.`
      : `Hapus kategori "${cat.name}"?`;
    if (!confirm(msg)) return;
    dispatch({ type: "DELETE_EXPENSE_CATEGORY", payload: cat.id });
  };

  const handleAddChild = (parent: ExpenseCategory) => {
    setEditingCategory(null);
    setDefaultParent(parent);
    setShowForm(true);
  };

  const handleAddRoot = () => {
    setEditingCategory(null);
    setDefaultParent(null);
    setShowForm(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Kategori Keuangan</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Kelola hierarki kategori pendapatan & pengeluaran
          </p>
        </div>
        <button
          onClick={handleAddRoot}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus size={16} /> Tambah Kategori
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Kategori", value: stats.total, color: "text-white" },
          { label: "Aktif", value: stats.active, color: "text-emerald-400" },
          { label: "Kategori Utama", value: stats.roots, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form panel */}
        {showForm && (
          <div className="lg:col-span-1">
            <CategoryForm
              initial={editingCategory
                ? { ...editingCategory }
                : defaultParent ? { parentId: defaultParent.id, type: defaultParent.type } : undefined}
              categories={categories}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingCategory(null); setDefaultParent(null); }}
            />
          </div>
        )}

        {/* Tree panel */}
        <div className={showForm ? "lg:col-span-2" : "lg:col-span-3"}>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex-1 min-w-40">
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kategori..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">Semua Tipe</option>
              {CATEGORY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Tree */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
            {tree.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Tag size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Belum ada kategori</p>
                <button onClick={handleAddRoot}
                  className="mt-3 text-xs text-amber-400 hover:underline">
                  Tambah kategori pertama
                </button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {tree.map((cat) => (
                  <TreeNode key={cat.id} category={cat}
                    onEdit={handleEdit} onDelete={handleDelete} onAddChild={handleAddChild} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
