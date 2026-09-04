/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StoreProvider, useStore } from './store/StoreContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Sales } from './components/Sales';
import { CashFlow } from './components/CashFlow';
import { AuditLogViewer } from './components/AuditLogViewer';
import { SettingsComponent } from './components/Settings';
import { Login } from './components/Login';
import { UsersComponent } from './components/Users';
import { ShiftManagement } from './components/ShiftManagement';
import { Suppliers } from './components/Suppliers';
import { Purchases } from './components/Purchases';
import { HRManagement } from './components/HRManagement';
import { ViewState } from './types';

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Login />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'inventory':
        return <Inventory />;
      case 'import_sales':
        return <Sales />;
      case 'cash_flow':
        return <CashFlow />;
      case 'audit_log':
        return <AuditLogViewer />;
      case 'users':
        return <UsersComponent />;
      case 'settings':
        return <SettingsComponent />;
      case 'shifts':
        return <ShiftManagement />;
      case 'suppliers':
        return <Suppliers />;
      case 'purchases':
        return <Purchases />;
      case 'hr':
        return <HRManagement />;
      default:
        return <Dashboard />;
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
