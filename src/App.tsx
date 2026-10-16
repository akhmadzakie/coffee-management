/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StoreProvider, useStore } from "./store/StoreContext";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { ViewState } from "./types";

// ─── Lazy-loaded page components ─────────────────────────────────────────────
// These are only downloaded when the user navigates to that page,
// dramatically reducing the initial bundle size.
const Dashboard = React.lazy(() =>
  import("./components/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const OwnerDashboard = React.lazy(() =>
  import("./components/OwnerDashboard").then((m) => ({ default: m.OwnerDashboard })),
);
const FinanceDashboard = React.lazy(() =>
  import("./components/FinanceDashboard").then((m) => ({ default: m.FinanceDashboard })),
);
const ManagerDashboard = React.lazy(() =>
  import("./components/ManagerDashboard").then((m) => ({ default: m.ManagerDashboard })),
);
const HppCalculator = React.lazy(() =>
  import("./components/HppCalculator").then((m) => ({ default: m.HppCalculator })),
);
const Inventory = React.lazy(() =>
  import("./components/Inventory").then((m) => ({ default: m.Inventory })),
);
const Sales = React.lazy(() =>
  import("./components/Sales").then((m) => ({ default: m.Sales })),
);
const CashFlow = React.lazy(() =>
  import("./components/CashFlow").then((m) => ({ default: m.CashFlow })),
);
const AuditLogViewer = React.lazy(() =>
  import("./components/AuditLogViewer").then((m) => ({ default: m.AuditLogViewer })),
);
const SettingsComponent = React.lazy(() =>
  import("./components/Settings").then((m) => ({ default: m.SettingsComponent })),
);
const UsersComponent = React.lazy(() =>
  import("./components/Users").then((m) => ({ default: m.UsersComponent })),
);
const ShiftManagement = React.lazy(() =>
  import("./components/ShiftManagement").then((m) => ({ default: m.ShiftManagement })),
);
const Suppliers = React.lazy(() =>
  import("./components/Suppliers").then((m) => ({ default: m.Suppliers })),
);
const Purchases = React.lazy(() =>
  import("./components/Purchases").then((m) => ({ default: m.Purchases })),
);
const HRManagement = React.lazy(() =>
  import("./components/HRManagement").then((m) => ({ default: m.HRManagement })),
);
const ExpenseCategories = React.lazy(() =>
  import("./components/ExpenseCategories").then((m) => ({ default: m.ExpenseCategories })),
);
const Payroll = React.lazy(() =>
  import("./components/Payroll").then((m) => ({ default: m.Payroll })),
);
const BankReconciliationComponent = React.lazy(() =>
  import("./components/BankReconciliation"),
);
const FinanceReports = React.lazy(() =>
  import("./components/FinanceReports"),
);
const LeaderChecklist = React.lazy(() =>
  import("./components/LeaderChecklist").then((m) => ({ default: m.LeaderChecklist })),
);
const ClockIn = React.lazy(() =>
  import("./components/ClockIn").then((m) => ({ default: m.ClockIn })),
);
const EmployeeDashboard = React.lazy(() =>
  import("./components/EmployeeDashboard").then((m) => ({ default: m.EmployeeDashboard })),
);
const PosTerminal = React.lazy(() =>
  import("./components/pos/PosTerminal").then((m) => ({ default: m.PosTerminal })),
);
const PosCashierLogin = React.lazy(() =>
  import("./components/pos/PosCashierLogin").then((m) => ({ default: m.PosCashierLogin })),
);
const KitchenDisplaySystem = React.lazy(() =>
  import("./components/pos/KitchenDisplaySystem").then((m) => ({ default: m.KitchenDisplaySystem })),
);

// Page loading skeleton — shown while a lazy chunk is downloading
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full bg-slate-300 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
    <p className="text-xs text-slate-400">Memuat...</p>
  </div>
);

// Placeholder for modules not yet built
const ComingSoon = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
    <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
      <span className="text-3xl">🚧</span>
    </div>
    <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
    <p className="text-gray-400 text-sm max-w-xs">
      Modul ini sedang dalam pengembangan dan akan segera tersedia.
    </p>
  </div>
);

