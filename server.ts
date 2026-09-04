import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import { db } from "./src/db/db.ts";
import * as schema from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

const initialSettings = {
  id: "1",
  logoDataUrl: null,
  brandName: "Kedai Kopi Manager",
  companyAddress: "Alamat Kedai Kopi",
  bankDetails: "Bank BCA 1234567890",
  salesPerson: "Admin",
  footerMessage: "Terima kasih atas kunjungannya.",
  language: "id",
};

const initialUsers = [
  {
    id: "admin-1",
    username: "admin",
    pin: "1234",
    name: "Super Admin",
    role: "SUPER_ADMIN",
  },
];

async function ensureTables() {
  // Database schema is managed via Drizzle migration
}

async function startServer() {
  await ensureTables();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  const getTable = (tableName: string) => {
    switch (tableName) {
      case "cash_accounts":
        return schema.cashAccounts;
      case "cash_transactions":
        return schema.cashTransactions;
      case "settings":
        return schema.settings;
      case "users":
        return schema.users;
      case "device_sessions":
        return schema.deviceSessions;
      case "ingredients":
        return schema.ingredients;
      case "stock_movements":
        return schema.stockMovements;
      case "sales_transactions":
        return schema.salesTransactions;
      case "sales_import_logs":
        return schema.salesImportLogs;
      case "audit_logs":
        return schema.auditLogs;
      default:
        return null;
    }
  };

  const sanitizeIngredient = (i: any) => ({
    id: String(i.id || crypto.randomUUID()),
    name: String(i.name || ""),
    unit: String(i.unit || "pcs"),
    currentStock: Number(i.currentStock) || 0,
    minStock: Number(i.minStock) || 0,
    category: String(i.category || ""),
  });

  const sanitizeStockMovement = (m: any) => ({
    id: String(m.id || crypto.randomUUID()),
    ingredientId: String(m.ingredientId || ""),
    type: String(m.type || "IN"),
    quantity: Number(m.quantity) || 0,
    date: String(m.date || new Date().toISOString()),
    note: m.note ? String(m.note) : null,
    createdBy: String(m.createdBy || "System"),
  });

  const sanitizeSalesTransaction = (s: any) => ({
    id: String(s.id || crypto.randomUUID()),
    date: String(s.date || new Date().toISOString()),
    menuName: String(s.menuName || ""),
    quantitySold: Number(s.quantitySold) || 0,
    totalPrice: Number(s.totalPrice) || 0,
    importLogId: String(s.importLogId || ""),
  });

  const sanitizeSalesImportLog = (l: any) => ({
    id: String(l.id || crypto.randomUUID()),
    importDate: String(l.importDate || new Date().toISOString()),
    fileName: String(l.fileName || ""),
    rowCount: Number(l.rowCount) || 0,
    status: String(l.status || "SUCCESS"),
    createdBy: String(l.createdBy || "System"),
  });

  const sanitizeAuditLog = (a: any) => ({
    id: String(a.id || crypto.randomUUID()),
    userId: String(a.userId || ""),
    action: String(a.action || "CREATE"),
    tableName: String(a.tableName || ""),
    recordId: String(a.recordId || ""),
    timestamp: String(a.timestamp || new Date().toISOString()),
  });

  const sanitizeCashTransaction = (f: any) => ({
    id: String(f.id || crypto.randomUUID()),
    accountId: String(f.accountId || ""),
    type: String(f.type || "CASH_IN"),
    date: String(f.date || new Date().toISOString()),
    amount: Number(f.amount) || 0,
    description: String(f.description || ""),
    category: String(f.category || ""),
    referenceId: f.referenceId ? String(f.referenceId) : null,
  });

  const sanitizeCashAccount = (a: any) => ({
    id: String(a.id || crypto.randomUUID()),
    name: String(a.name || ""),
    type: String(a.type || "CASH"),
    isDefault: Boolean(a.isDefault),
  });

  const sanitizeSettings = (st: any) => ({
    id: "1",
    logoDataUrl: st?.logoDataUrl || null,
    brandName: String(st?.brandName || "Kedai Kopi Manager"),
    companyAddress: String(st?.companyAddress || ""),
    bankDetails: String(st?.bankDetails || ""),
    salesPerson: String(st?.salesPerson || ""),
    footerMessage: String(st?.footerMessage || ""),
    language: String(st?.language || "id"),
  });

  const sanitizeUser = (u: any) => ({
    id: String(u.id || crypto.randomUUID()),
    username: String(u.username || ""),
    pin: String(u.pin || "1234"),
    name: String(u.name || ""),
    role: String(u.role || "ADMIN_OPERASIONAL"),
  });

  const sanitizeEmployee = (e: any) => ({
    id: String(e.id || crypto.randomUUID()),
    nik: String(e.nik || ""),
    name: String(e.name || ""),
    position: String(e.position || ""),
    department: String(e.department || ""),
    employmentType: String(e.employmentType || ""),
    startDate: String(e.startDate || ""),
    endDate: e.endDate ? String(e.endDate) : null,
    phone: String(e.phone || ""),
    address: String(e.address || ""),
    status: String(e.status || ""),
    createdAt: String(e.createdAt || new Date().toISOString()),
  });

  const sanitizeEmployeeContract = (c: any) => ({
    id: String(c.id || crypto.randomUUID()),
    employeeId: String(c.employeeId || ""),
    effectiveDate: String(c.effectiveDate || ""),
    basicSalary: Number(c.basicSalary) || 0,
    mealAllowance: Number(c.mealAllowance) || 0,
    positionAllowance: Number(c.positionAllowance) || 0,
    alphaDeductionPerDay: Number(c.alphaDeductionPerDay) || 0,
    workingDaysPerMonth: Number(c.workingDaysPerMonth) || 0,
    notes: String(c.notes || ""),
  });

  const sanitizeAttendanceRecord = (a: any) => ({
    id: String(a.id || crypto.randomUUID()),
    employeeId: String(a.employeeId || ""),
    period: String(a.period || ""),
    presentDays: Number(a.presentDays) || 0,
    sickDays: Number(a.sickDays) || 0,
    permissionDays: Number(a.permissionDays) || 0,
    alphaDays: Number(a.alphaDays) || 0,
    holidayDays: Number(a.holidayDays) || 0,
    workingDays: Number(a.workingDays) || 0,
    notes: String(a.notes || ""),
    createdBy: String(a.createdBy || ""),
    createdAt: String(a.createdAt || new Date().toISOString()),
  });

  const sanitizeKPIRecord = (k: any) => ({
    id: String(k.id || crypto.randomUUID()),
    employeeId: String(k.employeeId || ""),
    quarter: Number(k.quarter) || 1,
    year: Number(k.year) || new Date().getFullYear(),
    targets: Array.isArray(k.targets) ? k.targets : [],
    totalScore: Number(k.totalScore) || 0,
    kpiBonus: Number(k.kpiBonus) || 0,
    notes: String(k.notes || ""),
    evaluatedBy: String(k.evaluatedBy || ""),
    createdAt: String(k.createdAt || new Date().toISOString()),
  });

  const sanitizeSupplier = (s: any) => ({
    id: String(s.id || crypto.randomUUID()),
    name: String(s.name || ""),
    picName: String(s.picName || ""),
    contact: String(s.contact || ""),
    address: String(s.address || ""),
    notes: String(s.notes || ""),
  });

  const sanitizePurchaseOrder = (p: any) => ({
    id: String(p.id || crypto.randomUUID()),
    poNumber: String(p.poNumber || ""),
    supplierId: String(p.supplierId || ""),
    date: String(p.date || new Date().toISOString()),
    items: Array.isArray(p.items) ? p.items : [],
    totalAmount: Number(p.totalAmount) || 0,
    status: String(p.status || "UNPAID"),
    deliveryStatus: String(p.deliveryStatus || "PENDING"),
  });

  const sanitizeShift = (s: any) => ({
    id: String(s.id || crypto.randomUUID()),
    userId: String(s.userId || ""),
    cashAccountId: String(s.cashAccountId || ""),
    startTime: String(s.startTime || new Date().toISOString()),
    endTime: s.endTime ? String(s.endTime) : null,
    startingCash: Number(s.startingCash) || 0,
    expectedEndingCash:
      s.expectedEndingCash !== null && s.expectedEndingCash !== undefined
        ? Number(s.expectedEndingCash)
        : null,
    actualEndingCash:
      s.actualEndingCash !== null && s.actualEndingCash !== undefined
        ? Number(s.actualEndingCash)
        : null,
    difference:
      s.difference !== null && s.difference !== undefined
        ? Number(s.difference)
        : null,
    status: String(s.status || "OPEN"),
  });

  // In-memory fallback state for offline usage
  let offlineState: any = null;

  app.get("/api/sync", async (req, res) => {
    try {
      let cash_accounts: any[] = [];
      let cash_transactions: any[] = [];
      let settings: any[] = [];
      let users: any[] = [];
      let device_sessions: any[] = [];
      let ingredients: any[] = [];
      let stock_movements: any[] = [];
      let sales_transactions: any[] = [];
      let sales_import_logs: any[] = [];
      let audit_logs: any[] = [];
      let employees: any[] = [];
      let employee_contracts: any[] = [];
      let attendance_records: any[] = [];
      let kpi_records: any[] = [];
      let suppliers: any[] = [];
      let purchase_orders: any[] = [];
      let shifts: any[] = [];

      try {
        [
          cash_accounts,
          cash_transactions,
          settings,
          users,
          device_sessions,
          ingredients,
          stock_movements,
          sales_transactions,
          sales_import_logs,
          audit_logs,
          employees,
          employee_contracts,
          attendance_records,
          kpi_records,
          suppliers,
          purchase_orders,
          shifts,
        ] = await Promise.all([
          db.select().from(schema.cashAccounts),
          db.select().from(schema.cashTransactions),
          db.select().from(schema.settings),
          db.select().from(schema.users),
          db.select().from(schema.deviceSessions),
          db.select().from(schema.ingredients),
          db.select().from(schema.stockMovements),
          db.select().from(schema.salesTransactions),
          db.select().from(schema.salesImportLogs),
          db.select().from(schema.auditLogs),
          db.select().from(schema.employees),
          db.select().from(schema.employeeContracts),
          db.select().from(schema.attendanceRecords),
          db.select().from(schema.kpiRecords),
          db.select().from(schema.suppliers),
          db.select().from(schema.purchaseOrders),
          db.select().from(schema.shifts),
        ]);

        // Auto seed if completely new database
        if (users.length === 0) {
          try {
            await db.transaction(async (tx) => {
              await tx
                .insert(schema.users)
                .values(initialUsers.map(sanitizeUser));
              await tx
                .insert(schema.settings)
                .values([sanitizeSettings(initialSettings)]);
            });
            users = initialUsers as any;
            settings = [initialSettings] as any;
          } catch (seedErr) {
            console.warn("Auto seed skipped or failed:", seedErr);
          }
        }
      } catch (dbErr) {
        console.error(
          "Database connection failed, using fallback data in memory:",
          dbErr,
        );
        if (offlineState) {
          return res.json({
            ...offlineState,
            serverTime: new Date().toISOString(),
          });
        }
        users = initialUsers as any;
        settings = [initialSettings] as any;
      }

      res.json({
        cash_accounts,
        cash_transactions,
        settings: settings.length > 0 ? settings[0] : initialSettings,
        users,
        device_sessions,
        ingredients,
        stock_movements,
        sales_transactions,
        sales_import_logs,
        audit_logs,
        suppliers,
        purchase_orders,
        shifts,
        employees,
        contracts: employee_contracts,
        attendances: attendance_records,
        kpiRecords: kpi_records,
        serverTime: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Sync error:", e);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/sync", async (req, res) => {
    try {
      const {
        cash_accounts,
        cash_transactions,
        settings,
        users,
        device_sessions,
        ingredients,
        stock_movements,
        sales_transactions,
        sales_import_logs,
        audit_logs,
        suppliers,
        purchase_orders,
        shifts,
        employees,
        contracts,
        attendances,
        kpiRecords,
      } = req.body;

      await db.transaction(async (tx) => {
        if (cash_accounts !== undefined) {
          await tx.delete(schema.cashAccounts);
          if (Array.isArray(cash_accounts) && cash_accounts.length > 0) {
            await tx
              .insert(schema.cashAccounts)
              .values(cash_accounts.map(sanitizeCashAccount));
          }
        }
        if (cash_transactions !== undefined) {
          await tx.delete(schema.cashTransactions);
          if (
            Array.isArray(cash_transactions) &&
            cash_transactions.length > 0
          ) {
            await tx
              .insert(schema.cashTransactions)
              .values(cash_transactions.map(sanitizeCashTransaction));
          }
        }
        if (settings !== undefined && settings !== null) {
          await tx.delete(schema.settings);
          await tx.insert(schema.settings).values([sanitizeSettings(settings)]);
        }
        if (users !== undefined) {
          await tx.delete(schema.users);
          if (Array.isArray(users) && users.length > 0) {
            await tx.insert(schema.users).values(users.map(sanitizeUser));
          }
        }
        if (ingredients !== undefined) {
          await tx.delete(schema.ingredients);
          if (Array.isArray(ingredients) && ingredients.length > 0) {
            await tx
              .insert(schema.ingredients)
              .values(ingredients.map(sanitizeIngredient));
          }
        }
        if (stock_movements !== undefined) {
          await tx.delete(schema.stockMovements);
          if (Array.isArray(stock_movements) && stock_movements.length > 0) {
            await tx
              .insert(schema.stockMovements)
              .values(stock_movements.map(sanitizeStockMovement));
          }
        }
        if (sales_transactions !== undefined) {
          await tx.delete(schema.salesTransactions);
          if (
            Array.isArray(sales_transactions) &&
            sales_transactions.length > 0
          ) {
            await tx
              .insert(schema.salesTransactions)
              .values(sales_transactions.map(sanitizeSalesTransaction));
          }
        }
        if (sales_import_logs !== undefined) {
          await tx.delete(schema.salesImportLogs);
          if (
            Array.isArray(sales_import_logs) &&
            sales_import_logs.length > 0
          ) {
            await tx
              .insert(schema.salesImportLogs)
              .values(sales_import_logs.map(sanitizeSalesImportLog));
          }
        }
        if (audit_logs !== undefined) {
          await tx.delete(schema.auditLogs);
          if (Array.isArray(audit_logs) && audit_logs.length > 0) {
            await tx
              .insert(schema.auditLogs)
              .values(audit_logs.map(sanitizeAuditLog));
          }
        }
        if (employees !== undefined) {
          await tx.delete(schema.employees);
          if (Array.isArray(employees) && employees.length > 0) {
            await tx
              .insert(schema.employees)
              .values(employees.map(sanitizeEmployee));
          }
        }
        if (contracts !== undefined) {
          await tx.delete(schema.employeeContracts);
          if (Array.isArray(contracts) && contracts.length > 0) {
            await tx
              .insert(schema.employeeContracts)
              .values(contracts.map(sanitizeEmployeeContract));
          }
        }
        if (attendances !== undefined) {
          await tx.delete(schema.attendanceRecords);
          if (Array.isArray(attendances) && attendances.length > 0) {
            await tx
              .insert(schema.attendanceRecords)
              .values(attendances.map(sanitizeAttendanceRecord));
          }
        }
        if (kpiRecords !== undefined) {
          await tx.delete(schema.kpiRecords);
          if (Array.isArray(kpiRecords) && kpiRecords.length > 0) {
            await tx
              .insert(schema.kpiRecords)
              .values(kpiRecords.map(sanitizeKPIRecord));
          }
        }
        if (suppliers !== undefined) {
          await tx.delete(schema.suppliers);
          if (Array.isArray(suppliers) && suppliers.length > 0) {
            await tx
              .insert(schema.suppliers)
              .values(suppliers.map(sanitizeSupplier));
          }
        }
        if (purchase_orders !== undefined) {
          await tx.delete(schema.purchaseOrders);
          if (Array.isArray(purchase_orders) && purchase_orders.length > 0) {
            await tx
              .insert(schema.purchaseOrders)
              .values(purchase_orders.map(sanitizePurchaseOrder));
          }
        }
        if (shifts !== undefined) {
          await tx.delete(schema.shifts);
          if (Array.isArray(shifts) && shifts.length > 0) {
            await tx.insert(schema.shifts).values(shifts.map(sanitizeShift));
          }
        }
      });
      res.json({ success: true, serverTime: new Date().toISOString() });
    } catch (e) {
      console.error("Save error (running in offline mode):", e);
      // Store in memory for offline usage so it doesn't get overwritten on next GET
      offlineState = {
        ...req.body,
        settings: req.body.settings || initialSettings,
      };
      res.json({
        success: true,
        serverTime: new Date().toISOString(),
        offline: true,
      });
    }
  });

  // Session management endpoints for Connected Devices & Force Logout
  app.get("/api/sessions", async (req, res) => {
    try {
      const allSessions = await db.select().from(schema.deviceSessions);
      // Filter active sessions and sort by lastActive descending
      const activeSessions = allSessions
        .filter((s) => s.status === "ACTIVE")
        .sort(
          (a, b) =>
            new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
        );

      res.json({ sessions: activeSessions });
    } catch (err) {
      console.error("Fetch sessions error:", err);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions/heartbeat", async (req, res) => {
    try {
      const {
        sessionId,
        userId,
        username,
        userName,
        deviceName,
        browser,
        os,
        deviceType,
        location,
      } = req.body;
      if (!sessionId || !userId) {
        return res.status(400).json({ error: "Missing required session info" });
      }

      // Check if session was explicitly REVOKED or expired
      const existing = await db
        .select()
        .from(schema.deviceSessions)
        .where(eq(schema.deviceSessions.id, sessionId));
      if (existing.length > 0) {
        if (existing[0].status === "REVOKED") {
          return res.json({ success: false, revoked: true, status: "REVOKED" });
        }
        const lastActiveDate = new Date(existing[0].lastActive).getTime();
        if (Date.now() - lastActiveDate > 60 * 60 * 1000) {
          // Auto-logout after 1 hour idle
          await db
            .update(schema.deviceSessions)
            .set({ status: "REVOKED" })
            .where(eq(schema.deviceSessions.id, sessionId));
          return res.json({ success: false, revoked: true, status: "EXPIRED" });
        }
      }

      const now = new Date().toISOString();
      const clientIp =
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        "Localhost";
      const formattedIp = Array.isArray(clientIp)
        ? clientIp[0]
        : String(clientIp).split(",")[0].trim();

      // Atomic UPSERT using PostgreSQL ON CONFLICT DO UPDATE
      await db
        .insert(schema.deviceSessions)
        .values({
          id: String(sessionId),
          userId: String(userId),
          username: String(username || "user"),
          userName: String(userName || "User"),
          deviceName: String(deviceName || "Browser"),
          browser: String(browser || "Web Browser"),
          os: String(os || "Unknown OS"),
          deviceType: String(deviceType || "desktop"),
          ipAddress: formattedIp,
          location: location ? String(location) : null,
          lastActive: now,
          createdAt: now,
          status: "ACTIVE",
        })
        .onConflictDoUpdate({
          target: schema.deviceSessions.id,
          set: {
            lastActive: now,
            userId: String(userId),
            username: String(username || "user"),
            userName: String(userName || "User"),
            deviceName: String(deviceName || "Browser"),
            browser: String(browser || "Web Browser"),
            os: String(os || "Unknown OS"),
            deviceType: String(deviceType || "desktop"),
            ipAddress: formattedIp,
            ...(location ? { location: String(location) } : {}),
          },
        });

      return res.json({ success: true, revoked: false, status: "ACTIVE" });
    } catch (err) {
      console.error("Session heartbeat error:", err);
      res.status(500).json({ error: "Failed to record session" });
    }
  });

  app.post("/api/sessions/:id/revoke", async (req, res) => {
    try {
      const { id } = req.params;
      await db
        .update(schema.deviceSessions)
        .set({ status: "REVOKED" })
        .where(eq(schema.deviceSessions.id, id));

      res.json({ success: true, message: "Session revoked successfully" });
    } catch (err) {
      console.error("Revoke session error:", err);
      res.status(500).json({ error: "Failed to revoke session" });
    }
  });

  app.post("/api/sessions/revoke-others", async (req, res) => {
    try {
      const { currentSessionId, userId } = req.body;
      const allSessions = await db.select().from(schema.deviceSessions);

      const toRevoke = allSessions.filter(
        (s) =>
          s.id !== currentSessionId &&
          s.status === "ACTIVE" &&
          (!userId || s.userId === userId),
      );

      for (const s of toRevoke) {
        await db
          .update(schema.deviceSessions)
          .set({ status: "REVOKED" })
          .where(eq(schema.deviceSessions.id, s.id));
      }

      res.json({
        success: true,
        count: toRevoke.length,
        message: `${toRevoke.length} other session(s) revoked`,
      });
    } catch (err) {
      console.error("Revoke others error:", err);
      res.status(500).json({ error: "Failed to revoke other sessions" });
    }
  });

  app.post("/api/sessions/logout", async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (sessionId) {
        await db
          .update(schema.deviceSessions)
          .set({ status: "REVOKED" })
          .where(eq(schema.deviceSessions.id, sessionId));
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Logout session error:", err);
      res.status(500).json({ error: "Failed to update session logout" });
    }
  });

  const rbacMiddleware = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const role = req.headers["x-user-role"] as string;
    const table = req.params.table;

    // By default, only SUPER_ADMIN has full access, OWNER is read-only (so no POST/PUT/DELETE)
    if (!role) return res.status(401).json({ error: "No role provided" });
    if (role === "SUPER_ADMIN") return next();
    if (role === "OWNER")
      return res.status(403).json({ error: "Owner is read-only" });

    if (role === "FINANCE") {
      if (table !== "cash_transactions" && table !== "settings") {
        return res
          .status(403)
          .json({ error: "Finance only has access to Cash Flow" });
      }
      return next();
    }
    if (role === "ADMIN_OPERASIONAL") {
      if (
        table !== "ingredients" &&
        table !== "stock_movements" &&
        table !== "sales_transactions" &&
        table !== "sales_import_logs"
      ) {
        return res
          .status(403)
          .json({
            error: "Admin Operasional only has access to Inventory and Sales",
          });
      }
      return next();
    }
    return res.status(403).json({ error: "Unauthorized role" });
  };

  const auditLogMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const originalSend = res.json;
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300 && body.success) {
        const userId = (req.headers["x-user-id"] as string) || "System";
        const action =
          req.method === "POST"
            ? "CREATE"
            : req.method === "PUT"
              ? "UPDATE"
              : "DELETE";
        const tableName = req.params.table;
        const recordId = req.params.id || req.body.id || "unknown";

        db.insert(schema.auditLogs)
          .values({
            id: crypto.randomUUID(),
            userId,
            action,
            tableName,
            recordId,
            timestamp: new Date().toISOString(),
          })
          .catch((err) => console.error("Failed to write audit log:", err));
      }
      return originalSend.call(this, body);
    };
    next();
  };

  app.post("/api/import/sales", async (req, res) => {
    try {
      const { sales_transactions, log } = req.body;
      const logId = crypto.randomUUID();

      await db.transaction(async (tx) => {
        // Insert log
        await tx.insert(schema.salesImportLogs).values({
          id: logId,
          importDate: new Date().toISOString(),
          fileName: log.fileName,
          rowCount: log.rowCount,
          status: "SUCCESS",
          createdBy: log.createdBy,
        });

        // Insert transactions
        if (
          Array.isArray(sales_transactions) &&
          sales_transactions.length > 0
        ) {
          const transactions = sales_transactions.map((s: any) => ({
            ...sanitizeSalesTransaction(s),
            importLogId: logId,
          }));
          await tx.insert(schema.salesTransactions).values(transactions);
        }
      });
      res.json({ success: true, logId });
    } catch (e) {
      console.error("Import sales error:", e);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post(
    "/api/:table",
    rbacMiddleware,
    auditLogMiddleware,
    async (req, res) => {
      try {
        const table = getTable(req.params.table);
        if (!table) return res.status(404).json({ error: "Table not found" });
        await db.insert(table).values(req.body);
        res.json({ success: true });
      } catch (e) {
        console.error("Insert error:", e);
        res.status(500).json({ error: "Internal error" });
      }
    },
  );

  app.put(
    "/api/:table/:id",
    rbacMiddleware,
    auditLogMiddleware,
    async (req, res) => {
      try {
        const table = getTable(req.params.table);
        if (!table) return res.status(404).json({ error: "Table not found" });
        await db.update(table).set(req.body).where(eq(table.id, req.params.id));
        res.json({ success: true });
      } catch (e) {
        console.error("Update error:", e);
        res.status(500).json({ error: "Internal error" });
      }
    },
  );

  app.delete(
    "/api/:table/:id",
    rbacMiddleware,
    auditLogMiddleware,
    async (req, res) => {
      try {
        const table = getTable(req.params.table);
        if (!table) return res.status(404).json({ error: "Table not found" });
        await db.delete(table).where(eq(table.id, req.params.id));
        res.json({ success: true });
      } catch (e) {
        console.error("Delete error:", e);
        res.status(500).json({ error: "Internal error" });
      }
    },
  );

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
