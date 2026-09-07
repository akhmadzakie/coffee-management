import React, { useState, useRef, useEffect } from "react";
import { ViewState } from "../types";
import { useTranslation } from "../utils/i18n";
import { useStore } from "../store/StoreContext";
import { SwitchAccountModal } from "./SwitchAccountModal";
import { ExportModal } from "./ExportModal";
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
  Settings,
  Truck,
  ShoppingBag,
  ShieldCheck,
  LogOut,
  Cloud,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  UserCheck,
  Download,
  FileSpreadsheet,
  BadgePercent,
  X,
  Tag,
  BarChart3,
  CreditCard,
  Calculator,
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
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isSwitchAccountOpen, setIsSwitchAccountOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalModule, setExportModalModule] = useState<
    "sales" | "inventory" | "finance" | "executive"
  >("sales");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { settings, isSyncing, lastSyncTime, syncData, currentUser, logout } =
    useStore();
  const { t } = useTranslation(settings.language || "id");

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

  const allNavigation = [
    {
      name: t("dashboard") || "Dashboard",
      view: "dashboard" as ViewState,
      icon: LayoutDashboard,
    },
    // ─── Finance Group ───────────────────────────────────────────
    {
      name: t("cash_flow") || "Arus Kas",
      view: "cash_flow" as ViewState,
      icon: Wallet,
    },
    {
      name: "Kategori Keuangan",
      view: "expense_categories" as ViewState,
      icon: Tag,
    },
    {
      name: "Laporan Keuangan",
      view: "finance_reports" as ViewState,
      icon: BarChart3,
    },
    {
      name: "Rekonsiliasi Bank",
      view: "bank_reconciliation" as ViewState,
      icon: CreditCard,
    },
    // ─── Operations Group ────────────────────────────────────────
    {
      name: t("inventory") || "Inventori",
      view: "inventory" as ViewState,
      icon: Warehouse,
    },
    {
      name: t("import_sales") || "Impor Penjualan",
      view: "import_sales" as ViewState,
      icon: ReceiptText,
    },
    // ─── HR Group ────────────────────────────────────────────────
    {
      name: "SDM & HRD",
      view: "hr" as ViewState,
      icon: UserCheck,
    },
    {
      name: "Penggajian (Payroll)",
      view: "payroll" as ViewState,
      icon: Calculator,
    },
    // ─── Admin Group ─────────────────────────────────────────────
    { name: t("users") || "Pengguna", view: "users" as ViewState, icon: Users },
    {
      name: t("audit_log") || "Audit Log",
      view: "audit_log" as ViewState,
      icon: ShieldCheck,
    },
    {
      name: t("shifts") || "Shift & Kasir",
      view: "shifts" as ViewState,
      icon: Coffee,
    },
    {
      name: t("suppliers") || "Supplier",
      view: "suppliers" as ViewState,
      icon: Truck,
    },
    {
      name: t("purchases") || "Pembelian (PO)",
      view: "purchases" as ViewState,
      icon: ShoppingBag,
    },
    {
      name: t("settings") || "Pengaturan",
      view: "settings" as ViewState,
      icon: Settings,
    },
  ];

  const roleAccess: Record<string, ViewState[]> = {
    SUPER_ADMIN: ["dashboard", "cash_flow", "expense_categories", "finance_reports", "bank_reconciliation", "inventory", "import_sales", "hr", "payroll", "users", "audit_log", "shifts", "suppliers", "purchases", "settings"],
    OWNER: ["dashboard", "cash_flow", "finance_reports", "hr", "payroll", "inventory", "shifts"],
    MANAGER: ["dashboard", "cash_flow", "inventory", "import_sales", "hr", "payroll", "shifts", "suppliers", "purchases"],
    FINANCE: ["dashboard", "cash_flow", "expense_categories", "finance_reports", "bank_reconciliation", "payroll", "purchases", "audit_log"],
    KASIR: ["shifts", "import_sales"],
  };

  const allowedViews = currentUser ? roleAccess[currentUser.role] || [] : [];
  const navigation = allNavigation.filter((nav) => allowedViews.includes(nav.view));

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Switch Account Modal */}
      <SwitchAccountModal
        isOpen={isSwitchAccountOpen}
        onClose={() => setIsSwitchAccountOpen(false)}
      />

      {/* Export & Business Reports Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultModule={exportModalModule}
      />

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-primary border-r border-slate-700/50 text-secondary">
        <div className="p-6 border-b border-slate-700/50 flex items-center gap-3">
          {settings.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={settings.brandName}
              className="h-8 w-auto max-w-[120px] object-contain"
            />
          ) : (
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
              {settings.brandName
                ? settings.brandName.substring(0, 2).toUpperCase()
                : "NS"}
            </div>
          )}
          <span className="text-lg font-bold tracking-tight text-white line-clamp-1">
            {settings.brandName}
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2 mt-2">
            Modules
          </div>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.name}
                onClick={() => onViewChange(item.view)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-accent/20 text-accent font-medium"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${isActive ? "text-accent" : "text-slate-400"}`}
                />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card & Actions - Desktop Sidebar */}
        <div className="p-4 border-t border-slate-700/50 bg-black/20 space-y-3">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold border border-accent/30">
              {currentUser?.name.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {currentUser?.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent uppercase border border-accent/30">
                  {currentUser?.role}
                </span>
                <span className="text-xs text-slate-400 truncate">
                  @{currentUser?.username}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setIsSwitchAccountOpen(true)}
              className="flex items-center justify-center px-2 py-1.5 text-xs font-medium text-slate-300 bg-[#132F4C] hover:bg-[#1A3A5A] border border-[#1A3A5A] rounded-lg transition-colors shadow-2xs"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Ganti Akun
            </button>
            <button
              onClick={() => logout()}
              className="flex items-center justify-center px-2 py-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Mobile & Desktop */}
        <header className="flex justify-between items-center p-4 sm:p-6 bg-transparent relative z-20">
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900 p-1.5 rounded-lg bg-white border border-slate-200 mr-2.5 shadow-2xs"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            {settings.logoDataUrl ? (
              <img
                src={settings.logoDataUrl}
                alt={settings.brandName}
                className="h-6 w-auto object-contain mr-2"
              />
            ) : null}
            <span className="font-bold text-slate-800 text-sm line-clamp-1">
              {settings.brandName}
            </span>
          </div>

          <div className="hidden md:block">
            <h2 className="text-2xl font-bold text-slate-800 capitalize">
              {{
                dashboard: "Ringkasan Dashboard",
                cash_flow: "Arus Kas",
                inventory: "Manajemen Inventori",
                import_sales: "Impor Data Penjualan",
                users: "Manajemen Pengguna",
                audit_log: "Audit Log Sistem",
                shifts: "Manajemen Shift & Kasir",
                suppliers: "Manajemen Pemasok",
                purchases: "Pembelian & Purchase Order",
                settings: "Pengaturan Sistem",
              }[currentView] || currentView}
            </h2>
            <p className="text-sm text-slate-500">
              Pantau dan kelola operasional kedai kopi Anda.
            </p>
          </div>

          <div className="flex gap-2.5 items-center">
            {/* Export & Business Reports Center Button */}
            <button
              onClick={() => {
                // Preselect module based on currentView if applicable
                if (currentView === "sales") setExportModalModule("sales");
                else if (currentView === "inventory")
                  setExportModalModule("inventory");
                else if (currentView === "finance")
                  setExportModalModule("finance");
                else setExportModalModule("executive");
                setIsExportModalOpen(true);
              }}
              title="Pusat Ekspor Laporan CSV & PDF Resmi"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Ekspor & Laporan</span>
            </button>

            {/* Cloud Sync Status Indicator */}
            <button
              onClick={() => syncData()}
              title="Sinkronisasi Cloud Database (Klik untuk update data manual)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isSyncing
                  ? "bg-amber-50 border-amber-200 text-amber-700 shadow-2xs"
                  : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 shadow-2xs"
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span className="hidden sm:inline">
                {isSyncing ? "Menyinkronkan..." : "Cloud DB Aktif"}
              </span>
            </button>

            <div className="hidden sm:flex flex-col items-end mr-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Current Date
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {new Date().toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            {/* Interactive User Dropdown Header */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full md:rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-2xs"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200 text-xs">
                  {currentUser?.name.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="hidden md:flex flex-col items-start text-left">
                  <span className="text-xs font-bold text-slate-800 line-clamp-1 leading-tight">
                    {currentUser?.name}
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold leading-tight">
                    {currentUser?.role}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isUserDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown Floating Menu */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUser?.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      @{currentUser?.username}
                    </p>
                    <div className="mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                        Peran: {currentUser?.role}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        setExportModalModule("executive");
                        setIsExportModalOpen(true);
                      }}
                      className="w-full flex items-center px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2.5 text-blue-600" />
                      Pusat Ekspor & Laporan
                    </button>
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        setIsSwitchAccountOpen(true);
                      }}
                      className="w-full flex items-center px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <UserCheck className="w-4 h-4 mr-2.5 text-blue-600" />
                      Ganti Akun / Switch User
                    </button>
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 mr-2.5" />
                      Keluar / Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-primary border-b border-slate-700/50 shadow-lg relative z-10 animate-in slide-in-from-top-2 duration-150">
            {/* User Profile on Mobile Menu */}
            <div className="p-4 bg-black/20 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold border border-accent/30">
                  {currentUser?.name.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {currentUser?.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent uppercase border border-accent/30">
                      {currentUser?.role}
                    </span>
                    <span className="text-xs text-slate-400">
                      @{currentUser?.username}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <nav className="p-3 space-y-1 max-h-[60vh] overflow-y-auto">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.view;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      onViewChange(item.view);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-accent/20 text-accent font-medium"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${isActive ? "text-accent" : "text-slate-400"}`}
                    />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>

            {/* Fast Action Buttons in Mobile Menu */}
            <div className="p-3 bg-black/20 border-t border-slate-700/50 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSwitchAccountOpen(true);
                }}
                className="flex items-center justify-center py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium text-xs rounded-xl shadow-2xs transition-colors"
              >
                <UserCheck className="w-4 h-4 mr-1.5 text-slate-400" />
                Ganti Akun
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center justify-center py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-medium text-xs rounded-xl shadow-2xs transition-colors"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Keluar
              </button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 backdrop-blur-sm relative z-10 rounded-tl-2xl border-t border-l border-slate-200/50 shadow-inner">
          <AnimatePresence mode="wait">
            <motion.main
              key={currentView}
              initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
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