function AppContent() {
  const isPosDedicatedRoute = (() => {
    try {
      const pathname = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      return (
        pathname === "/pos" ||
        pathname.startsWith("/pos/") ||
        params.get("view") === "pos_cashier" ||
        params.get("mode") === "pos"
      );
    } catch {
      return false;
    }
  })();

  const isKdsDedicatedRoute = (() => {
    try {
      const pathname = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      return (
        pathname === "/kds" ||
        pathname.startsWith("/kds/") ||
        params.get("view") === "kitchen_display" ||
        params.get("mode") === "kds"
      );
    } catch {
      return false;
    }
  })();

  const [currentView, setCurrentView] = useState<ViewState>(() => {
    if (isPosDedicatedRoute) return "pos_cashier";
    if (isKdsDedicatedRoute) return "kitchen_display";
    return "dashboard_finance";
  });
  const { currentUser, employees } = useStore();

  // Halaman default saat pertama login atau saat view tidak diizinkan
  const roleDefaultView: Record<string, ViewState> = {
    SUPER_ADMIN: "dashboard_owner",
    OWNER:       "dashboard_owner",
    MANAGER:     "dashboard_manager",
    FINANCE:     "dashboard_finance",
    KASIR:       "pos_cashier",
    LEADER:      "leader_checklist",
    BAR:         "dashboard_employee",
    KITCHEN:     "dashboard_employee",
    BAKER:       "dashboard_employee",
  };

  // Daftar view yang diizinkan per role (SUPER_ADMIN mendapat semua akses)
  const ALL_VIEWS: ViewState[] = [
    "dashboard_owner",
    "dashboard_employee",
    "dashboard_manager",
    "dashboard_finance", "dashboard_inventory", "cash_flow",
    "expense_categories", "finance_reports", "bank_reconciliation",
    "inventory", "import_sales", "hr", "payroll", "leader_checklist",
    "users", "audit_log", "shifts", "suppliers", "purchases", "settings",
    "attendance_clock", "hpp_calculator", "pos_cashier", "kitchen_display"
  ];

  const roleAllowedViews: Record<string, ViewState[]> = {
    SUPER_ADMIN: ALL_VIEWS,
    OWNER: [
      "dashboard_owner",
      "dashboard_finance",
      "dashboard_manager",
      "cash_flow",
      "finance_reports",
      "hpp_calculator",
      "pos_cashier",
      "kitchen_display",
    ],
    MANAGER: [
      "dashboard_manager",
      "dashboard_owner",
      "dashboard_inventory",
      "inventory", "import_sales",
      "hr", "leader_checklist",
      "shifts", "suppliers", "purchases",
      "users",
      "audit_log",
      "hpp_calculator",
      "pos_cashier",
      "kitchen_display",
    ],
    FINANCE: [
      "dashboard_finance",
      "dashboard_owner",
      "cash_flow", "expense_categories", "finance_reports", "bank_reconciliation",
      "payroll", "purchases",
      "audit_log",
      "pos_cashier",
    ],
    KASIR: [
      "pos_cashier",
      "kitchen_display",
      "dashboard_employee",
      "shifts",
      "import_sales",
      "attendance_clock"
    ],
    LEADER: [
      "kitchen_display",
      "dashboard_employee",
      "hr",
      "leader_checklist",
      "dashboard_inventory",
      "inventory",
      "shifts",
      "suppliers", "purchases",
      "attendance_clock"
    ],
    BAR: ["kitchen_display", "dashboard_employee", "attendance_clock"],
    KITCHEN: ["kitchen_display", "dashboard_employee", "attendance_clock"],
    BAKER: ["kitchen_display", "dashboard_employee", "attendance_clock"],
  };

  React.useEffect(() => {
    if (!currentUser) {
      if (!isPosDedicatedRoute && !isKdsDedicatedRoute) {
        setCurrentView("dashboard_finance");
      }
      return;
    }
    const userEmp = (employees || []).find(
      (e: any) => e.username === currentUser.username || e.id === currentUser.employeeId
    );
    const isEmpLeader = Boolean(
      currentUser.role === "LEADER" ||
      ((userEmp?.position || "").toUpperCase().includes("LEADER") || (userEmp?.position || "").toUpperCase().includes("HEAD"))
    );

    const baseAllowed = roleAllowedViews[currentUser.role] || ALL_VIEWS;
    const allowed = isEmpLeader && !baseAllowed.includes("leader_checklist")
      ? [...baseAllowed, "leader_checklist"]
      : baseAllowed;

    if (!allowed.includes(currentView)) {
      setCurrentView(roleDefaultView[currentUser.role] || "dashboard_finance");
    }
  }, [currentUser?.role, currentUser?.username, employees, isPosDedicatedRoute, isKdsDedicatedRoute]);

  // ─── 1. DEDICATED ROUTE: /pos (POS KASIR TERISOLASI) ──────────────────────────
  if (isPosDedicatedRoute) {
    if (!currentUser) {
      return (
        <Suspense fallback={<PageLoader />}>
          <ErrorBoundary>
            <PosCashierLogin onLoginSuccess={() => setCurrentView("pos_cashier")} />
          </ErrorBoundary>
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <PosTerminal onNavigateBack={undefined} />
        </ErrorBoundary>
      </Suspense>
    );
  }

  // ─── 2. DEDICATED ROUTE: /kds (LAYAR DAPUR, BAR & BAKER KDS MANDIRI) ───────
  if (isKdsDedicatedRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <KitchenDisplaySystem onNavigateBack={undefined} />
        </ErrorBoundary>
      </Suspense>
    );
  }

  // ─── 3. WEB MANAJEMEN BACK-OFFICE (URL UMUM /) ────────────────────────────────
  if (!currentUser) {
    return <Login />;
  }

  // Jika user yang login di web manajemen adalah kasir murni, kunci di Terminal Kasir tanpa akses web
  if (currentUser.role === "KASIR") {
    return (
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <PosTerminal onNavigateBack={undefined} />
        </ErrorBoundary>
      </Suspense>
    );
  }

  // Jika Owner/Manager sedang menguji atau membuka Terminal Kasir dari web manajemen
  if (currentView === "pos_cashier") {
    return (
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <PosTerminal
            onNavigateBack={() => setCurrentView(roleDefaultView[currentUser.role] || "dashboard_owner")}
          />
        </ErrorBoundary>
      </Suspense>
    );
  }

  if (currentView === "kitchen_display") {
    return (
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <KitchenDisplaySystem
            onNavigateBack={() => setCurrentView(roleDefaultView[currentUser.role] || "dashboard_owner")}
          />
        </ErrorBoundary>
      </Suspense>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case "dashboard_owner":
        return <OwnerDashboard onNavigate={setCurrentView} />;
      case "dashboard_finance":
        return <FinanceDashboard onNavigate={setCurrentView} />;
      case "dashboard_manager":
        return <ManagerDashboard onNavigate={setCurrentView} />;
      case "dashboard_inventory":
        return <Dashboard view="INVENTORY" />;
      case "inventory":
        return <Inventory />;
      case "import_sales":
        return <Sales />;
      case "cash_flow":
        return <CashFlow />;
      case "audit_log":
        return <AuditLogViewer />;
      case "users":
        return <UsersComponent />;
      case "settings":
        return <SettingsComponent />;
      case "shifts":
        return <ShiftManagement />;
      case "suppliers":
        return <Suppliers />;
      case "purchases":
        return <Purchases />;
      case "leader_checklist":
        return <LeaderChecklist />;
      case "hr":
        return <HRManagement />;
      // Fase 1: Expense Categories
      case "expense_categories":
        return <ExpenseCategories />;
      // Fase 2: Finance
      case "finance_reports":
        return <FinanceReports />;
      case "bank_reconciliation":
        return <BankReconciliationComponent />;
      // Fase 4: Payroll (Coming Soon)
      case "payroll":
        return <Payroll />;
      case "attendance_clock":
        return <ClockIn />;
      case "dashboard_employee":
        return <EmployeeDashboard onNavigate={setCurrentView} />;
      case "hpp_calculator":
        return <HppCalculator onNavigate={setCurrentView} />;
      default:
        return <Dashboard view="FINANCE" />;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          {renderView()}
        </ErrorBoundary>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
