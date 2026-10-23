import React, { useState, useRef, useEffect } from "react";
import { ViewState } from "../types";
import { useTranslation } from "../utils/i18n";
import { useStore } from "../store/StoreContext";
import { SwitchAccountModal } from "./SwitchAccountModal";
import { ExportModal } from "./ExportModal";
import { AIAssistantModal } from "./AIAssistantModal";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Package,
  Users,
  Warehouse,
  ReceiptText,
  Wallet,
  Menu,
  Coffee,
  ClipboardCheck,
  Settings,
  Truck,
  ShoppingBag,
  ShieldCheck,
  LogOut,
  Cloud,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Download,
  FileSpreadsheet,
  BadgePercent,
  X,
  Tag,
  BarChart3,
  CreditCard,
  Calculator,
  Eye,
  Calendar,
  Sparkles,
  Store,
  TrendingUp,
  Clock,
  KeyRound,
  PanelLeftClose,
  PanelLeft,
  UtensilsCrossed,
} from "lucide-react";

const DASHBOARD_TABS: { id: ViewState; label: string }[] = [
  { id: "dashboard_manager", label: "Operasional" },
  { id: "dashboard_owner", label: "Bisnis & Omzet" },
  { id: "dashboard_finance", label: "Keuangan" },
  { id: "dashboard_inventory", label: "Inventori" },
];

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  onViewChange,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1180;
    }
    return false;
  });
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isSwitchAccountOpen, setIsSwitchAccountOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalModule, setExportModalModule] = useState<
    "sales" | "inventory" | "finance" | "payroll" | "attendance" | "kpi" | "executive"
  >("sales");
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [aiInitialTab, setAiInitialTab] = useState<
    "quick-input" | "receipt" | "consultant" | "insights"
  >("quick-input");
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string>("");

  useEffect(() => {
    const handleOpenAi = (e: any) => {
      if (e.detail?.tab) setAiInitialTab(e.detail.tab);
      if (e.detail?.prompt) setAiInitialPrompt(e.detail.prompt);
      setIsAIAssistantOpen(true);
    };
    window.addEventListener("open-ai-assistant", handleOpenAi);
    return () => window.removeEventListener("open-ai-assistant", handleOpenAi);
  }, []);

  // ─── Responsive Orientation & Screen Size Listener ───
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      }
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // ─── Prevent background body scroll when mobile menu is open ───
  useEffect(() => {
    if (isMobileMenuOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isMobileMenuOpen]);

  // ─── Close mobile drawer on Escape key ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  const [currentTime, setCurrentTime] = useState(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getPrimaryDashboard = (role?: string): ViewState => {
    switch (role?.toUpperCase()) {
      case "OWNER":
        return "dashboard_owner";
      case "FINANCE":
        return "dashboard_finance";
      case "MANAGER":
      case "SUPER_ADMIN":
        return "dashboard_manager";
      default:
        return "dashboard_employee";
    }
  };

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Dasbor: true,
    "Menu & Produk": true,
    "Stok & Pengadaan": true,
    "Keuangan & Kas": true,
    "Laporan & Keuangan": true,
    "SDM & Tim": true,
    "Sistem & Admin": false,
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const {
    settings,
    isSyncing,
    lastSyncTime,
    syncData,
    currentUser,
    logout,
    cashAccounts,
    addCashTransaction,
    addStockMovement,
    employees,
  } = useStore();
  const { t } = useTranslation(settings.language || "id");

  // Realtime clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Semua item navigasi dengan grup visual terstruktur & mengalir ─────────────
  const allNavigation = [
    // ─── 1. Dasbor Pintar (1 Item Adaptif per Role) ─────────────
    { 
      group: "Dasbor",
      name: "Dasbor Utama",
      view: getPrimaryDashboard(currentUser?.role),
      icon: LayoutDashboard,
    },

    // ─── 2. Menu & Produk (Dikelola Manager & Super Admin) ───────
    { 
      group: "Menu & Produk",
      name: "Katalog & Menu",
      view: "menu_management" as ViewState,
      icon: UtensilsCrossed,
    },
    { 
      group: "Menu & Produk",
      name: "Kalkulator & HPP",
      view: "hpp_calculator" as ViewState,
      icon: Calculator,
    },

    // ─── 3. Stok & Pengadaan (Tugas Leader & Manager) ───────────
    { 
      group: "Stok & Pengadaan",
      name: "Stok Bahan Baku",
      view: "inventory" as ViewState,
      icon: Warehouse,
    },
    { 
      group: "Stok & Pengadaan",
      name: "Pembelian Bahan (PO)",
      view: "purchases" as ViewState,
      icon: ShoppingBag,
    },
    { 
      group: "Stok & Pengadaan",
      name: "Pemasok / Supplier",
      view: "suppliers" as ViewState,
      icon: Truck,
    },

    // ─── 4. Keuangan & Kas (Tugas Finance & Owner) ───────────────
    { 
      group: "Keuangan & Kas",
      name: "Rekap Penjualan",
      view: "import_sales" as ViewState,
      icon: ReceiptText,
    },
    { 
      group: "Keuangan & Kas",
      name: "Buku Kas & Arus Kas",
      view: "cash_flow" as ViewState,
      icon: Wallet,
    },
    { 
      group: "Keuangan & Kas",
      name: "Kategori Kas & Biaya",
      view: "expense_categories" as ViewState,
      icon: Tag,
    },
    { 
      group: "Keuangan & Kas",
      name: "Laporan Laba Rugi",
      view: "finance_reports" as ViewState,
      icon: BarChart3,
    },

    // ─── 5. SDM & Tim (Manager, Finance untuk Gaji, Leader & Staf) ─
    { 
      group: "SDM & Tim",
      name: "Presensi & Clock In",
      view: "attendance_clock" as ViewState,
      icon: Calendar,
    },
    { 
      group: "SDM & Tim",
      name: "Checklist Supervisi",
      view: "leader_checklist" as ViewState,
      icon: ClipboardCheck,
    },
    { 
      group: "SDM & Tim",
      name: "Data Karyawan & Kontrak",
      view: "hr" as ViewState,
      icon: UserCheck,
    },
    { 
      group: "SDM & Tim",
      name: "Penggajian (Payroll)",
      view: "payroll" as ViewState,
      icon: Calculator,
    },

    // ─── 6. Sistem & Admin (Super Admin & Manager) ───────────────
    { 
      group: "Sistem & Admin",
      name: "Manajemen Pengguna",
      view: "users" as ViewState,
      icon: Users,
    },
    { 
      group: "Sistem & Admin",
      name: "Audit Log Aktivitas",
      view: "audit_log" as ViewState,
      icon: ShieldCheck,
    },
    { 
      group: "Sistem & Admin",
      name: "Pengaturan Sistem",
      view: "settings" as ViewState,
      icon: Settings,
    },
  ];

  // ─── Role Access Matrix (Tepat Sesuai SOP Julia's Coffee) ─────────
  const ALL_VIEWS: ViewState[] = [
    "dashboard_owner", "dashboard_finance", "dashboard_manager", "dashboard_inventory", "dashboard_employee",
    "menu_management", "hpp_calculator",
    "import_sales",
    "inventory", "purchases", "suppliers",
    "cash_flow", "expense_categories", "finance_reports", "bank_reconciliation",
    "attendance_clock", "leader_checklist", "hr", "payroll",
    "users", "audit_log", "settings",
  ];

  const roleAccess: Record<string, ViewState[]> = {
    // Super Admin: Akses penuh teknis & manajerial
    SUPER_ADMIN: ALL_VIEWS,

    // Owner: Pemilik usaha (murni laporan eksekutif, rekap penjualan, arus kas, laba rugi, & payroll)
    OWNER: [
      "dashboard_owner",
      "import_sales",
      "finance_reports",
      "cash_flow",
      "expense_categories",
      "payroll",
      "audit_log",
    ],

    // Manager: Mengelola operasional harian toko, menu, stok, dan tim (keuangan & omzet dipantau via Dasbor Utama, tidak perlu clock in)
    MANAGER: [
      "dashboard_manager",
      "dashboard_inventory",
      "import_sales",
      "menu_management",
      "hpp_calculator",
      "inventory",
      "purchases",
      "suppliers",
      "expense_categories",
      "hr",
      "leader_checklist",
      "users",
    ],

    // Finance: Penjualan, arus kas, laba rugi, nota belanja, payroll
    FINANCE: [
      "dashboard_finance",
      "import_sales",
      "cash_flow",
      "expense_categories",
      "finance_reports",
      "purchases",
      "payroll",
    ],

    // Kasir: Rekap penjualan, presensi
    KASIR: [
      "dashboard_employee",
      "import_sales",
      "attendance_clock",
    ],

    // Leader: Supervisi harian, stok bahan opname, pengajuan belanja PO, cek resep menu, presensi, rekap omzet
    LEADER: [
      "dashboard_employee",
      "leader_checklist",
      "attendance_clock",
      "import_sales",
      "inventory",
      "purchases",
      "suppliers",
      "menu_management",
    ],

    // Barista, Kitchen, Baker: Portal karyawan & presensi masuk
    BAR: ["dashboard_employee", "attendance_clock"],
    KITCHEN: ["dashboard_employee", "attendance_clock"],
    BAKER: ["dashboard_employee", "attendance_clock"],
  };

  const isEmployeeLeader = Boolean(
    currentUser &&
      (currentUser.role === "LEADER" ||
        employees?.some(
          (e) =>
            (e.username === currentUser.username || e.id === currentUser.employeeId) &&
            ((e.position || "").toUpperCase().includes("LEADER") ||
              (e.position || "").toUpperCase().includes("HEAD"))
        ))
  );

  const baseAllowed = currentUser ? (roleAccess[currentUser.role] || ALL_VIEWS) : [];
  const allowedViews = isEmployeeLeader && !baseAllowed.includes("leader_checklist")
    ? [...baseAllowed, "leader_checklist" as ViewState]
    : baseAllowed;
  const navigation = allNavigation
    .filter((nav) => allowedViews.includes(nav.view))
    .map((nav) => {
      if (currentUser?.role === "OWNER") {
        if (nav.view === "dashboard_owner") {
          return { ...nav, name: "Dasbor Eksekutif", group: "Dasbor" };
        }
        if (nav.view === "import_sales") {
          return { ...nav, name: "Laporan Penjualan", group: "Laporan & Keuangan" };
        }
        if (nav.view === "finance_reports") {
          return { ...nav, name: "Laporan Laba Rugi (P&L)", group: "Laporan & Keuangan" };
        }
        if (nav.view === "cash_flow") {
          return { ...nav, name: "Buku Kas & Arus Kas", group: "Laporan & Keuangan" };
        }
        if (nav.view === "payroll") {
          return { ...nav, name: "Laporan Payroll & SDM", group: "Laporan & Keuangan" };
        }
      }
      return nav;
    });
  const canAccessBusinessReports = Boolean(
    currentUser &&
      ["OWNER", "MANAGER", "FINANCE", "SUPER_ADMIN"].includes(currentUser.role)
  );
  const canAccessAIAssistant = Boolean(
    currentUser &&
      ["FINANCE", "MANAGER", "SUPER_ADMIN", "OWNER"].includes(currentUser.role)
  );

  const getRoleTheme = (role?: string) => {
    switch (role?.toUpperCase()) {
      case "SUPER_ADMIN":
      case "OWNER":
        return { label: "Owner", bg: "bg-brand-50 text-brand-700 border-brand-200", icon: "👑" };
      case "MANAGER":
        return { label: "Manager", bg: "bg-violet-50 text-violet-700 border-violet-200", icon: "💼" };
      case "FINANCE":
        return { label: "Finance", bg: "bg-sky-50 text-sky-700 border-sky-200", icon: "📊" };
      case "KASIR":
        return { label: "Kasir POS", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "💳" };
      case "LEADER": {
        const emp = employees?.find(
          (e) => e.id === currentUser?.employeeId || e.username?.toLowerCase() === currentUser?.username?.toLowerCase()
        );
        const dept = (currentUser?.department || emp?.department || emp?.position || "").toUpperCase();
        if (dept.includes("KITCHEN")) {
          return { label: "Leader Kitchen", bg: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "🍳" };
        }
        if (dept.includes("BAKER") || dept.includes("PASTRY")) {
          return { label: "Leader Baker", bg: "bg-purple-50 text-purple-700 border-purple-200", icon: "🥐" };
        }
        return { label: "Leader Bar", bg: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "☕" };
      }
      default:
        return { label: role || "Staff", bg: "bg-slate-50 text-slate-700 border-slate-200", icon: "👤" };
    }
  };

  const roleTheme = getRoleTheme(currentUser?.role);

  return (
    <div className="min-h-screen bg-[#f6f8ff] flex antialiased text-slate-900 safe-area-left safe-area-right">
      {/* ─── Switch Account Modal ─── */}
      <SwitchAccountModal
        isOpen={isSwitchAccountOpen}
        onClose={() => setIsSwitchAccountOpen(false)}
      />

      {/* ─── AI Assistant Modal ─── */}
      <AIAssistantModal
        isOpen={isAIAssistantOpen && canAccessAIAssistant}
        onClose={() => setIsAIAssistantOpen(false)}
        initialTab={aiInitialTab}
        initialPrompt={aiInitialPrompt}
        onApplyTransactions={(txs, options) => {
          if (Array.isArray(txs) && txs.length > 0) {
            const defaultAccountId = cashAccounts?.[0]?.id || "acc-main";
            const nowIso = new Date().toISOString();
            txs.forEach((tx) => {
              const targetAccountId = tx.accountId || defaultAccountId;
              addCashTransaction({
                accountId: targetAccountId,
                type: tx.type === "CASH_IN" ? "IN" : "OUT",
                amount: Number(tx.amount || 0),
                category: tx.category || "Operasional",
                categoryId: tx.categoryId || null,
                description: tx.description || "Draft AI",
                date: nowIso,
                createdBy: currentUser?.name || "Julia AI Copilot",
              });

              // If automatic stock update was checked and item is linked to an ingredient
              if (options?.updateStock && tx.ingredientId && Number(tx.quantity || 0) > 0) {
                addStockMovement({
                  ingredientId: tx.ingredientId,
                  type: "IN",
                  quantity: Number(tx.quantity),
                  unitCost: Number(tx.quantity) > 0 ? Math.round(Number(tx.amount) / Number(tx.quantity)) : 0,
                  totalCost: Number(tx.amount || 0),
                  date: nowIso,
                  note: `Input Cepat AI: ${tx.description}`,
                  createdBy: currentUser?.name || "Julia AI Copilot",
                });
              }
            });
            alert(
              `Berhasil menyimpan ${txs.length} transaksi dari AI ke Buku Kas!${
                options?.updateStock
                  ? " Stok bahan masuk juga telah diperbarui di gudang."
                  : ""
              }`
            );
          }
        }}
      />

      {/* ─── Export Center Modal ─── */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultModule={exportModalModule}
      />

      {/* ─── SIDEBAR (DESKTOP) ─── */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-slate-200/90 text-slate-800 transition-all duration-300 select-none z-40 ${
          isSidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-16 flex items-center px-4 bg-brand-gradient text-white border-b border-brand-800 ${
            isSidebarCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {isSidebarCollapsed ? (
              <img
                src={settings.logoDataUrl || "/logo-icon-color.png"}
                alt={settings.brandName || "Julia's"}
                className="w-9 h-9 object-contain rounded-xl shadow-xs"
              />
            ) : (
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={settings.logoDataUrl || "/logo-name-white.png"}
                  alt={settings.brandName || "Julia's"}
                  className="h-8 max-h-9 w-auto object-contain rounded-md"
                />
              </div>
            )}
          </div>

          {!isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Ciutkan Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {(() => {
            const groupedNav = navigation.reduce((acc, item) => {
              const g = item.group || "Lainnya";
              if (!acc[g]) acc[g] = [];
              acc[g].push(item);
              return acc;
            }, {} as Record<string, typeof navigation>);

            return Object.entries(groupedNav).map(([group, items]) => {
              const isExpanded = expandedGroups[group] ?? true;
              const isActiveGroup = items.some(
                (i) => i.view === currentView || (i.group === "Dasbor" && currentView.startsWith("dashboard_"))
              );

              if (isSidebarCollapsed) {
                return (
                  <div key={group} className="py-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        currentView === item.view ||
                        (item.group === "Dasbor" && currentView.startsWith("dashboard_"));
                      return (
                        <button
                          key={item.view}
                          onClick={() => onViewChange(item.view)}
                          title={`${item.name} (${group})`}
                          className={`w-full flex items-center justify-center p-2.5 rounded-xl text-sm transition-all mb-1 cursor-pointer ${
                            isActive
                              ? "bg-brand-600 text-white font-bold shadow-xs"
                              : "text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                          }`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                        </button>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div key={group} className="mb-2">
                  <button
                    onClick={() => toggleGroup(group)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      isActiveGroup ? "text-brand-800 font-bold" : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    <span>{group}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="mt-0.5 space-y-0.5">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                          currentView === item.view ||
                          (item.group === "Dasbor" && currentView.startsWith("dashboard_"));
                        return (
                          <button
                            key={item.view}
                            onClick={() => onViewChange(item.view)}
                            className="relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer text-left transition-colors"
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeSidebarPill"
                                className="absolute inset-0 bg-brand-50 border-l-3 border-brand-600 rounded-xl shadow-2xs z-0"
                                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                              />
                            )}
                            <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                              <Icon
                                className={`w-4 h-4 shrink-0 transition-transform ${
                                  isActive ? "text-brand-600 scale-105" : "text-slate-400"
                                }`}
                              />
                              <span
                                className={`truncate ${
                                  isActive ? "text-brand-950 font-bold" : "text-slate-600 hover:text-slate-900"
                                }`}
                              >
                                {item.name}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </nav>

        {/* Footer Operator Card & Actions (Desktop Sidebar) */}
        <div className={`p-3 border-t border-slate-100 bg-[#FAFBFF] ${isSidebarCollapsed ? "flex flex-col items-center gap-2" : "space-y-2"}`}>
          <div className="flex items-center gap-2.5">
            <div
              title={isSidebarCollapsed ? `${currentUser?.name} (${currentUser?.role})` : undefined}
              className="w-9 h-9 shrink-0 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 font-bold border border-brand-200 text-xs shadow-xs"
            >
              {currentUser?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                  {currentUser?.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${roleTheme.bg}`}>
                    {roleTheme.icon} {roleTheme.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {!isSidebarCollapsed ? (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                onClick={() => setIsSwitchAccountOpen(true)}
                className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Beralih Operator"
              >
                <KeyRound className="w-3.5 h-3.5 text-brand-600" />
                <span>Ganti Akun</span>
              </button>
              <button
                onClick={() => logout()}
                className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Keluar dari Sistem"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 w-full">
              <button
                onClick={() => setIsSwitchAccountOpen(true)}
                title="Ganti Akun Cepat"
                className="flex items-center justify-center p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <KeyRound className="w-4 h-4 text-brand-600" />
              </button>
              <button
                onClick={() => logout()}
                title="Keluar"
                className="flex items-center justify-center p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── MAIN CONTENT WRAPPER ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f6f8ff]">
        {/* ─── MODERN HEADER BAR (RESPONSIVE & NOTCH-SAFE) ─── */}
        <header className="h-16 min-h-[4rem] px-3 sm:px-6 bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 flex items-center justify-between shadow-xs gap-2 safe-area-top">
          {/* Left: Sidebar Toggle & Page Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Desktop / Tablet Sidebar Toggle */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex text-slate-500 hover:text-slate-900 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs shrink-0"
              aria-label="Toggle Sidebar"
              title={isSidebarCollapsed ? "Perluas Sidebar" : "Ciutkan Sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeft className="w-4 h-4 text-brand-600" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </motion.button>

            {/* Mobile Hamburger Burger Button (Smooth Touch Ergonomics & Icon Morph) */}
            <motion.button
              whileTap={{ scale: 0.90 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200/70 transition-colors cursor-pointer shadow-2xs shrink-0 focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label={isMobileMenuOpen ? "Tutup Menu Navigasi" : "Buka Menu Navigasi"}
              aria-expanded={isMobileMenuOpen}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isMobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <X className="w-5 h-5 text-slate-800" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <Menu className="w-5 h-5 text-slate-800" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Breadcrumb Title */}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                {{
                  dashboard_owner: "Dashboard Eksekutif Owner",
                  dashboard_employee: "Portal Karyawan & Tim",
                  dashboard_manager: "Dashboard Operasional Manajer",
                  dashboard_finance: "Dashboard Keuangan",
                  dashboard_inventory: "Dashboard Inventori",
                  cash_flow: "Buku Kas & Arus Kas",
                  expense_categories: "Kategori Kas & Biaya",
                  finance_reports: "Laporan Laba Rugi & Keuangan",
                  bank_reconciliation: "Rekonsiliasi Bank & QRIS",
                  inventory: "Stok Bahan Baku & Opname",
                  import_sales: "Rekap & Impor Penjualan",
                  users: "Manajemen Pengguna & PIN",
                  audit_log: "Audit Log Aktivitas",
                  shifts: "Shift & Kas Laci Kasir",
                  suppliers: "Pemasok / Supplier",
                  purchases: "Pembelian Bahan Baku (PO)",
                  settings: "Pengaturan Sistem",
                  hr: "Data Karyawan & Kontrak",
                  payroll: "Penggajian (Payroll)",
                  attendance_clock: "Presensi & Clock In",
                  leader_checklist: "Checklist Supervisi Leader",
                  hpp_calculator: "Kalkulator & HPP Menu",
                  menu_management: "Katalog & Menu Produk",
                }[currentView] || currentView}
              </h2>
            </div>
          </div>

          {/* Right Header: AI, Export, Clock, Profile Capsule */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Live Clock Pill (Desktop Only) */}
            <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold">
                {currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>

            {/* AI Assistant Button */}
            {canAccessAIAssistant && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsAIAssistantOpen(true)}
                title="Julia Coffee AI Copilot & Business Consultant"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 transition-colors shadow-2xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-600 stroke-[2.2]" />
                <span className="hidden xl:inline">AI Copilot</span>
              </motion.button>
            )}

            {/* Export Center Button */}
            {canAccessBusinessReports && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (currentView === "import_sales") setExportModalModule("sales");
                  else if (currentView === "inventory" || currentView === "purchases")
                    setExportModalModule("inventory");
                  else if (currentView === "finance_reports" || currentView === "cash_flow")
                    setExportModalModule("finance");
                  else if (currentView === "payroll")
                    setExportModalModule("payroll");
                  else if (currentView === "attendance_clock" || currentView === "shifts")
                    setExportModalModule("attendance");
                  else if (currentView === "hr")
                    setExportModalModule("payroll");
                  else setExportModalModule("executive");
                  setIsExportModalOpen(true);
                }}
                title="Pusat Ekspor Multi-Format"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden xl:inline">Ekspor & Laporan</span>
              </motion.button>
            )}

            {/* Cloud Sync Status */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => syncData()}
              title="Sinkronisasi Cloud DB"
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                isSyncing
                  ? "bg-brand-50 border-brand-300 text-brand-900"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-brand-600" : ""}`} />
              <span className="hidden 2xl:inline">{isSyncing ? "Sync..." : "Cloud"}</span>
            </motion.button>

            {/* ─── INTERACTIVE OPERATOR CAPSULE (ACCOUNT SWITCHER TRIGGER) ─── */}
            <div className="relative" ref={dropdownRef}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2 p-1.5 pl-1.5 sm:pl-2 pr-2 sm:pr-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
              >
                <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  {currentUser?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="hidden xl:flex flex-col items-start text-left">
                  <span className="text-xs font-bold text-slate-900 line-clamp-1 leading-tight">
                    {currentUser?.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium leading-tight">
                    {roleTheme.label}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isUserDropdownOpen ? "rotate-180" : ""}`}
                />
              </motion.button>

              {/* Dropdown Floating Menu */}
              <AnimatePresence>
                {isUserDropdownOpen && (
                  <motion.div
                    key="user-dropdown-menu"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 origin-top-right"
                  >
                    {/* Operator Info */}
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {currentUser?.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        @{currentUser?.username}
                      </p>
                      <div className="mt-2">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleTheme.bg}`}>
                          {roleTheme.icon} Peran: {currentUser?.role}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-1.5 space-y-0.5">
                      {/* Fast Switch Account */}
                      <button
                        onClick={() => {
                          setIsUserDropdownOpen(false);
                          setIsSwitchAccountOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4 text-brand-600" />
                        <span>Ganti Akun Operator (Switch)</span>
                      </button>

                      {canAccessBusinessReports && (
                        <button
                          onClick={() => {
                            setIsUserDropdownOpen(false);
                            setExportModalModule("executive");
                            setIsExportModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                          <span>Pusat Ekspor & Laporan</span>
                        </button>
                      )}

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        onClick={() => {
                          setIsUserDropdownOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-600" />
                        <span>Keluar (Logout)</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ─── FLUID RESPONSIVE DASHBOARD SUB-BAR (ADAPTIVE FOR ALL DEVICES & NOTCH) ─── */}
        {currentView.startsWith("dashboard_") && ["SUPER_ADMIN", "OWNER"].includes(currentUser?.role || "") && (
          <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 py-2 sticky top-16 z-20 shadow-2xs flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-inner w-full sm:w-auto">
              {DASHBOARD_TABS.map((tab) => {
                const isActive = currentView === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onViewChange(tab.id)}
                    className={`relative px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer select-none flex-1 sm:flex-initial text-center ${
                      isActive
                        ? "text-slate-900 font-bold"
                        : "text-slate-500 hover:text-slate-800 font-medium"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeDashboardSubPill"
                        className="absolute inset-0 bg-white rounded-xl shadow-xs border border-slate-200/80 z-0"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Quick Live Status Hint on Desktop */}
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200/60 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Analitik Bisnis & Operasional Real-time</span>
            </div>
          </div>
        )}

        {/* ─── MOBILE DRAWER MENU (ULTRA SMOOTH 60/120FPS GPU SPRING ANIMATION & SWIPE-TO-CLOSE) ─── */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex">
              {/* Backdrop with smooth fade transition */}
              <motion.div
                key="mobile-drawer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-hidden="true"
              />

              {/* Drawer Container with iOS-style spring easing and hardware acceleration */}
              <motion.div
                key="mobile-drawer-panel"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{
                  type: "spring",
                  damping: 32,
                  stiffness: 340,
                  mass: 0.75,
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.4, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60 || info.velocity.x < -300) {
                    setIsMobileMenuOpen(false);
                  }
                }}
                className="relative w-76 max-w-[85vw] bg-white border-r border-slate-200 text-slate-800 h-full flex flex-col z-10 shadow-2xl safe-area-top safe-area-bottom will-change-transform touch-pan-y"
              >
                {/* Drawer Header */}
                <div className="p-4 border-b border-brand-800 flex items-center justify-between bg-brand-gradient text-white shrink-0">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={settings.logoDataUrl || "/logo-name-white.png"}
                      alt={settings.brandName || "Julia's"}
                      className="h-8 w-auto object-contain rounded-md"
                    />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
                    aria-label="Tutup Menu"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Operator Profile Capsule in Mobile Drawer */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3 shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                    {currentUser?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUser?.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${roleTheme.bg}`}>
                        {roleTheme.icon} {roleTheme.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Navigation List */}
                <nav className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {(() => {
                    const groupedNav = navigation.reduce((acc, item) => {
                      const g = item.group || "Lainnya";
                      if (!acc[g]) acc[g] = [];
                      acc[g].push(item);
                      return acc;
                    }, {} as Record<string, typeof navigation>);

                    return Object.entries(groupedNav).map(([group, items]) => (
                      <div key={group} className="space-y-1">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {group}
                        </div>
                        {items.map((item) => {
                          const Icon = item.icon;
                          const isActive =
                            currentView === item.view ||
                            (item.group === "Dasbor" && currentView.startsWith("dashboard_"));
                          return (
                            <motion.button
                              key={item.view}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => {
                                onViewChange(item.view);
                                setIsMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                isActive
                                  ? "bg-brand-50 text-brand-950 font-bold border-l-3 border-brand-600 shadow-2xs"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
                              }`}
                            >
                              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
                              <span className="truncate">{item.name}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </nav>

                {/* Mobile Drawer Footer */}
                <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-2 shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsSwitchAccountOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs active:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-brand-600" />
                    Ganti Akun
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 active:bg-rose-100 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── PAGE BODY CONTAINER ─── */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-[#f6f8ff] relative z-10 custom-scrollbar safe-area-bottom">
          {/* View-Only Alert for Owner */}
          {currentUser?.role === "OWNER" && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-brand-50/80 border border-brand-200 rounded-2xl text-brand-900 text-xs shadow-2xs">
              <Eye className="w-4 h-4 shrink-0 text-brand-600" />
              <div>
                <strong className="font-bold">Mode Pantau (View Only): </strong>
                <span>Anda masuk sebagai <strong>Owner</strong> — melihat laporan dan analitik real-time.</span>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.main
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-7xl mx-auto h-full"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
