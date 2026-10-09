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
  Coffee, ClipboardCheck,
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
    "sales" | "inventory" | "finance" | "executive"
  >("sales");
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Dasbor: true,
    Keuangan: false,
    Operasi: false,
    SDM: false,
    Admin: false,
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

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

  // ─── Semua item navigasi dengan grup visual ─────────────────────────────
  const allNavigation = [
    // ─── Dashboard Group ─────────────────────────────────────────
    { group: "Dasbor",
      name: "Dashboard Keuangan",
      view: "dashboard_finance" as ViewState,
      icon: LayoutDashboard,
    },
    { group: "Dasbor",
      name: "Dashboard Inventori",
      view: "dashboard_inventory" as ViewState,
      icon: Package,
    },
    // ─── Finance Group ───────────────────────────────────────────
    { group: "Keuangan",
      name: t("cash_flow") || "Arus Kas",
      view: "cash_flow" as ViewState,
      icon: Wallet,
    },
    { group: "Keuangan",
      name: "Kategori Keuangan",
      view: "expense_categories" as ViewState,
      icon: Tag,
    },
    { group: "Keuangan",
      name: "Laporan Keuangan",
      view: "finance_reports" as ViewState,
      icon: BarChart3,
    },
    { group: "Keuangan",
      name: "Rekonsiliasi Bank",
      view: "bank_reconciliation" as ViewState,
      icon: CreditCard,
    },
    // ─── Operations Group ────────────────────────────────────────
    { group: "Operasi",
      name: t("inventory") || "Inventori",
      view: "inventory" as ViewState,
      icon: Warehouse,
    },
    { group: "Operasi",
      name: t("import_sales") || "Impor Penjualan",
      view: "import_sales" as ViewState,
      icon: ReceiptText,
    },
    { group: "Operasi",
      name: t("shifts") || "Shift & Kasir",
      view: "shifts" as ViewState,
      icon: Coffee, ClipboardCheck,
    },
    { group: "Operasi",
      name: t("suppliers") || "Supplier",
      view: "suppliers" as ViewState,
      icon: Truck,
    },
    { group: "Operasi",
      name: t("purchases") || "Pembelian (PO)",
      view: "purchases" as ViewState,
      icon: ShoppingBag,
    },
    // ─── HR Group ────────────────────────────────────────────────
    { group: "SDM",
      name: "SDM & HRD",
      view: "hr" as ViewState,
      icon: UserCheck,
    },
    { group: "SDM",
      name: "Clock In / Out",
      view: "attendance_clock" as ViewState,
      icon: Calendar,
    },
    { group: "SDM",
      name: "Penggajian (Payroll)",
      view: "payroll" as ViewState,
      icon: Calculator,
    },
    // --- SDM Group ---
    { group: "SDM",
      name: "Checklist Jobdesk",
      view: "leader_checklist" as ViewState,
      icon: ClipboardCheck,
    },
    // ─── Admin Group ─────────────────────────────────────────────
    { group: "Admin",
      name: t("users") || "Pengguna",
      view: "users" as ViewState,
      icon: Users,
    },
    { group: "Admin",
      name: t("audit_log") || "Audit Log",
      view: "audit_log" as ViewState,
      icon: ShieldCheck,
    },
    { group: "Admin",
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
      "dashboard_finance",
      "cash_flow",
      "finance_reports",
      "settings",
      "leader_checklist",
    ],
    MANAGER: [
      "dashboard_inventory",
      "inventory", "import_sales",
      "hr", "leader_checklist",
      "shifts", "suppliers", "purchases",
      "users",   // Manager bisa onboard staff (dibatasi role-nya di Users.tsx)
      "audit_log",
      "attendance_clock",
      "settings"
    ],
    FINANCE: [
      "dashboard_finance",
      "cash_flow", "expense_categories", "finance_reports", "bank_reconciliation",
      "payroll", "purchases",
      "audit_log",
      "attendance_clock"
    ],
    KASIR: [
      "shifts", "leader_checklist",
      "import_sales",
      "attendance_clock"
    ],
    LEADER: [
      "dashboard_inventory",
      "inventory",
      "shifts", "leader_checklist",
      "suppliers", "purchases",
      "attendance_clock"
    ],
    BAR: ["attendance_clock", "leader_checklist"],
    KITCHEN: ["attendance_clock", "leader_checklist"],
    BAKER: ["attendance_clock", "leader_checklist"],
  };

  const allowedViews = currentUser ? (roleAccess[currentUser.role] || ALL_VIEWS) : [];
  const navigation = allNavigation.filter((nav) => allowedViews.includes(nav.view));

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Switch Account Modal */}
      <SwitchAccountModal
        isOpen={isSwitchAccountOpen}
        onClose={() => setIsSwitchAccountOpen(false)}
      />

      {/* AI Assistant Modal */}
      <AIAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        onApplyTransactions={(txs) => {
          // Temporarily just alert until we hook it to StoreContext
          alert(`Transaksi dari AI akan ditambahkan:\n` + JSON.stringify(txs, null, 2));
        }}
      />

      {/* Export & Business Reports Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultModule={exportModalModule}
      />

      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col bg-primary border-r border-slate-700/50 text-secondary transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`p-6 border-b border-slate-700/50 flex items-center ${isSidebarCollapsed ? 'justify-center px-4' : 'gap-3'}`}>
          {settings.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={settings.brandName}
              className={`h-8 w-auto object-contain ${isSidebarCollapsed ? 'max-w-[40px]' : 'max-w-[120px]'}`}
            />
          ) : (
            <div className="w-8 h-8 shrink-0 bg-accent rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
              {settings.brandName
                ? settings.brandName.substring(0, 2).toUpperCase()
                : "NS"}
            </div>
          )}
          {!isSidebarCollapsed && (
            <span className="text-lg font-bold tracking-tight text-white line-clamp-1">
              {settings.brandName}
            </span>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {(() => {
            const groupedNav = navigation.reduce((acc, item) => {
              const g = item.group || "Lainnya";
              if (!acc[g]) acc[g] = [];
              acc[g].push(item);
              return acc;
            }, {} as Record<string, typeof navigation>);

            return Object.entries(groupedNav).map(([group, items]) => {
              const isExpanded = expandedGroups[group];
              const isActiveGroup = items.some(i => i.view === currentView);

              if (isSidebarCollapsed) {
                return (
                  <React.Fragment key={group}>
                    {items.map(item => {
                      const Icon = item.icon;
                      const isActive = currentView === item.view;
                      return (
                        <button
                          key={item.view}
                          onClick={() => onViewChange(item.view)}
                          title={item.name}
                          className={`w-full flex items-center justify-center p-2 rounded-lg text-sm transition-colors mb-1 ${
                            isActive
                              ? "bg-accent/20 text-accent font-medium"
                              : "text-slate-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-accent" : "text-slate-400"}`} />
                        </button>
                      );
                    })}
                  </React.Fragment>
                );
              }

              return (
                <div key={group} className="mb-2">
                  <button
                    onClick={() => toggleGroup(group)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isActiveGroup ? 'text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      {group}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 opacity-70" />
                    ) : (
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="mt-1 space-y-1 pl-2">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.view;
                        return (
                          <button
                            key={item.view}
                            onClick={() => onViewChange(item.view)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                              isActive
                                ? "bg-accent/20 text-accent font-medium"
                                : "text-slate-300 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 ${isActive ? "text-accent" : "text-slate-400"}`}
                            />
                            <span>{item.name}</span>
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

        {/* User Card & Actions - Desktop Sidebar */}
        <div className={`p-4 border-t border-slate-700/50 bg-black/20 ${isSidebarCollapsed ? 'flex flex-col items-center gap-4' : 'space-y-3'}`}>
          <div className="flex items-center">
            <div 
              title={isSidebarCollapsed ? currentUser?.name : undefined}
              className="w-10 h-10 shrink-0 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold border border-accent/30"
            >
              {currentUser?.name.charAt(0).toUpperCase() || "U"}
            </div>
            {!isSidebarCollapsed && (
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
            )}
          </div>

          {!isSidebarCollapsed ? (
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
          ) : (
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => setIsSwitchAccountOpen(true)}
                title="Ganti Akun"
                className="flex items-center justify-center p-2 text-slate-300 bg-[#132F4C] hover:bg-[#1A3A5A] border border-[#1A3A5A] rounded-lg transition-colors shadow-2xs"
              >
                <UserCheck className="w-4 h-4" />
              </button>
              <button
                onClick={() => logout()}
                title="Keluar"
                className="flex items-center justify-center p-2 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors shadow-2xs"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Mobile & Desktop */}
        <header className="flex justify-between items-center p-4 sm:p-6 bg-transparent relative z-20">
          <div className="flex items-center">
            <button
              onClick={() => {
                if (window.innerWidth >= 768) {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                } else {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                }
              }}
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
                className="h-6 w-auto object-contain mr-2 md:hidden"
              />
            ) : null}
            <span className="font-bold text-slate-800 text-sm line-clamp-1 md:hidden">
              {settings.brandName}
            </span>
          </div>

          <div className="hidden md:block">
            <h2 className="text-2xl font-bold text-slate-800 capitalize">
              {{
                dashboard_finance: "Dashboard Keuangan",
                dashboard_inventory: "Dashboard Inventori",
                cash_flow: "Arus Kas",
                expense_categories: "Kategori Keuangan",
                finance_reports: "Laporan Keuangan",
                bank_reconciliation: "Rekonsiliasi Bank",
                inventory: "Manajemen Inventori",
                import_sales: "Impor Data Penjualan",
                users: "Manajemen Pengguna",
                audit_log: "Audit Log Sistem",
                shifts: "Manajemen Shift & Kasir",
                suppliers: "Manajemen Pemasok",
                purchases: "Pembelian & Purchase Order",
                settings: "Pengaturan Sistem",
                hr: "SDM & Karyawan",
                payroll: "Penggajian (Payroll)",
              }[currentView] || currentView}
            </h2>
            <p className="text-sm text-slate-500">
              {{
                dashboard_finance: "Ringkasan keuangan dan arus kas bisnis Anda.",
                dashboard_inventory: "Pantau stok dan pergerakan inventori.",
                cash_flow: "Kelola pemasukan, pengeluaran, dan posisi kas.",
                expense_categories: "Atur kategori pengeluaran untuk pelaporan.",
                finance_reports: "Laporan keuangan bulanan dan tahunan.",
                bank_reconciliation: "Cocokkan transaksi dengan rekening bank.",
                inventory: "Kelola stok bahan baku dan pergerakan gudang.",
                import_sales: "Catat dan impor data penjualan harian.",
                users: "Kelola akun dan hak akses pengguna sistem.",
                audit_log: "Riwayat aktivitas dan perubahan data sistem.",
                shifts: "Buka, tutup, dan kelola sesi kasir.",
                suppliers: "Data pemasok dan kontak pengiriman.",
                purchases: "Pembelian bahan baku dan purchase order.",
                settings: "Konfigurasi sistem dan preferensi aplikasi.",
                hr: "Data karyawan, kontrak, dan absensi.",
                payroll: "Hitung dan kelola penggajian karyawan.",
              }[currentView] || "Pantau dan kelola operasional bisnis Anda."}
            </p>
          </div>

          <div className="flex gap-2.5 items-center">
            {/* AI Assistant Button */}
            <button
              onClick={() => setIsAIAssistantOpen(true)}
              title="Magic AI Assistant (Catat dari Nota/Teks)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Assistant</span>
            </button>

            {/* Export & Business Reports Center Button */}
            {currentUser?.role !== "KASIR" && currentUser?.role !== "LEADER" && (
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
            )}

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
                    {currentUser?.role !== "KASIR" && currentUser?.role !== "LEADER" && (
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
                    )}
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
              {(() => {
                const groupedNav = navigation.reduce((acc, item) => {
                  const g = item.group || "Lainnya";
                  if (!acc[g]) acc[g] = [];
                  acc[g].push(item);
                  return acc;
                }, {} as Record<string, typeof navigation>);

                return Object.entries(groupedNav).map(([group, items]) => {
                  const isExpanded = expandedGroups[group];
                  const isActiveGroup = items.some(i => i.view === currentView);
                  
                  return (
                    <div key={group} className="mb-2">
                      <button
                        onClick={() => toggleGroup(group)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${isActiveGroup ? 'text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span className="text-[11px] font-bold uppercase tracking-wider">
                          {group}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 opacity-70" />
                        ) : (
                          <ChevronRight className="w-4 h-4 opacity-70" />
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="mt-1 space-y-1 pl-2">
                          {items.map((item) => {
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
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50  relative z-10 rounded-tl-2xl border-t border-l border-slate-200/50 shadow-inner">
          {/* Banner Read-Only untuk OWNER */}
          {currentUser?.role === "OWNER" && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm shadow-sm">
              <Eye className="w-4 h-4 shrink-0 text-amber-600" />
              <div>
                <span className="font-bold">Mode Pantau (View Only)</span>
                <span className="ml-2 text-amber-700">
                  Anda login sebagai <strong>Owner</strong> — dapat melihat semua data namun tidak dapat membuat perubahan.
                </span>
              </div>
            </div>
          )}
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
