import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  User,
  DeviceSession,
  Settings,
  CashAccount,
  CashTransaction,
  Ingredient,
  StockMovement,
  SalesTransaction,
  SalesImportLog,
  AuditLog,
  Supplier,
  PurchaseOrder,
  ShiftSession,
  Employee,
  EmployeeContract,
  AttendanceRecord,
  KPIRecord,
} from "../types";
import { detectDeviceAsync, DetectedDeviceInfo } from "../utils/deviceDetector";
import { get, set, del } from "idb-keyval";

const generateId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Fallback if randomUUID fails for any reason
  }
  return (
    "id_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
};

interface StoreContextType {
  currentUser: User | null;
  users: User[];
  sessions: DeviceSession[];
  settings: Settings;
  cashAccounts: CashAccount[];
  cashTransactions: CashTransaction[];
  ingredients: Ingredient[];
  stockMovements: StockMovement[];
  salesTransactions: SalesTransaction[];
  salesImportLogs: SalesImportLog[];
  auditLogs: AuditLog[];

  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  shifts: ShiftSession[];

  employees: Employee[];
  contracts: EmployeeContract[];
  attendances: AttendanceRecord[];
  kpiRecords: KPIRecord[];

  addEmployee: (emp: Omit<Employee, "id" | "createdAt">) => void;
  updateEmployee: (emp: Employee) => void;
  deleteEmployee: (id: string) => void;

  addContract: (contract: Omit<EmployeeContract, "id">) => void;
  updateContract: (contract: EmployeeContract) => void;

  addAttendance: (
    att: Omit<AttendanceRecord, "id" | "createdAt" | "createdBy">,
  ) => void;
  updateAttendance: (att: AttendanceRecord) => void;

  addKPI: (kpi: Omit<KPIRecord, "id" | "createdAt" | "evaluatedBy">) => void;
  updateKPI: (kpi: KPIRecord) => void;

  addSupplier: (supplier: Omit<Supplier, "id">) => void;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;

  addPurchaseOrder: (po: Omit<PurchaseOrder, "id">) => void;
  updatePOStatus: (id: string, status: "PAID" | "UNPAID") => void;
  markPOAsReceived: (id: string) => void;
  deletePurchaseOrder: (id: string) => void;

  openShift: (shift: Omit<ShiftSession, "id">) => void;
  closeShift: (
    id: string,
    actualEndingCash: number,
    expectedEndingCash: number,
  ) => void;

  // Actions
  updateSettings: (settings: Settings) => void;
  login: (username: string, pin: string) => boolean;
  logout: () => void;
  addUser: (user: Omit<User, "id">) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;

  addCashAccount: (account: Omit<CashAccount, "id">) => void;
  updateCashAccount: (account: CashAccount) => void;
  deleteCashAccount: (id: string) => void;

  addCashTransaction: (transaction: Omit<CashTransaction, "id">) => void;
  deleteCashTransaction: (id: string) => void;

  addIngredient: (ingredient: Omit<Ingredient, "id">) => void;
  updateIngredient: (ingredient: Ingredient) => void;
  deleteIngredient: (id: string) => void;

