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

  const { settings, isSyncing, lastSyncTime, syncData, currentUser, logout } = useStore();
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
    // ─── Operations & POS Group ──────────────────────────────────
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
      name: "Checklist Jobdesk",
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
    ],
    KASIR: [
      "dashboard_employee",
      "shifts",
      "leader_checklist",
      "import_sales",
      "attendance_clock",
    ],
    LEADER: [
      "dashboard_employee",
      "hr",
      "leader_checklist",
      "dashboard_inventory",
      "inventory",
      "shifts",
      "suppliers",
      "purchases",
      "attendance_clock",
    ],
    BAR: ["dashboard_employee", "attendance_clock", "leader_checklist"],
    KITCHEN: ["dashboard_employee", "attendance_clock", "leader_checklist"],
    BAKER: ["dashboard_employee", "attendance_clock", "leader_checklist"],
  };

  const allowedViews = currentUser ? (roleAccess[currentUser.role] || ALL_VIEWS) : [];
  const navigation = allNavigation.filter((nav) => allowedViews.includes(nav.view));
  const canAccessBusinessReports = Boolean(
    currentUser &&
      ["OWNER", "MANAGER", "FINANCE", "SUPER_ADMIN"].includes(currentUser.role)
  );
  const canAccessAIAssistant = Boolean(
    currentUser &&
      ["FINANCE", "MANAGER", "SUPER_ADMIN"].includes(currentUser.role)
  );

  const getRoleTheme = (role?: string) => {
    switch (role?.toUpperCase()) {
      case "SUPER_ADMIN":
      case "OWNER":
        return { label: "Owner", bg: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: "👑" };
      case "MANAGER":
        return { label: "Manager", bg: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", icon: "💼" };
      case "FINANCE":
        return { label: "Finance", bg: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: "📊" };
      case "KASIR":
        return { label: "Kasir POS", bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: "💳" };
      case "LEADER":
        return { label: "Leader Bar", bg: "bg-orange-500/15 text-orange-300 border-orange-500/30", icon: "☕" };
      default:
        return { label: role || "Staff", bg: "bg-slate-500/15 text-slate-300 border-slate-500/30", icon: "👤" };
    }
  };

  const roleTheme = getRoleTheme(currentUser?.role);

  return (
    <div className="min-h-screen bg-[#070A0F] flex antialiased">
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
          alert(`Transaksi dari AI akan ditambahkan:\n` + JSON.stringify(txs, null, 2));
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
        className={`hidden md:flex flex-col bg-[#090D14] border-r border-slate-800/80 text-slate-200 transition-all duration-300 select-none z-40 ${
          isSidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-16 border-b border-slate-800/80 flex items-center px-4 ${
            isSidebarCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {settings.logoDataUrl ? (
              <img
                src={settings.logoDataUrl}
                alt={settings.brandName}
                className={`h-8 w-auto object-contain rounded-lg ${isSidebarCollapsed ? "max-w-[40px]" : "max-w-[120px]"}`}
              />
            ) : (
              <div className="w-9 h-9 shrink-0 bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 rounded-xl flex items-center justify-center text-slate-950 font-black shadow-sm shadow-amber-500/20">
                <Coffee className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-black tracking-tight text-white truncate">
                  {settings.brandName || "COFFEE POS"}
                </h1>
                <p className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase">
                  Management v2.5
                </p>
              </div>
            )}
          </div>

          {!isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
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
                              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30"
                              : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
                          }`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-slate-950" : "text-slate-400"}`} />
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
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                      isActiveGroup ? "text-amber-400 font-extrabold" : "text-slate-500 hover:text-slate-300"
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
                    <div className="mt-1 space-y-0.5">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.view;
                        return (
                          <button
                            key={item.view}
                            onClick={() => onViewChange(item.view)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              isActive
                                ? "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent text-amber-300 border-l-3 border-amber-500 shadow-xs"
                                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-transform ${
                                isActive ? "text-amber-400 scale-110" : "text-slate-500"
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
        <div className={`p-3 border-t border-slate-800/80 bg-slate-950/60 ${isSidebarCollapsed ? "flex flex-col items-center gap-2" : "space-y-2"}`}>
          <div className="flex items-center gap-2.5">
            <div
              title={isSidebarCollapsed ? `${currentUser?.name} (${currentUser?.role})` : undefined}
              className="w-9 h-9 shrink-0 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold border border-amber-500/30 text-xs shadow-xs"
            >
              {currentUser?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {currentUser?.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleTheme.bg}`}>
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
                className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-all cursor-pointer"
                title="Beralih Operator"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Ganti Akun</span>
              </button>
              <button
                onClick={() => logout()}
                className="flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
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
                className="flex items-center justify-center p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
              </button>
              <button
                onClick={() => logout()}
                title="Keluar"
                className="flex items-center justify-center p-2 text-rose-300 hover:text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── MAIN CONTENT WRAPPER ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#070A0F]">
        {/* ─── MODERN HEADER BAR ─── */}
        <header className="h-16 px-4 sm:px-6 bg-[#0B0F17]/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-30 flex items-center justify-between shadow-xs">
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
              className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
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
                  }[currentView] || currentView}
                </h2>
              </div>
            </div>
          </div>

          {/* Right Header: AI, Export, Clock, Profile Capsule */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Clock Pill (Desktop) */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>

            {/* AI Assistant Button */}
            {canAccessAIAssistant && (
              <button
                onClick={() => setIsAIAssistantOpen(true)}
                title="Magic AI Assistant (Catat dari Nota/Teks)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 transition-all shadow-sm shadow-amber-500/20 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">AI Asisten</span>
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Ekspor & Laporan</span>
              </button>
            )}

            {/* Cloud Sync Status */}
            <button
              onClick={() => syncData()}
              title="Sinkronisasi Cloud DB"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                isSyncing
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-amber-400" : ""}`} />
              <span className="hidden md:inline">{isSyncing ? "Sync..." : "Cloud"}</span>
            </button>

            {/* ─── INTERACTIVE OPERATOR CAPSULE (ACCOUNT SWITCHER TRIGGER) ─── */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2 p-1.5 pl-2 pr-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all cursor-pointer shadow-xs"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-xs">
                  {currentUser?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="hidden sm:flex flex-col items-start text-left">
                  <span className="text-xs font-bold text-white line-clamp-1 leading-tight">
                    {currentUser?.name}
                  </span>
                  <span className="text-[10px] text-amber-400 font-semibold leading-tight">
                    {roleTheme.icon} {roleTheme.label}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isUserDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown Floating Menu */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#0B0F17] rounded-2xl shadow-2xl border border-slate-800/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl">
                  {/* Operator Info */}
                  <div className="px-4 py-3 border-b border-slate-800/80">
                    <p className="text-xs font-bold text-white truncate">
                      {currentUser?.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      @{currentUser?.username}
                    </p>
                    <div className="mt-2">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${roleTheme.bg}`}>
                        {roleTheme.icon} Peran: {currentUser?.role}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-1 space-y-0.5">
                    {/* Fast Switch Account */}
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        setIsSwitchAccountOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10 rounded-xl transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>Ganti Akun Operator (Switch)</span>
                    </button>

                    {canAccessBusinessReports && (
                      <button
                        onClick={() => {
                          setIsUserDropdownOpen(false);
                          setExportModalModule("executive");
                          setIsExportModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800/70 rounded-xl transition-colors cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                        <span>Pusat Ekspor & Laporan</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar / Logout</span>
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
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Drawer Container */}
            <div className="relative w-72 max-w-[85vw] bg-[#090D14] border-r border-slate-800 text-slate-200 h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">{settings.brandName}</h3>
                    <span className="text-[10px] text-amber-400 font-semibold">POS Menu</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Navigation List */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
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
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-slate-950" : "text-slate-400"}`} />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Mobile Drawer Footer */}
              <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsSwitchAccountOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-slate-200 text-xs font-bold rounded-xl"
                >
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  Ganti Akun
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-500/15 text-rose-400 text-xs font-bold rounded-xl border border-rose-500/30"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── PAGE BODY CONTAINER ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0E131F]/40 relative z-10 custom-scrollbar">
          {/* View-Only Alert for Owner */}
          {currentUser?.role === "OWNER" && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs">
              <Eye className="w-4 h-4 shrink-0 text-amber-400" />
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
