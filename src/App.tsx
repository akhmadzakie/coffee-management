/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { StoreProvider, useStore } from "./store/StoreContext";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Inventory } from "./components/Inventory";
import { Sales } from "./components/Sales";
import { CashFlow } from "./components/CashFlow";
import { AuditLogViewer } from "./components/AuditLogViewer";
import { SettingsComponent } from "./components/Settings";
import { Login } from "./components/Login";
import { UsersComponent } from "./components/Users";
import { ShiftManagement } from "./components/ShiftManagement";
import { Suppliers } from "./components/Suppliers";
import { Purchases } from "./components/Purchases";
import { HRManagement } from "./components/HRManagement";
import { ExpenseCategories } from "./components/ExpenseCategories";
import { Payroll } from "./components/Payroll";
import { ViewState } from "./types";
import BankReconciliationComponent from "./components/BankReconciliation";
import FinanceReports from "./components/FinanceReports";

// Lazy placeholder for modules not yet built
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

  const roleDefaultView: Record<string, ViewState> = {
    OWNER: "dashboard_finance",
    KASIR: "shifts",
    LEADER: "dashboard_inventory",
  };

  const roleAllowedViews: Record<string, ViewState[]> = {
    OWNER: ["dashboard_finance", "cash_flow", "finance_reports"],
  };

  React.useEffect(() => {
    if (!currentUser) {
      setCurrentView("dashboard_finance");
      return;
    }
    const allowed = roleAllowedViews[currentUser.role];
    if (allowed && !allowed.includes(currentView)) {
      setCurrentView(roleDefaultView[currentUser.role] || "dashboard_finance");
    }
  }, [currentUser, currentView]);

  if (!currentUser) {
    return <Login />;
  }

  const renderView = () => {
    switch (currentView) {
      case "dashboard_finance":
        return <Dashboard view="FINANCE" />;
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
      default:
        return <Dashboard view="FINANCE" />;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {renderView()}
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