  addStockMovement: (movement: Omit<StockMovement, "id">) => void;

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
  isReadOnly: boolean; // true for OWNER & AUDITOR — can view but not edit
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [settings, setSettings] = useState<Settings>({
    id: "1",
    logoDataUrl: null,
    brandName: "Kedai Kopi Manager",
    companyAddress: "",
    bankDetails: "",
    salesPerson: "",
    footerMessage: "",
    language: "id",
  });

  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(
    [],
  );
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [salesTransactions, setSalesTransactions] = useState<
    SalesTransaction[]
  >([]);
  const [salesImportLogs, setSalesImportLogs] = useState<SalesImportLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [shifts, setShifts] = useState<ShiftSession[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [kpiRecords, setKpiRecords] = useState<KPIRecord[]>([]);

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

        let savedUser = await get("node_current_user");
        if (!savedUser) {
          const lsUser = localStorage.getItem("node_current_user");
          if (lsUser) {
            savedUser = JSON.parse(lsUser);
            await set("node_current_user", savedUser).catch(() => {});
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
        set("node_current_user", currentUser).catch(console.error);
        localStorage.setItem("node_current_user", JSON.stringify(currentUser));
      } else {
        del("node_current_user").catch(console.error);
        localStorage.removeItem("node_current_user");
      }
    }
  }, [currentUser, isAuthLoaded]);

  // Sync Logic
  const fetchFromServer = async (isManual = false) => {
    if (isSyncingRef.current && !isManual) return;

    try {
      if (isManual) setIsSyncing(true);
      const res = await fetch("/api/sync");
      if (res.ok) {
        const data = await res.json();

        isApplyingServerUpdate.current = true;

        if (Array.isArray(data.cash_accounts))
          setCashAccounts(data.cash_accounts);
        if (Array.isArray(data.cash_transactions))
          setCashTransactions(data.cash_transactions);
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.users) && data.users.length > 0)
          setUsers(data.users);
        if (Array.isArray(data.device_sessions))
          setSessions(data.device_sessions);
        if (Array.isArray(data.ingredients)) setIngredients(data.ingredients);
        if (Array.isArray(data.stock_movements))
          setStockMovements(data.stock_movements);
        if (Array.isArray(data.sales_transactions))
          setSalesTransactions(data.sales_transactions);
        if (Array.isArray(data.sales_import_logs))
          setSalesImportLogs(data.sales_import_logs);

        if (Array.isArray(data.audit_logs)) setAuditLogs(data.audit_logs);
        if (Array.isArray(data.suppliers)) setSuppliers(data.suppliers);
        if (Array.isArray(data.purchase_orders))
          setPurchaseOrders(data.purchase_orders);
        if (Array.isArray(data.shifts)) setShifts(data.shifts);
        if (Array.isArray(data.employees)) setEmployees(data.employees);
        if (Array.isArray(data.contracts)) setContracts(data.contracts);
        if (Array.isArray(data.attendances)) setAttendances(data.attendances);
        if (Array.isArray(data.kpiRecords)) setKpiRecords(data.kpiRecords);

        setLastSyncTime(new Date());
        hasLocalChanges.current = false;

        setTimeout(() => {
          isApplyingServerUpdate.current = false;
        }, 150);
      }
    } catch (err) {
      console.warn("Failed to fetch from server:", err);
      setUsers((prev) =>
        prev.length === 0
          ? [
              {
                id: "admin-1",
                username: "admin",
                pin: "1234",
                name: "Super Admin (Offline)",
                role: "SUPER_ADMIN",
              },
            ]
          : prev,
      );
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

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
    };
  }, []);

  const sendHeartbeat = async (user = currentUser) => {
    if (!user) return;
    try {
      const info = deviceRef.current;
      const res = await fetch("/api/sessions/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: info.sessionId,
          userId: user.id,
          username: user.username,
          userName: user.name,
          deviceName: info.deviceName,
          browser: info.browser,
          os: info.os,
          deviceType: info.deviceType,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.revoked) {
          setCurrentUser(null);
          localStorage.removeItem("node_current_user");
          del("node_current_user").catch(() => {});
          localStorage.removeItem("node_session_id");
          del("node_session_id").catch(() => {});
          detectDeviceAsync().then((info) => {
            deviceRef.current = info;
            setWasForceLoggedOut(true);
          });
        }
      }
    } catch (err) {}
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          const currentId = deviceRef.current.sessionId;
          setSessions(
            data.sessions.map((s: any) => ({
              ...s,
              isCurrent: s.id === currentId,
            })),
          );
        }
      }
    } catch (err) {}
  };

  const revokeSession = async (sessionId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/revoke`, {
        method: "POST",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (sessionId === deviceRef.current.sessionId) {
          setCurrentUser(null);
          localStorage.removeItem("node_current_user");
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
      const res = await fetch("/api/sessions/revoke-others", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSessionId: deviceRef.current.sessionId,
          userId: currentUser?.id,
        }),
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
    if (!isLoaded || isApplyingServerUpdate.current || !hasLocalChanges.current)
      return;
    const timer = setTimeout(async () => {
      try {
        setIsSyncing(true);
        isSyncingRef.current = true;
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-role": currentUser?.role || "",
            "x-user-id": currentUser?.id || "",
          },
          body: JSON.stringify({
            cash_accounts: cashAccounts,
            cash_transactions: cashTransactions,
            settings: settings,
            users: users,
            device_sessions: sessions,
            ingredients: ingredients,
            stock_movements: stockMovements,
            sales_transactions: salesTransactions,
            sales_import_logs: salesImportLogs,
            audit_logs: auditLogs,
            suppliers,
            purchase_orders: purchaseOrders,
            shifts,
            employees,
            contracts,
            attendances,
            kpiRecords,
          }),
        });
        if (res.ok) {
          hasLocalChanges.current = false;
          setLastSyncTime(new Date());
        }
      } catch (err) {
        console.error("Error saving data:", err);
      } finally {
        setIsSyncing(false);
        isSyncingRef.current = false;
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    cashAccounts,
    cashTransactions,
    settings,
    users,
    sessions,
    ingredients,
    stockMovements,
    salesTransactions,
    salesImportLogs,
    auditLogs,
    suppliers,
    purchaseOrders,
    shifts,
  ]);

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
    const user = users.find((u) => u.username === username && u.pin === pin);
    if (user) {
      setCurrentUser(user);
      sendHeartbeat(user);
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("node_current_user");
    del("node_current_user").catch(() => {});
    localStorage.removeItem("node_session_id");
    del("node_session_id").catch(() => {});
    detectDeviceAsync().then((info) => {
      deviceRef.current = info;
    });
  };

  const dismissForceLogoutAlert = () => setWasForceLoggedOut(false);
  const syncData = async () => await fetchFromServer(true);

  // ─── Audit Log Helper ─────────────────────────────────────────────────────
  const writeAuditLog = (
    action: "CREATE" | "UPDATE" | "DELETE",
    tableName: string,
    recordId: string,
  ) => {
    const log: AuditLog = {
      id: generateId(),
      userId: currentUser?.id || "system",
      action,
      tableName,
      recordId,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  const addUser = (user: Omit<User, "id">) => {
    const id = generateId();
    setUsers((prev) => [...prev, { ...user, id }]);
    writeAuditLog("CREATE", "users", id);
    markChanged();
  };

  // ─── HR ACTIONS ─────────────────────────────────────────────────────────
  const addEmployee = (emp: Omit<Employee, "id" | "createdAt">) => {
    const id = generateId();
    setEmployees((prev) => [
      ...prev,
      { ...emp, id, createdAt: new Date().toISOString() },
    ]);
    writeAuditLog("CREATE", "employees", id);
    markChanged();
  };

  const updateEmployee = (emp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
    writeAuditLog("UPDATE", "employees", emp.id);
    markChanged();
  };

  const deleteEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    writeAuditLog("DELETE", "employees", id);
    markChanged();
  };

  const addContract = (contract: Omit<EmployeeContract, "id">) => {
    const id = generateId();
    setContracts((prev) => [...prev, { ...contract, id }]);
    writeAuditLog("CREATE", "contracts", id);
    markChanged();
  };

  const updateContract = (contract: EmployeeContract) => {
    setContracts((prev) =>
      prev.map((c) => (c.id === contract.id ? contract : c)),
    );
    writeAuditLog("UPDATE", "contracts", contract.id);
    markChanged();
  };

  const addAttendance = (
    att: Omit<AttendanceRecord, "id" | "createdAt" | "createdBy">,
  ) => {
    const id = generateId();
    setAttendances((prev) => [
      ...prev,
      {
        ...att,
        id,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id || "system",
      },
    ]);
    writeAuditLog("CREATE", "attendances", id);
    markChanged();
  };

  const updateAttendance = (att: AttendanceRecord) => {
    setAttendances((prev) => prev.map((a) => (a.id === att.id ? att : a)));
    writeAuditLog("UPDATE", "attendances", att.id);
    markChanged();
  };

  const addKPI = (kpi: Omit<KPIRecord, "id" | "createdAt" | "evaluatedBy">) => {
    const id = generateId();
    setKpiRecords((prev) => [
      ...prev,
      {
        ...kpi,
        id,
        createdAt: new Date().toISOString(),
        evaluatedBy: currentUser?.id || "system",
      },
    ]);
    writeAuditLog("CREATE", "kpi_records", id);
    markChanged();
  };

  const updateKPI = (kpi: KPIRecord) => {
    setKpiRecords((prev) => prev.map((k) => (k.id === kpi.id ? kpi : k)));
    writeAuditLog("UPDATE", "kpi_records", kpi.id);
    markChanged();
  };

  const updateUser = (updatedUser: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
    );
    writeAuditLog("UPDATE", "users", updatedUser.id);
    markChanged();
  };

  const deleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    writeAuditLog("DELETE", "users", id);
    markChanged();
  };

  const addCashAccount = (acc: Omit<CashAccount, "id">) => {
    const id = generateId();
    setCashAccounts((prev) => [...prev, { ...acc, id }]);
    writeAuditLog("CREATE", "cash_accounts", id);
    markChanged();
  };

  const updateCashAccount = (acc: CashAccount) => {
    setCashAccounts((prev) => prev.map((a) => (a.id === acc.id ? acc : a)));
    writeAuditLog("UPDATE", "cash_accounts", acc.id);
    markChanged();
  };

  const deleteCashAccount = (id: string) => {
    setCashAccounts((prev) => prev.filter((a) => a.id !== id));
    writeAuditLog("DELETE", "cash_accounts", id);
    markChanged();
  };

  const addCashTransaction = (trx: Omit<CashTransaction, "id">) => {
    const id = generateId();
    setCashTransactions((prev) => [...prev, { ...trx, id }]);
    writeAuditLog("CREATE", "cash_transactions", id);
    markChanged();
  };

  const deleteCashTransaction = (id: string) => {
    setCashTransactions((prev) => prev.filter((t) => t.id !== id));
    writeAuditLog("DELETE", "cash_transactions", id);
    markChanged();
  };

  const addIngredient = (ing: Omit<Ingredient, "id">) => {
    const id = generateId();
    setIngredients((prev) => [...prev, { ...ing, id }]);
    writeAuditLog("CREATE", "ingredients", id);
    markChanged();
  };

  const updateIngredient = (ing: Ingredient) => {
    setIngredients((prev) => prev.map((i) => (i.id === ing.id ? ing : i)));
    writeAuditLog("UPDATE", "ingredients", ing.id);
    markChanged();
  };

  const deleteIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    writeAuditLog("DELETE", "ingredients", id);
    markChanged();
  };

  const addSupplier = (supplier: Omit<Supplier, "id">) => {
    const id = generateId();
    setSuppliers((prev) => [...prev, { ...supplier, id }]);
    writeAuditLog("CREATE", "suppliers", id);
    markChanged();
  };

  const updateSupplier = (supplier: Supplier) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? supplier : s)),
    );
    writeAuditLog("UPDATE", "suppliers", supplier.id);
    markChanged();
  };

  const deleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    writeAuditLog("DELETE", "suppliers", id);
    markChanged();
  };

  const addPurchaseOrder = (po: Omit<PurchaseOrder, "id">) => {
    const id = generateId();
    setPurchaseOrders((prev) => [...prev, { ...po, id }]);
    writeAuditLog("CREATE", "purchase_orders", id);
    markChanged();
  };

  const updatePOStatus = (id: string, status: "PAID" | "UNPAID") => {
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === id ? { ...po, status } : po)),
    );
    writeAuditLog("UPDATE", "purchase_orders", id);
    markChanged();
  };

  const markPOAsReceived = (id: string) => {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return;

    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, deliveryStatus: "RECEIVED" } : p)),
    );
    writeAuditLog("UPDATE", "purchase_orders", id);

    // Auto add stock movements & update ingredient stock for each PO item
    po.items.forEach((item) => {
      const mvId = generateId();
      setStockMovements((prev) => [
        ...prev,
        {
          id: mvId,
          ingredientId: item.productId,
          type: "IN",
          quantity: item.quantity,
          date: new Date().toISOString(),
          note: `PO Diterima: ${po.poNumber}`,
          createdBy: currentUser?.name || "System",
        },
      ]);
      // Update ingredient stock directly
      setIngredients((prev) =>
        prev.map((ing) => {
          if (ing.id === item.productId) {
            return { ...ing, currentStock: ing.currentStock + item.quantity };
          }
          return ing;
        }),
      );
      writeAuditLog("CREATE", "stock_movements", mvId);
    });

    markChanged();
  };

  const deletePurchaseOrder = (id: string) => {
    setPurchaseOrders((prev) => prev.filter((po) => po.id !== id));
    writeAuditLog("DELETE", "purchase_orders", id);
    markChanged();
  };

  const openShift = (shift: Omit<ShiftSession, "id">) => {
    const id = generateId();
    setShifts((prev) => [...prev, { ...shift, id }]);
    writeAuditLog("CREATE", "shifts", id);
    markChanged();
  };

  const closeShift = (
    id: string,
    actualEndingCash: number,
    expectedEndingCash: number,
  ) => {
    setShifts((prev) =>
      prev.map((shift) => {
        if (shift.id === id) {
          return {
            ...shift,
            endTime: new Date().toISOString(),
            expectedEndingCash,
            actualEndingCash,
            difference: actualEndingCash - expectedEndingCash,
            status: "CLOSED",
          };
        }
        return shift;
      }),
    );
    writeAuditLog("UPDATE", "shifts", id);
    markChanged();
  };

  const addStockMovement = (mov: Omit<StockMovement, "id">) => {
    setStockMovements((prev) => [...prev, { ...mov, id: generateId() }]);

    // Update current stock automatically
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === mov.ingredientId) {
          return {
            ...ing,
            currentStock:
              mov.type === "IN"
                ? ing.currentStock + mov.quantity
                : ing.currentStock - mov.quantity,
          };
        }
        return ing;
      }),
    );
    markChanged();
  };

  if (!isAuthLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
      </div>
    );
  }

  return (
    <StoreContext.Provider
      value={{
        currentUser,
        users,
        sessions,
        settings,
        cashAccounts,
        cashTransactions,
        ingredients,
        stockMovements,
        salesTransactions,
        salesImportLogs,
        auditLogs,
        suppliers,
        purchaseOrders,
        shifts,
        employees,
        contracts,
        attendances,
        kpiRecords,
        updateSettings,
        login,
        logout,
        addUser,
        updateUser,
        deleteUser,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addContract,
        updateContract,
        addAttendance,
        updateAttendance,
        addKPI,
        updateKPI,
        addCashAccount,
        updateCashAccount,
        deleteCashAccount,
        addCashTransaction,
        deleteCashTransaction,
        addIngredient,
        updateIngredient,
        deleteIngredient,
        addStockMovement,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        addPurchaseOrder,
        updatePOStatus,
        markPOAsReceived,
        deletePurchaseOrder,
        openShift,
        closeShift,
        isSyncing,
        lastSyncTime,
        syncData,
        currentSessionId: deviceRef.current.sessionId || "",
        fetchSessions,
        revokeSession,
        revokeOtherSessions,
        wasForceLoggedOut,
        dismissForceLogoutAlert,
        isReadOnly:
          currentUser?.role === "OWNER" || currentUser?.role === "AUDITOR",
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
