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
  const [currentView, setCurrentView] = useState<ViewState>("dashboard_finance");
  const { currentUser } = useStore();

  // Halaman default saat pertama login atau saat view tidak diizinkan
  const roleDefaultView: Record<string, ViewState> = {
    SUPER_ADMIN: "dashboard_owner",
    OWNER:       "dashboard_owner",
    MANAGER:     "dashboard_manager",
    FINANCE:     "dashboard_finance",
    KASIR:       "dashboard_employee",
    LEADER:      "dashboard_employee",
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
    "attendance_clock"
  ];

  const roleAllowedViews: Record<string, ViewState[]> = {
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
      "users",
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

  React.useEffect(() => {
    if (!currentUser) {
      setCurrentView("dashboard_finance");
      return;
    }
    const allowed = roleAllowedViews[currentUser.role] || ALL_VIEWS;
    if (!allowed.includes(currentView)) {
      setCurrentView(roleDefaultView[currentUser.role] || "dashboard_finance");
    }
  }, [currentUser?.role]);

  if (!currentUser) {
    return <Login />;
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
