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
  Store,
  TrendingUp,
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
      name: "Dashboard Eksekutif",
      view: "dashboard_owner" as ViewState,
      icon: TrendingUp,
    },
    { group: "Dasbor",
      name: "Dashboard Karyawan",
      view: "dashboard_employee" as ViewState,
      icon: LayoutDashboard,
    },
    { group: "Dasbor",
      name: "Dashboard Manajer",
      view: "dashboard_manager" as ViewState,
      icon: Store,
    },
    { group: "Dasbor",
      name: "Dashboard Keuangan",
      view: "dashboard_finance" as ViewState,
      icon: Wallet,
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
      name: currentUser?.role === "LEADER" ? "Jadwal Shift Tim" : "SDM & HRD",
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
      "inventory", "import_sales",
      "hr", "leader_checklist",
      "shifts", "suppliers", "purchases",
      "users",   // Manager bisa onboard staff (dibatasi role-nya di Users.tsx)
      "audit_log",
    ],
    FINANCE: [
      "dashboard_finance",
      "dashboard_owner",
      "cash_flow", "expense_categories", "finance_reports", "bank_reconciliation",
      "payroll", "purchases",
      "audit_log",
    ],
    KASIR: [
      "dashboard_employee",
      "shifts", "leader_checklist",
      "import_sales",
      "attendance_clock"
    ],
    LEADER: [
      "dashboard_employee",
      "hr",
      "leader_checklist",
      "dashboard_inventory",
      "inventory",
      "shifts",
      "suppliers", "purchases",
      "attendance_clock"
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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Switch Account Modal */}
      <SwitchAccountModal
        isOpen={isSwitchAccountOpen}
        onClose={() => setIsSwitchAccountOpen(false)}
      />

      {/* AI Assistant Modal */}
      <AIAssistantModal
        isOpen={isAIAssistantOpen && canAccessAIAssistant}
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
      <aside className={`hidden md:flex flex-col bg-primary border-r border-slate-800 text-secondary transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`p-6 border-b border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center px-4' : 'gap-3'}`}>
          {settings.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={settings.brandName}
              className={`h-8 w-auto object-contain ${isSidebarCollapsed ? 'max-w-[40px]' : 'max-w-[120px]'}`}
            />
          ) : (
            <div className="w-8 h-8 shrink-0 bg-accent rounded-xl flex items-center justify-center text-white font-bold shadow-coffee-sm">
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
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
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
                          className={`w-full flex items-center justify-center p-2.5 rounded-xl text-sm transition-all mb-1 ${
                            isActive
                              ? "bg-amber-500/20 text-amber-300 font-semibold shadow-2xs"
                              : "text-stone-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-amber-400" : "text-stone-400"}`} />
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${isActiveGroup ? 'text-amber-200 font-semibold' : 'text-stone-400 hover:text-stone-200'}`}
                  >
                    <span className="font-bold uppercase tracking-wider text-[10px]">
                      {group}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="mt-1 space-y-1 pl-1">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.view;
                        return (
                          <button
                            key={item.view}
                            onClick={() => onViewChange(item.view)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all ${
                              isActive
                                ? "bg-amber-500/15 text-amber-300 font-semibold border-l-2 border-amber-500 shadow-2xs"
                                : "text-stone-300 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 ${isActive ? "text-amber-400" : "text-stone-400"}`}
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

        {/* User Card & Actions - Desktop Sidebar */}
        <div className={`p-4 border-t border-[#3a281f] bg-black/25 ${isSidebarCollapsed ? 'flex flex-col items-center gap-4' : 'space-y-3'}`}>
          <div className="flex items-center">
            <div 
              title={isSidebarCollapsed ? currentUser?.name : undefined}
              className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold border border-amber-500/30 shadow-coffee-sm"
            >
              {currentUser?.name.charAt(0).toUpperCase() || "U"}
            </div>
            {!isSidebarCollapsed && (
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">
                  {currentUser?.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase border border-amber-500/30">
                    {currentUser?.role}
                  </span>
                  <span className="text-xs text-stone-400 truncate">
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
                className="flex items-center justify-center px-2 py-2 text-xs font-medium text-stone-200 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition-all shadow-2xs"
              >
                <UserCheck className="w-3.5 h-3.5 mr-1 text-stone-300" />
                Ganti Akun
              </button>
              <button
                onClick={() => logout()}
                className="flex items-center justify-center px-2 py-2 text-xs font-medium text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/20 rounded-xl transition-all shadow-2xs"
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
                className="flex items-center justify-center p-2.5 text-stone-200 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition-all shadow-2xs"
              >
                <UserCheck className="w-4 h-4" />
              </button>
              <button
                onClick={() => logout()}
                title="Keluar"
                className="flex items-center justify-center p-2.5 text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/20 rounded-xl transition-all shadow-2xs"
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
        <header className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-3.5 bg-white/90 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30 transition-all shadow-coffee-sm">
          <div className="flex items-center">
            <button
              onClick={() => {
                if (window.innerWidth >= 768) {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                } else {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                }
              }}
              className="text-stone-700 hover:text-stone-900 p-2 rounded-xl bg-white border border-stone-200/80 mr-2.5 shadow-2xs hover:bg-stone-50 transition-all"
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
            <span className="font-bold text-stone-900 text-sm line-clamp-1 md:hidden">
              {settings.brandName}
            </span>
          </div>

          <div className="hidden md:block">
            <h2 className="text-xl font-bold text-stone-900 tracking-tight capitalize">
              {{
                dashboard_owner: "Dashboard Eksekutif Owner",
                dashboard_employee: "Portal Karyawan & Leader",
                dashboard_manager: "Dashboard Operasional Manajer",
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
                attendance_clock: "Absensi & Clock In",
                leader_checklist: "Checklist Jobdesk",
              }[currentView] || currentView}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {{
                dashboard_owner: "Kesehatan bisnis, profitabilitas riil, efisiensi rasio biaya, dan deteksi dini risiko.",
                dashboard_employee: "Pantau status kehadiran, evaluasi KPI, dan progres tugas operasional Anda.",
                dashboard_manager: "Pantau shift kasir, kehadiran selfie staf, progres checklist divisi, dan stok bahan.",
                dashboard_finance: "Ringkasan keuangan, arus kas, dan likuiditas bisnis Anda.",
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
                attendance_clock: "Ambil foto selfie dan rekam lokasi GPS untuk absensi harian.",
                leader_checklist: "Lakukan evaluasi dan checklist operasional harian divisi.",
              }[currentView] || "Pantau dan kelola operasional bisnis Anda."}
            </p>
          </div>

          <div className="flex gap-2.5 items-center">
            {/* AI Assistant Button (Only for Finance, Manager, and Super Admin) */}
            {canAccessAIAssistant && (
              <button
                onClick={() => setIsAIAssistantOpen(true)}
                title="Magic AI Assistant (Catat dari Nota/Teks)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800 transition-all shadow-coffee-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI Assistant</span>
              </button>
            )}

            {/* Export & Business Reports Center Button (Only Owner/Boss, Manager, Finance, and Super Admin) */}
            {canAccessBusinessReports && (
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-stone-200/90 text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Ekspor & Laporan</span>
              </button>
            )}

            {/* Cloud Sync Status Indicator */}
            <button
              onClick={() => syncData()}
              title="Sinkronisasi Cloud Database (Klik untuk update data manual)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                isSyncing
                  ? "bg-amber-50 border-amber-200 text-amber-800 shadow-2xs"
                  : "bg-stone-100/80 border-stone-200 text-stone-700 hover:bg-stone-200/60 shadow-2xs"
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-stone-500" />
              )}
              <span className="hidden sm:inline">
                {isSyncing ? "Menyinkronkan..." : "Cloud DB"}
              </span>
            </button>

            <div className="hidden sm:flex flex-col items-end mr-1">
              <span className="text-[10px] uppercase font-bold text-stone-400">
                Hari Ini
              </span>
              <span className="text-xs font-semibold text-stone-700">
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
                className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full md:rounded-xl bg-white border border-stone-200/80 hover:border-stone-300 hover:bg-stone-50 transition-all shadow-2xs"
              >
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-bold border border-amber-200 text-xs shadow-2xs">
                  {currentUser?.name.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="hidden md:flex flex-col items-start text-left">
                  <span className="text-xs font-bold text-stone-900 line-clamp-1 leading-tight">
                    {currentUser?.name}
                  </span>
                  <span className="text-[10px] text-amber-700 font-semibold leading-tight">
                    {currentUser?.role}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-stone-400 transition-transform ${isUserDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown Floating Menu */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-coffee-lg border border-stone-200/80 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-stone-100">
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {currentUser?.name}
                    </p>
                    <p className="text-[11px] text-stone-500 truncate">
                      @{currentUser?.username}
                    </p>
                    <div className="mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase border border-amber-200">
                        Peran: {currentUser?.role}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    {canAccessBusinessReports && (
                      <button
                        onClick={() => {
                          setIsUserDropdownOpen(false);
                          setExportModalModule("executive");
                          setIsExportModalOpen(true);
                        }}
                        className="w-full flex items-center px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2.5 text-amber-700" />
                        Pusat Ekspor & Laporan
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        setIsSwitchAccountOpen(true);
                      }}
                      className="w-full flex items-center px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <UserCheck className="w-4 h-4 mr-2.5 text-stone-600" />
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
          <div className="md:hidden bg-primary border-b border-[#3a281f] text-secondary shadow-xl relative z-10 animate-in slide-in-from-top-2 duration-150">
            {/* User Profile on Mobile Menu */}
            <div className="p-4 bg-black/25 border-b border-[#3a281f] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold border border-amber-500/30 shadow-coffee-sm">
                  {currentUser?.name.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {currentUser?.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase border border-amber-500/30">
                      {currentUser?.role}
                    </span>
                    <span className="text-xs text-stone-400">
                      @{currentUser?.username}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <nav className="p-3 space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
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
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors ${isActiveGroup ? 'text-amber-200 font-semibold' : 'text-stone-400 hover:text-stone-200'}`}
                      >
                        <span className="font-bold uppercase tracking-wider text-[10px]">
                          {group}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="mt-1 space-y-1 pl-1">
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
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all ${
                                  isActive
                                    ? "bg-amber-500/15 text-amber-300 font-semibold border-l-2 border-amber-500 shadow-2xs"
                                    : "text-stone-300 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                <Icon
                                  className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-stone-400"}`}
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
            <div className="p-3 bg-black/25 border-t border-[#3a281f] grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSwitchAccountOpen(true);
                }}
                className="flex items-center justify-center py-2.5 px-3 bg-white/10 hover:bg-white/15 border border-white/10 text-stone-200 font-medium text-xs rounded-xl shadow-2xs transition-colors"
              >
                <UserCheck className="w-4 h-4 mr-1.5 text-stone-300" />
                Ganti Akun
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center justify-center py-2.5 px-3 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/20 text-rose-300 font-medium text-xs rounded-xl shadow-2xs transition-colors"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Keluar
              </button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#fbf9f5] relative z-10 rounded-tl-3xl border-t border-l border-stone-200/60 shadow-inner">
          {/* Banner Read-Only untuk OWNER */}
          {currentUser?.role === "OWNER" && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-amber-900 text-sm shadow-coffee-sm">
              <Eye className="w-4 h-4 shrink-0 text-amber-700" />
              <div>
                <span className="font-bold">Mode Pantau (View Only)</span>
                <span className="ml-2 text-amber-800">
                  Anda login sebagai <strong>Owner</strong> — dapat melihat semua data namun tidak dapat membuat perubahan.
                </span>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.main
              key={currentView}
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
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
