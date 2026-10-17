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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isSwitchAccountOpen, setIsSwitchAccountOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalModule, setExportModalModule] = useState<
    "sales" | "inventory" | "finance" | "payroll" | "attendance" | "kpi" | "executive"
  >("sales");
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Dasbor: true,
    Operasi: true,
    SDM: true,
    Keuangan: false,
    Admin: false,
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

  // ─── Semua item navigasi dengan grup visual ─────────────────────────────
  const allNavigation = [
    // ─── Dashboard Group ─────────────────────────────────────────
    { 
      group: "Dasbor",
      name: "Dashboard Eksekutif",
      view: "dashboard_owner" as ViewState,
      icon: TrendingUp,
    },
    { 
      group: "Dasbor",
      name: "Dashboard Karyawan",
      view: "dashboard_employee" as ViewState,
      icon: LayoutDashboard,
    },
    { 
      group: "Dasbor",
      name: "Dashboard Manajer",
      view: "dashboard_manager" as ViewState,
      icon: Store,
    },
    { 
      group: "Dasbor",
      name: "Dashboard Keuangan",
      view: "dashboard_finance" as ViewState,
      icon: Wallet,
    },
    { 
      group: "Dasbor",
      name: "Dashboard Inventori",
      view: "dashboard_inventory" as ViewState,
      icon: Package,
    },
    // ─── Operations Group (POS & KDS run standalone on /pos & /kds) ───
    { 
      group: "Operasi",
      name: t("shifts") || "Shift & Kasir",
      view: "shifts" as ViewState,
      icon: Coffee,
    },
    { 
      group: "Operasi",
      name: t("import_sales") || "Impor Penjualan",
      view: "import_sales" as ViewState,
      icon: ReceiptText,
    },
    { 
      group: "Operasi",
      name: t("inventory") || "Inventori & Stok",
      view: "inventory" as ViewState,
      icon: Warehouse,
    },
    { 
      group: "Operasi",
      name: t("purchases") || "Pembelian (PO)",
      view: "purchases" as ViewState,
      icon: ShoppingBag,
    },
    { 
      group: "Operasi",
      name: t("suppliers") || "Pemasok / Supplier",
      view: "suppliers" as ViewState,
      icon: Truck,
    },
    { 
      group: "Operasi",
      name: "Menu & Katalog Produk",
      view: "menu_management" as ViewState,
      icon: UtensilsCrossed,
    },
    { 
      group: "Operasi",
      name: "Kalkulator & Simulasi HPP",
      view: "hpp_calculator" as ViewState,
      icon: Calculator,
    },
    // ─── HR & Team Group ─────────────────────────────────────────
    { 
      group: "SDM",
      name: currentUser?.role === "LEADER" ? "Jadwal Shift Tim" : "SDM & HRD",
      view: "hr" as ViewState,
      icon: UserCheck,
    },
    { 
      group: "SDM",
      name: "Clock In / Absensi",
      view: "attendance_clock" as ViewState,
      icon: Calendar,
    },
    { 
      group: "SDM",
      name: (currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "OWNER")
        ? "Jobdesk Leader"
        : "Checklist Supervisi",
      view: "leader_checklist" as ViewState,
      icon: ClipboardCheck,
    },
    { 
      group: "SDM",
      name: "Penggajian (Payroll)",
      view: "payroll" as ViewState,
      icon: Calculator,
    },
    // ─── Finance Group ───────────────────────────────────────────
    { 
      group: "Keuangan",
      name: t("cash_flow") || "Arus Kas",
      view: "cash_flow" as ViewState,
      icon: Wallet,
    },
    { 
      group: "Keuangan",
      name: "Kategori Keuangan",
      view: "expense_categories" as ViewState,
      icon: Tag,
    },
    { 
      group: "Keuangan",
      name: "Laporan Keuangan",
      view: "finance_reports" as ViewState,
      icon: BarChart3,
    },
    { 
      group: "Keuangan",
      name: "Rekonsiliasi Bank",
      view: "bank_reconciliation" as ViewState,
      icon: CreditCard,
    },
    // ─── Admin Group ─────────────────────────────────────────────
    { 
      group: "Admin",
      name: t("users") || "Pengguna",
      view: "users" as ViewState,
      icon: Users,
    },
    { 
      group: "Admin",
      name: t("audit_log") || "Audit Log",
      view: "audit_log" as ViewState,
      icon: ShieldCheck,
    },
    { 
      group: "Admin",
      name: t("settings") || "Pengaturan",
      view: "settings" as ViewState,
      icon: Settings,
    },
  ];

  // ─── Role Access Matrix ───────────────────────────────────────────────────
  const ALL_VIEWS: ViewState[] = allNavigation.map((n) => n.view);

  const roleAccess: Record<string, ViewState[]> = {
    SUPER_ADMIN: ALL_VIEWS,
    OWNER: [
      "dashboard_owner",
      "dashboard_finance",
      "dashboard_manager",
      "cash_flow",
      "finance_reports",
      "menu_management",
      "hpp_calculator",
      "pos_cashier",
      "kitchen_display",
    ],
    MANAGER: [
      "dashboard_manager",
      "dashboard_owner",
      "dashboard_inventory",
      "inventory",
      "import_sales",
      "hr",
      "leader_checklist",
      "shifts",
      "suppliers",
      "purchases",
      "users",
      "audit_log",
      "menu_management",
      "hpp_calculator",
      "pos_cashier",
      "kitchen_display",
    ],
    FINANCE: [
      "dashboard_finance",
      "dashboard_owner",
      "cash_flow",
      "expense_categories",
      "finance_reports",
      "bank_reconciliation",
      "payroll",
      "purchases",
      "audit_log",
      "pos_cashier",
    ],
    KASIR: [
      "pos_cashier",
      "kitchen_display",
      "dashboard_employee",
      "shifts",
      "import_sales",
      "attendance_clock",
    ],
    LEADER: [
      "kitchen_display",
      "dashboard_employee",
      "hr",
      "leader_checklist",
      "dashboard_inventory",
      "inventory",
      "menu_management",
      "shifts",
      "suppliers",
      "purchases",
      "attendance_clock",
    ],
    BAR: ["kitchen_display", "dashboard_employee", "attendance_clock"],
    KITCHEN: ["kitchen_display", "dashboard_employee", "attendance_clock"],
    BAKER: ["kitchen_display", "dashboard_employee", "attendance_clock"],
  };

  const isEmployeeLeader = Boolean(
    currentUser &&
      (currentUser.role === "LEADER" ||
        employees?.some(
          (e: any) =>
            (e.username === currentUser.username || e.id === currentUser.employeeId) &&
            ((e.position || "").toUpperCase().includes("LEADER") ||
              (e.position || "").toUpperCase().includes("HEAD"))
        ))
  );

  const baseAllowed = currentUser ? (roleAccess[currentUser.role] || ALL_VIEWS) : [];
  const allowedViews = isEmployeeLeader && !baseAllowed.includes("leader_checklist")
    ? [...baseAllowed, "leader_checklist" as ViewState]
    : baseAllowed;
  const navigation = allNavigation.filter((nav) => allowedViews.includes(nav.view));
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
    <div className="min-h-screen bg-[#f6f8ff] flex antialiased text-slate-900">
      {/* ─── Switch Account Modal ─── */}
      <SwitchAccountModal
        isOpen={isSwitchAccountOpen}
        onClose={() => setIsSwitchAccountOpen(false)}
      />

      {/* ─── AI Assistant Modal ─── */}
      <AIAssistantModal
        isOpen={isAIAssistantOpen && canAccessAIAssistant}
        onClose={() => setIsAIAssistantOpen(false)}
        onApplyTransactions={(txs) => {
          if (Array.isArray(txs) && txs.length > 0) {
            const defaultAccountId = cashAccounts?.[0]?.id || "acc-main";
            txs.forEach((tx) => {
              addCashTransaction({
                accountId: defaultAccountId,
                type: tx.type === "CASH_IN" ? "IN" : "OUT",
                amount: Number(tx.amount || 0),
                category: tx.category || "Operasional",
                description: tx.description || "Draft AI",
                date: new Date().toISOString(),
                createdBy: currentUser?.name || "AI Assistant",
              });
            });
            alert(`Berhasil menyimpan ${txs.length} transaksi dari AI ke Buku Kas!`);
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
              const isActiveGroup = items.some((i) => i.view === currentView);

              if (isSidebarCollapsed) {
                return (
                  <div key={group} className="py-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.view;
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
                        const isActive = currentView === item.view;
                        return (
                          <button
                            key={item.view}
                            onClick={() => onViewChange(item.view)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              isActive
                                ? "bg-brand-50 text-brand-950 font-bold border-l-3 border-brand-600 shadow-2xs"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-transform ${
                                isActive ? "text-brand-600 scale-105" : "text-slate-400"
                              }`}
                            />
                            <span className="truncate">{item.name}</span>
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
        {/* ─── MODERN HEADER BAR ─── */}
        <header className="h-16 px-4 sm:px-6 bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 flex items-center justify-between shadow-xs">
          {/* Left: Sidebar Toggle & Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (window.innerWidth >= 768) {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                } else {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                }
              }}
              className="text-slate-500 hover:text-slate-900 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
              aria-label="Toggle Sidebar"
            >
              {isSidebarCollapsed ? (
                <PanelLeft className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>

            {/* Breadcrumb Title */}
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                {{
                  dashboard_owner: "Dashboard Eksekutif Owner",
                  dashboard_employee: "Portal Karyawan & Tim",
                  dashboard_manager: "Dashboard Operasional Manajer",
                  dashboard_finance: "Dashboard Keuangan",
                  dashboard_inventory: "Dashboard Inventori",
                  cash_flow: "Buku Kas & Arus Kas",
                  expense_categories: "Kategori Pengeluaran",
                  finance_reports: "Laporan Keuangan & Laba Rugi",
                  bank_reconciliation: "Rekonsiliasi Bank",
                  inventory: "Inventori & Resep",
                  import_sales: "Penjualan & Kasir POS",
                  users: "Manajemen Pengguna",
                  audit_log: "Audit Log & Keamanan",
                  shifts: "Manajemen Shift & Kasir",
                  suppliers: "Supplier & Pemasok",
                  purchases: "Pembelian Bahan Baku (PO)",
                  settings: "Pengaturan Sistem",
                  hr: "SDM, Jadwal & Kontrak",
                  payroll: "Penggajian (Payroll)",
                  attendance_clock: "Presensi & Clock In",
                  leader_checklist: "Checklist Jobdesk Harian",
                  hpp_calculator: "Kalkulator & Simulasi HPP Menu",
                }[currentView] || currentView}
              </h2>
            </div>
          </div>

          {/* Right Header: AI, Export, Clock, Profile Capsule */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Clock Pill (Desktop) */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold">
                {currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>

            {/* AI Assistant Button */}
            {canAccessAIAssistant && (
              <button
                onClick={() => setIsAIAssistantOpen(true)}
                title="Julia Coffee AI Copilot & Business Consultant"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 transition-all shadow-2xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-600 stroke-[2.2]" />
                <span className="hidden sm:inline">AI Copilot</span>
              </button>
            )}

            {/* Export Center Button */}
            {canAccessBusinessReports && (
              <button
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Ekspor & Laporan</span>
              </button>
            )}

            {/* Cloud Sync Status */}
            <button
              onClick={() => syncData()}
              title="Sinkronisasi Cloud DB"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                isSyncing
                  ? "bg-brand-50 border-brand-300 text-brand-900"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-brand-600" : ""}`} />
              <span className="hidden md:inline">{isSyncing ? "Sync..." : "Cloud"}</span>
            </button>

            {/* ─── INTERACTIVE OPERATOR CAPSULE (ACCOUNT SWITCHER TRIGGER) ─── */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2 p-1.5 pl-2 pr-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
              >
                <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {currentUser?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="hidden sm:flex flex-col items-start text-left">
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
              </button>

              {/* Dropdown Floating Menu */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
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
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ─── MOBILE DRAWER MENU ─── */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Drawer Container */}
            <div className="relative w-72 max-w-[85vw] bg-white border-r border-slate-200 text-slate-800 h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
              {/* Drawer Header */}
              <div className="p-4 border-b border-brand-800 flex items-center justify-between bg-brand-gradient text-white">
                <div className="flex items-center gap-2.5">
                  <img
                    src={settings.logoDataUrl || "/logo-name-white.png"}
                    alt={settings.brandName || "Julia's"}
                    className="h-8 w-auto object-contain rounded-md"
                  />
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Navigation List */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => {
                        onViewChange(item.view);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-brand-50 text-brand-900 font-bold border-l-3 border-brand-600"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-brand-600" : "text-slate-400"}`} />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Mobile Drawer Footer */}
              <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsSwitchAccountOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs"
                >
                  <KeyRound className="w-4 h-4 text-brand-600" />
                  Ganti Akun
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── PAGE BODY CONTAINER ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f6f8ff] relative z-10 custom-scrollbar">
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
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
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
