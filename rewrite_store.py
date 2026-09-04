import os

new_store_content = """import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { 
  User, DeviceSession, Settings, 
  CashTransaction, Ingredient, StockMovement, 
  SalesTransaction, SalesImportLog, AuditLog 
} from '../types';
import { detectDeviceAsync, DetectedDeviceInfo } from '../utils/deviceDetector';
import { get, set, del } from 'idb-keyval';

interface StoreContextType {
  currentUser: User | null;
  users: User[];
  sessions: DeviceSession[];
  settings: Settings;
  cashTransactions: CashTransaction[];
  ingredients: Ingredient[];
  stockMovements: StockMovement[];
  salesTransactions: SalesTransaction[];
  salesImportLogs: SalesImportLog[];
  auditLogs: AuditLog[];
  
  // Actions
  updateSettings: (settings: Settings) => void;
  login: (username: string, pin: string) => boolean;
  logout: () => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;
  
  addCashTransaction: (transaction: Omit<CashTransaction, 'id'>) => void;
  deleteCashTransaction: (id: string) => void;
  
  addIngredient: (ingredient: Omit<Ingredient, 'id'>) => void;
  updateIngredient: (ingredient: Ingredient) => void;
  deleteIngredient: (id: string) => void;
  
  addStockMovement: (movement: Omit<StockMovement, 'id'>) => void;
  
  // Sync Status
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncData: () => Promise<void>;
  
  // Session handling
  currentSessionId: string;
  fetchSessions: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<boolean>;
  revokeOtherSessions: () => Promise<boolean>;
  wasForceLoggedOut: boolean;
  dismissForceLogoutAlert: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [settings, setSettings] = useState<Settings>({
    id: '1',
    logoDataUrl: null,
    brandName: 'Kedai Kopi Manager',
    companyAddress: '',
    bankDetails: '',
    salesPerson: '',
    footerMessage: '',
    language: 'id'
  });
  
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [salesTransactions, setSalesTransactions] = useState<SalesTransaction[]>([]);
  const [salesImportLogs, setSalesImportLogs] = useState<SalesImportLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [wasForceLoggedOut, setWasForceLoggedOut] = useState<boolean>(false);
  
  const hasLocalChanges = useRef(false);
  const isSyncingRef = useRef(false);
  const isApplyingServerUpdate = useRef(false);
  const deviceRef = useRef<DetectedDeviceInfo>({} as DetectedDeviceInfo);

  // Initialize auth
  useEffect(() => {
    async function loadAuth() {
      try {
        const deviceInfo = await detectDeviceAsync();
        deviceRef.current = deviceInfo;

        let savedUser = await get('node_current_user');
        if (!savedUser) {
          const lsUser = localStorage.getItem('node_current_user');
          if (lsUser) {
             savedUser = JSON.parse(lsUser);
             await set('node_current_user', savedUser).catch(() => {});
          }
        }
        setCurrentUser(savedUser || null);
      } catch (err) {
        console.error("Failed to load auth state", err);
      } finally {
        setIsAuthLoaded(true);
      }
    }
    loadAuth();
  }, []);

  // Save auth
  useEffect(() => {
    if (isAuthLoaded) {
      if (currentUser) {
        set('node_current_user', currentUser).catch(console.error);
        localStorage.setItem('node_current_user', JSON.stringify(currentUser));
      } else {
        del('node_current_user').catch(console.error);
        localStorage.removeItem('node_current_user');
      }
    }
  }, [currentUser, isAuthLoaded]);

  // Sync Logic
  const fetchFromServer = async (isManual = false) => {
    if (isSyncingRef.current && !isManual) return;
    
    try {
      if (isManual) setIsSyncing(true);
      const res = await fetch('/api/sync');
      if (res.ok) {
        const data = await res.json();
        
        isApplyingServerUpdate.current = true;
        
        if (Array.isArray(data.cash_transactions)) setCashTransactions(data.cash_transactions);
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.users) && data.users.length > 0) setUsers(data.users);
        if (Array.isArray(data.device_sessions)) setSessions(data.device_sessions);
        if (Array.isArray(data.ingredients)) setIngredients(data.ingredients);
        if (Array.isArray(data.stock_movements)) setStockMovements(data.stock_movements);
        if (Array.isArray(data.sales_transactions)) setSalesTransactions(data.sales_transactions);
        if (Array.isArray(data.sales_import_logs)) setSalesImportLogs(data.sales_import_logs);
        if (Array.isArray(data.audit_logs)) setAuditLogs(data.audit_logs);

        setLastSyncTime(new Date());
        hasLocalChanges.current = false;
        
        setTimeout(() => {
          isApplyingServerUpdate.current = false;
        }, 150);
      }
    } catch (err) {
      console.warn('Failed to fetch from server:', err);
      isApplyingServerUpdate.current = false;
    } finally {
      setIsLoaded(true);
      if (isManual) setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchFromServer(false);
    const interval = setInterval(() => fetchFromServer(false), 5000);
    const handleFocus = () => fetchFromServer(false);
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
    };
  }, []);

  const sendHeartbeat = async (user = currentUser) => {
    if (!user) return;
    try {
      const info = deviceRef.current;
      const res = await fetch('/api/sessions/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: info.sessionId,
          userId: user.id,
          username: user.username,
          userName: user.name,
          deviceName: info.deviceName,
          browser: info.browser,
          os: info.os,
          deviceType: info.deviceType,
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.revoked) {
          setCurrentUser(null);
          localStorage.removeItem('node_current_user');
          del('node_current_user').catch(() => {});
          localStorage.removeItem('node_session_id');
          del('node_session_id').catch(() => {});
          detectDeviceAsync().then(info => {
            deviceRef.current = info;
            setWasForceLoggedOut(true);
          });
        }
      }
    } catch (err) {}
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          const currentId = deviceRef.current.sessionId;
          setSessions(data.sessions.map((s: any) => ({...s, isCurrent: s.id === currentId})));
        }
      }
    } catch (err) {}
  };

  const revokeSession = async (sessionId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/revoke`, { method: 'POST' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (sessionId === deviceRef.current.sessionId) {
          setCurrentUser(null);
          localStorage.removeItem('node_current_user');
        }
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  const revokeOtherSessions = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/sessions/revoke-others', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentSessionId: deviceRef.current.sessionId,
          userId: currentUser?.id
        })
      });
      if (res.ok) {
        await fetchSessions();
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    if (currentUser) {
      sendHeartbeat(currentUser);
      fetchSessions();
      const sessionInterval = setInterval(() => {
        sendHeartbeat(currentUser);
        fetchSessions();
      }, 5000);
      return () => clearInterval(sessionInterval);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!isLoaded || isApplyingServerUpdate.current || !hasLocalChanges.current) return;
    const timer = setTimeout(async () => {
      try {
        setIsSyncing(true);
        isSyncingRef.current = true;
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role || '', 'x-user-id': currentUser?.id || '' },
          body: JSON.stringify({
            cash_transactions: cashTransactions,
            settings: settings,
            users: users,
            device_sessions: sessions,
            ingredients: ingredients,
            stock_movements: stockMovements,
            sales_transactions: salesTransactions,
            sales_import_logs: salesImportLogs,
            audit_logs: auditLogs
          })
        });
        if (res.ok) {
          hasLocalChanges.current = false;
          setLastSyncTime(new Date());
        }
      } catch (err) {
        console.error('Error saving data:', err);
      } finally {
        setIsSyncing(false);
        isSyncingRef.current = false;
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [cashTransactions, settings, users, sessions, ingredients, stockMovements, salesTransactions, salesImportLogs, auditLogs]);

  const markChanged = () => {
    if (!isApplyingServerUpdate.current) {
      hasLocalChanges.current = true;
    }
  };

  const updateSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    markChanged();
  };

  const login = (username: string, pin: string) => {
    const user = users.find(u => u.username === username && u.pin === pin);
    if (user) {
      setCurrentUser(user);
      sendHeartbeat(user);
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('node_current_user');
    del('node_current_user').catch(() => {});
    localStorage.removeItem('node_session_id');
    del('node_session_id').catch(() => {});
    detectDeviceAsync().then(info => {
      deviceRef.current = info;
    });
  };

  const dismissForceLogoutAlert = () => setWasForceLoggedOut(false);
  const syncData = async () => await fetchFromServer(true);

  const addUser = (user: Omit<User, 'id'>) => {
    setUsers(prev => [...prev, { ...user, id: crypto.randomUUID() }]);
    markChanged();
  };

  const updateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    markChanged();
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    markChanged();
  };

  const addCashTransaction = (trx: Omit<CashTransaction, 'id'>) => {
    setCashTransactions(prev => [...prev, { ...trx, id: crypto.randomUUID() }]);
    markChanged();
  };

  const deleteCashTransaction = (id: string) => {
    setCashTransactions(prev => prev.filter(t => t.id !== id));
    markChanged();
  };

  const addIngredient = (ing: Omit<Ingredient, 'id'>) => {
    setIngredients(prev => [...prev, { ...ing, id: crypto.randomUUID() }]);
    markChanged();
  };

  const updateIngredient = (ing: Ingredient) => {
    setIngredients(prev => prev.map(i => i.id === ing.id ? ing : i));
    markChanged();
  };

  const deleteIngredient = (id: string) => {
    setIngredients(prev => prev.filter(i => i.id !== id));
    markChanged();
  };

  const addStockMovement = (mov: Omit<StockMovement, 'id'>) => {
    setStockMovements(prev => [...prev, { ...mov, id: crypto.randomUUID() }]);
    
    // Update current stock automatically
    setIngredients(prev => prev.map(ing => {
      if (ing.id === mov.ingredientId) {
        return {
          ...ing,
          currentStock: mov.type === 'IN' 
            ? ing.currentStock + mov.quantity 
            : ing.currentStock - mov.quantity
        };
      }
      return ing;
    }));
    markChanged();
  };

  if (!isAuthLoaded) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div></div>;
  }

  return (
    <StoreContext.Provider value={{
      currentUser, users, sessions, settings,
      cashTransactions, ingredients, stockMovements, salesTransactions, salesImportLogs, auditLogs,
      updateSettings, login, logout,
      addUser, updateUser, deleteUser,
      addCashTransaction, deleteCashTransaction,
      addIngredient, updateIngredient, deleteIngredient,
      addStockMovement,
      isSyncing, lastSyncTime, syncData,
      currentSessionId: deviceRef.current.sessionId || '',
      fetchSessions, revokeSession, revokeOtherSessions,
      wasForceLoggedOut, dismissForceLogoutAlert
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
"""

with open('src/store/StoreContext.tsx', 'w', encoding='utf-8') as f:
    f.write(new_store_content)
print("StoreContext.tsx replaced successfully.")
