# CODEBASE MAP & PINPOINT INDEX

> **Instruksi untuk AI Agent:**
> Gunakan peta baris (`L...`) di bawah ini untuk langsung melompat menggunakan `read_file` dengan `StartLine` dan `EndLine` tanpa membaca keseluruhan file dari awal.
> Perbarui file ini jika Anda menambah endpoint, tabel, komponen baru, atau menggeser baris secara signifikan.

---

## 1. Arsitektur & File Utama
- **Backend & API Monolith**: [`server.ts`](file:///c:/Users/User/Documents/coffee%20management/server.ts) (~7.099 baris) — Express server, auto-migrasi DDL (`ensureTables`), sanitizers, autentikasi sesi, endpoint REST API, AI Gemini, POS, & KDS.
- **Database Schema (Drizzle ORM)**: [`src/db/schema.ts`](file:///c:/Users/User/Documents/coffee%20management/src/db/schema.ts) (~512 baris) & [`src/db/db.ts`](file:///c:/Users/User/Documents/coffee%20management/src/db/db.ts) (~37 baris).
- **Global Types & Interfaces**: [`src/types.ts`](file:///c:/Users/User/Documents/coffee%20management/src/types.ts) (~818 baris).
- **Global State & Sync Engine**: [`src/store/StoreContext.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/store/StoreContext.tsx) (~3.089 baris) — Context provider, sync `/api/sync`, offline localStorage fallback, dan mutasi data.
- **Theme & Global Toast Contexts**: [`src/context/ThemeContext.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/context/ThemeContext.tsx) (`ThemeProvider`, `useTheme`, `ThemeToggleButton`) & [`src/context/ToastContext.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/context/ToastContext.tsx) (`ToastProvider`, `useToast`, `toast`).
- **Root App & Routing View**: [`src/App.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/App.tsx) (~452 baris) & [`src/components/Layout.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/Layout.tsx) (~1.712 baris).
- **Feature Flags**: [`src/config/features.ts`](file:///c:/Users/User/Documents/coffee%20management/src/config/features.ts) (~25 baris).

---

## 2. Database Schema (`src/db/schema.ts`)
| Tabel | Baris | Tabel | Baris |
| :--- | :--- | :--- | :--- |
| `expenseCategories` | `L14` | `attendanceRecords` | `L275` |
| `budgets` | `L27` | `employeeShifts` | `L291` |
| `bankReconciliations` | `L37` | `dailyAttendances` | `L298` |
| `bankStatementLines` | `L50` | `dailyChecklists` | `L316` |
| `stockOpnames` | `L63` | `kpiRecords` | `L326` |
| `stockOpnameItems` | `L72` | `suppliers` | `L339` |
| `payrollRecords` | `L83` | `purchaseOrders` | `L348` |
| `cashAccounts` | `L108` | `shifts` | `L362` |
| `cashTransactions` | `L115` | `kpiTasks` | `L380` |
| `users` | `L131` | `kpiBonusRules` | `L393` |
| `settings` | `L144` | `closedPeriods` | `L401` |
| `deviceSessions` | `L173` | `orders` | `L411` |
| `ingredients` | `L189` | `orderItems` | `L448` |
| `recipes` | `L199` | `payments` | `L465` |
| `stockMovements` | `L205` | `posPrinters` | `L478` |
| `salesTransactions` | `L220` | `products` | `L492` |
| `salesImportLogs` | `L231` | `batchPreparations` | `L506` |
| `auditLogs` | `L240` | `promotions` | `L520` |
| `employees` | `L249` | `managerApprovalRequests` | `L537` |
| `employeeContracts` | `L264` | | |

---

## 3. Types & Interfaces (`src/types.ts`)
- **Auth & Role**: `Role` (`L3`), `User` (`L14`), `ViewState` (`L28`), `DeviceSession` (`L295`), `Settings` (`L360`), `AuditLog` (`L606`)
- **Finance & Accounting**: `ExpenseCategoryType` (`L61`), `ExpenseCategory` (`L70`), `Budget` (`L83`), `BankReconciliation` (`L154`), `BankStatementLine` (`L167`), `CashAccount` (`L404`), `CashTransactionItem` (`L411`), `CashTransaction` (`L419`), `ClosedPeriod` (`L665`)
- **HR, Payroll & KPI**: `EmploymentType` (`L56`), `EmployeeStatus` (`L57`), `PayrollRecord` (`L95`), `Employee` (`L188`), `EmployeeContract` (`L204`), `AttendanceRecord` (`L220`), `EmployeeShift` (`L236`), `DailyAttendance` (`L243`), `DailyChecklist` (`L265`), `KPIRecord` (`L275`), `KPITarget` (`L288`), `TaskItemDetail` (`L312`), `TaskCategoryGroup` (`L320`), `LeaderAllowanceRule` (`L326`), `ShiftDefinition` (`L343`)
- **Inventory, Recipe & Purchasing**: `StockOpname` (`L132`), `StockOpnameItem` (`L141`), `Ingredient` (`L437`), `StockMovement` (`L453`), `RecipeIngredient` (`L493`), `Recipe` (`L498`), `ProductDivision` (`L505`), `PackagingOption` (`L507`), `ProductVariant` (`L515`), `ProductModifier` (`L529`), `ProductModifierGroup` (`L537`), `Product` (`L545`), `BatchPreparation` (`L559`), `Supplier` (`L615`), `PurchaseOrderItem` (`L624`), `PurchaseOrder` (`L631`)
- **Sales, POS & KDS**: `DailySalesRecap` (`L468`), `SalesTransaction` (`L482`), `SalesImportLog` (`L597`), `ShiftSession` (`L649`), `OrderType`/`OrderStatus`/`PaymentMethod` (`L675-L680`), `OrderModifier` (`L682`), `OrderItem` (`L689`), `Payment` (`L706`), `Order` (`L719`), `PosPrinter` (`L758`), `Promotion` (`L774`), `ManagerApprovalRequest` (`L794`)

---

## 4. Backend Server (`server.ts` - 7.099 Baris)

### A. Seed Data, DB Init & Sanitizers (`L1 - L1588`)
- `initialSettings` (`L25`), `initialUsers` (`L52`), `initialIngredients` (`L127`), `initialRecipes` (`L143`), `initialProducts` (`L190`), `defaultCategories` (`L263`)
- `ensureTables()` (`L307 - L725`) — DDL pembuatan/migrasi otomatis tabel PostgreSQL
- `startServer()` (`L726`) & `getTable()` (`L754`)
- **Sanitizers**: `sanitizeIngredient` (`L829`), `sanitizeRecipe` (`L839`), `sanitizeStockMovement` (`L879`), `sanitizeSalesTransaction` (`L893`), `sanitizeCashTransaction` (`L922`), `sanitizeExpenseCategory` (`L948`), `sanitizeBudget` (`L959`), `sanitizeBankReconciliation` (`L968`), `sanitizeStockOpname` (`L993`), `sanitizePayrollRecord` (`L1012`), `sanitizeCashAccount` (`L1037`), `sanitizeSettings` (`L1044`), `sanitizeUser` (`L1098`), `sanitizeEmployee` (`L1192`), `sanitizePurchaseOrder` (`L1292`), `sanitizeShift` (`L1306`), `sanitizePromotion` (`L1335`)
- **Auth & Security Helpers**:
  - `inMemoryState` (`L1380`)
  - `resolveAuthUser(req)` (`L1430`)
  - `verifyPosPin(...)` (`L1467`)
  - `POS_MODULE_ENABLED` / `KDS_MODULE_ENABLED` (`L1568`)

### B. REST API Endpoints (`L1589 - L6985`)
- **Health & Sync**:
  - `GET /api/health` (`L745`)
  - `GET /api/sync` (`L1602 - L2005`) — Load seluruh state dari DB ke klien
  - `POST /api/sync` (`L2267 - L2857`) — Simpan perubahan state dari klien ke DB
- **Auth, Users & Device Sessions**:
  - `POST /api/pos/verify-pin` (`L1589`)
  - `POST /api/login` (`L2006`)
  - `POST /api/users/:id/unsuspend` (`L2206`)
  - `GET /api/sessions` (`L2858`)
  - `POST /api/sessions/heartbeat` (`L2913`)
  - `POST /api/sessions/:id/revoke` (`L3023`)
  - `POST /api/sessions/revoke-others` (`L3038`)
  - `POST /api/sessions/logout` (`L3068`)
- **Sales Import & Generic CRUD**:
  - `POST /api/import/sales` (`L3178`)
  - Generic Table CRUD `/api/:table` (`POST L3311`, `PUT L3328`, `DELETE L3345`)
- **AI / Gemini Endpoints**:
  - `generateContentWithFallback` (`L3369`)
  - `POST /api/ai/parse-receipt` (`L3569`)
  - `POST /api/ai/parse-natural-entry` (`L3815`)
  - `POST /api/ai/executive-insights` (`L4006`)
  - `POST /api/ai/ask-advisor` (`L4122`)
  - `GET /api/ai/status` (`L6989`)
  - `POST /api/ai/test-key` (`L7019`)
- **POS, Order, Split, Void, Refund & Approval**:
  - `GET /api/pos/menu` (`L4200`)
  - `POST /api/pos/orders` (`L4328`) — Buat order / open bill / deduct stok resep
  - `POST /api/pos/orders/:id/pay` (`L4650`)
  - `POST /api/pos/orders/:id/split` (`L4848`)
  - `POST /api/pos/orders/:id/void` (`L5266`)
  - `POST /api/pos/orders/:id/refund` (`L5467`)
  - `POST /api/pos/approvals/request` (`L5683`)
  - `GET /api/pos/approvals/pending` (`L5741`)
  - `GET /api/pos/approvals/:id/status` (`L5764`)
  - `GET /api/pos/approvals/history` (`L5792`)
  - `POST /api/pos/approvals/:id/respond` (`L5817`)
  - `GET /api/pos/orders/active` (`L6185`)
  - `GET /api/pos/orders/today` (`L6224`)
  - `GET /api/pos/orders/all` (`L6268`)
  - `GET /api/pos/orders/:id` (`L6376`)
  - `GET /api/pos/printers` (`L6401`) & `POST /api/pos/printers` (`L6413`)
- **Kitchen Display System (KDS)**:
  - `GET /api/kds/tickets` (`L6493`)
  - `POST /api/kds/items/:id/status` (`L6580`)
  - `POST /api/kds/orders/:id/status` (`L6640`)
- **Dashboard & Admin**:
  - `GET /api/dashboard/summary` (`L6765`)
  - `POST /api/admin/reset-transactions` (`L6865`)

---

## 5. Global State (`src/store/StoreContext.tsx` - 3.089 Baris)
- **Default Data Constants**: `DEFAULT_INITIAL_INGREDIENTS` (`L73`), `DEFAULT_BATCH_PREPARATIONS` (`L95`), `DEFAULT_PRODUCTS` (`L174`), `DEFAULT_EXPENSE_CATEGORIES` (`L353`)
- **Interface**: `StoreContextType` (`L395 - L590`)
- **Sync & Auth**:
  - `StoreProvider` (`L623`)
  - `fetchFromServer` (`L1054`)
  - `sendHeartbeat` (`L1374`), `fetchSessions` (`L1412`), `revokeSession` (`L1431`), `revokeOtherSessions` (`L1453`)
  - Auto-sync `useEffect` (`L1495 - L1615`)
  - `updateSettings` (`L1622`), `login` (`L1654`), `unsuspendUser` (`L1698`), `syncData` (`L1761`)
- **Domain Actions**:
  - **HR & KPI**: `addEmployee` (`L1803`), `updateEmployee` (`L1814`), `deleteEmployee` (`L1865`), `addContract` (`L1876`), `addAttendance` (`L1897`), `addDailyAttendance` (`L1920`), `addKPI` (`L1957`), `updateKpiTask` (`L1978`), `updateKpiBonusRule` (`L1997`)
  - **Users & Cash**: `updateUser` (`L2016`), `deleteUser` (`L2068`), `addCashAccount` (`L2075`), `addCashTransaction` (`L2095`), `updateCashTransaction` (`L2116`), `deleteCashTransaction` (`L2137`)
  - **Inventory, Recipe, Product & Batch Prep**: `addIngredient` (`L2143`), `updateIngredient` (`L2151`), `addRecipe` (`L2163`), `addProduct` (`L2182`), `updateProduct` (`L2195`), `addBatchPreparation` (`L2209`), `executeBatchCook` (`L2230`)
  - **Supplier & Purchase Order**: `addSupplier` (`L2355`), `addPurchaseOrder` (`L2376`), `addDirectMarketPurchase` (`L2440`), `payPurchaseOrder` (`L2537`), `markPOAsReceived` (`L2582`), `deletePurchaseOrder` (`L2621`)
  - **Shift, Promo, Stock Movement & Sales Recap**: `openShift` (`L2627`), `closeShift` (`L2634`), `addPromotion` (`L2658`), `addStockMovement` (`L2712`), `addSalesTransactions`, `addDailySalesRecap`, `updateDailySalesRecap`, `settleDailySalesRecapNonCash`, `deleteDailySalesRecap`

---

## 6. Komponen UI Besar (Pinpoint per File)

### [`src/components/HRManagement.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/HRManagement.tsx) (4.349 Baris)
- Shift Config Handlers (`L258 - L324`)
- Attendance Approval & Correction (`L325 - L453`)
- Employee & Contract CRUD + Import (`L454 - L736`)
- Weekly Schedule & Approval Logic (`L737 - L1055`)
- Charts & PDF Schedule Export (`L1056 - L1300`)
- Render UI Tabs (`L1301 - L4349`)

### [`src/components/Inventory.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/Inventory.tsx) (4.222 Baris)
- Presets & Waste Reasons (`L53 - L189`)
- Quick Waste & Stock Transfer Handlers (`L366 - L496`)
- Ingredient CRUD & Import/Export (`L497 - L947`)
- Stock Movement & Stock Opname Handlers (`L948 - L1380`)
- **Tab Views**:
  - Tab `ingredients` (`L1617 - L1924`)
  - Tab `movements` (`L1925 - L2111`)
  - Tab `opnames` (`L2112 - L2861`)
  - Tab `recipes` (`L2862 - L3001`)
  - Tab `waste` (`L3002 - L3400`)
  - Modals (Add/Edit Ingredient, Quick Waste, Transfer, dll.) (`L3401 - L4222`)

### [`src/components/Payroll.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/Payroll.tsx) (2.889 Baris)
- Payroll Calculation & Generation (`L420 - L492`)
- Approval, Payment & Export Handlers (`L493 - L712`)
- Manual Payroll Entry (`L713 - L1115`)
- Tab `list` (`L1166 - L1760`) & Tab `generate` (`L1761 - L2889`)

### [`src/components/CashFlow.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/CashFlow.tsx) (3.695 Baris)
- Multi-item Row Handlers, HPP Sync Preview & AI Draft Pre-fill (`L515 - L1015`)
- Submit & Delete Cash Transaction (`L1016 - L1250`)
- Cash Account CRUD & CSV Import (`L1252 - L1420`)
- Render Tabel Arus Kas & Modal Form (`L1450 - L3795`)

### [`src/components/LeaderChecklist.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/LeaderChecklist.tsx) (2.601 Baris)
- Default Categories (BAR/KITCHEN/BAKER) & Helpers (`L18 - L258`)
- Allowance Rules CRUD (`L321 - L537`)
- Save Daily Checklist (`L538 - L916`)
- Task Category & Subtask Config (`L917 - L1055`)
- Tab `monitoring` (`L1091`), Tab `monthly` (`L1385`), Tab `settings` (`L1700+`)

### [`src/components/Sales.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/Sales.tsx) (2.673 Baris)
- Daily Recap Save/Delete (`L185 - L293`)
- Sales Import & Export (`L480 - L640`)
- **Tab Views**:
  - Tab `cashier_analytics` (`L787 - L1154`)
  - Tab `daily_recap` (`L1155 - L1552`)
  - Tab `pos_orders` (`L1553 - L1922`)
  - Tab `sales` (`L1923 - L2103`)
  - Tab `logs` (`L2104 - L2534`)

### [`src/components/ManagerDashboard.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/ManagerDashboard.tsx) (2.243 Baris)
- AI Copilot & Quick Schedule Approval (`L126 - L300`)
- Operational Metrics & Render (`L301 - L2243`)

### [`src/components/HppCalculator.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/HppCalculator.tsx) (2.357 Baris)
- Recipe Presets & Loader (`L406 - L583`)
- Ingredient Item & Packaging Handlers (`L584 - L787`)
- Save to Recipes / Publish Product / Batch Prep (`L788 - L959`)
- AI HPP Advisor (`L960 - L1090`)
- Tab `simulator` (`L1159 - L1949`) & Tab `catalog` (`L1950 - L2357`)

### [`src/components/Purchases.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/Purchases.tsx) (2.414 Baris)
- PO Checkout, Multi-Kemasan & Export (`L350 - L470`)
- Tab `new_po` (`L580 - L1315`), Tab `payables` (`L1316 - L1765`), Tab `history` (`L1766 - L2414`)

### [`src/components/pos/PosTerminal.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/pos/PosTerminal.tsx) (1.995 Baris)
- Lock Screen & PIN Unlock (`L191 - L370`)
- Cart & Customization Handlers (`L501 - L617`)
- Open Bill Save & Load (`L618 - L800`)
- Render Grid Menu, Keranjang & Modals (`L801 - L1995`)

### [`src/components/MenuManagement.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/MenuManagement.tsx) (1.976 Baris)
- Batch Cook & Bulk Recalculate HPP (`L235 - L368`)
- Tabs `BAR` / `KITCHEN` / `BAKER` / `BATCH_PREP` (`L369 - L1200`)
- Product Modal (`L1201 - L1630`) & Batch Prep Modal (`L1631 - L1976`)

### Komponen Lainnya
- [`src/components/OwnerDashboard.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/OwnerDashboard.tsx) (1.608 baris)
- [`src/components/Layout.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/Layout.tsx) (1.712 baris)
- [`src/components/FinanceReports.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/FinanceReports.tsx) (1.524 baris)
- [`src/components/AIAssistantModal.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/AIAssistantModal.tsx) (2.201 baris)
- [`src/components/EmployeeDashboard.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/EmployeeDashboard.tsx) (1.253 baris)
- [`src/components/ExpenseCategories.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/ExpenseCategories.tsx) (1.057 baris)
- [`src/components/FinanceDashboard.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/FinanceDashboard.tsx) (954 baris)
- [`src/components/PromotionsManagement.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/PromotionsManagement.tsx) (868 baris)
- [`src/components/ExportModal.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/ExportModal.tsx) (866 baris)
- [`src/components/Users.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/Users.tsx) (797 baris)
- [`src/components/ClockIn.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/ClockIn.tsx) (761 baris)
- [`src/components/KPI.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/KPI.tsx) (723 baris)
- [`src/components/Settings.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/Settings.tsx) (706 baris)
- [`src/components/ShiftManagement.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/ShiftManagement.tsx) (664 baris)
- [`src/components/PayslipModal.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/PayslipModal.tsx) (655 baris)
- [`src/components/Login.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/Login.tsx) (571 baris)
- [`src/components/Dashboard.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/Dashboard.tsx) (563 baris)
- [`src/components/BankReconciliation.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/BankReconciliation.tsx) (529 baris)
- [`src/components/AuditLogViewer.tsx`](file:///c:/Users/User/Documents/coffee%20management/src/components/AuditLogViewer.tsx) (523 baris)
- **POS Sub-modals (`src/components/pos/`)**: `PosTodayOrdersModal.tsx` (862), `PosOpenBillsModal.tsx` (793), `PosShiftModal.tsx` (766), `PosPaymentModal.tsx` (667), `KitchenDisplaySystem.tsx` (570), `PosCustomizeModal.tsx` (486), `PosManagerPinModal.tsx` (435), `PosReceiptModal.tsx` (382), `PosPrinterSettingsModal.tsx` (337), `PosCashierLogin.tsx` (305), `PosQuickWasteModal.tsx` (232).

---

## 7. Utilities (`src/utils/`)
- [`src/utils/export.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/export.ts) (1.188 baris) — PDF & CSV export
- [`src/utils/exportXlsx.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/exportXlsx.ts) (925 baris) — Excel `.xlsx` generator
- [`src/utils/posDomainLogic.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/posDomainLogic.ts) (1.391 baris) — Kalkulasi diskon, pajak, service charge, HPP resep, sinkronisasi HPP arus kas & PO (`calculateCashFlowHppSync` termasuk `wastagePercent` & `overheadPercent`, `getIngredientPackagingChoices`), NLP Finance parser (`parseSmartCoffeeTextEntry`), dan validasi POS
- [`src/utils/financeMetrics.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/financeMetrics.ts) — Baseline otomatis overhead & BEP (`computeAutoOverheadBaseline`, `calculateHppOverheadSimulation`, `getPreviousPeriodString`), kalkulasi HPP + Overhead persentase (`calculateHppWithOverheadPercentage`), HPP periodik Opname Opsi A (`computePeriodicOpnameCogs`), pemisahan kas operasional vs tabungan (`computeCashLiquidityBreakdown`, `computePeriodSavingsFlow`), helper klasifikasi biaya (`isCapexCashTransaction`, `isAdminBankOrMdrTransaction`), agregasi & rekonsiliasi terpusat Penjualan/Rekap/Arus Kas (`computePeriodFinancialSummary`, `isNonOperationalCashTransaction`, `isSalesCashTransaction`, `getSaleTransactionAmount`), helper kategori bahan baku (`DEFAULT_INGREDIENT_CATEGORIES`, `matchesIngredientCategory`, `normalizeIngredientCategoryName`), serta indikator kesehatan biaya F&B (`calculateFnbHealthMetrics`)
- [`src/utils/escpos.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/escpos.ts) (289 baris) — Thermal printer ESC/POS formatter
- [`src/utils/excelTemplate.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/excelTemplate.ts) (199 baris) — Template import Excel
- [`src/utils/salesImportMapper.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/salesImportMapper.ts) (157 baris) — Mapper import data penjualan eksternal
- [`src/utils/imageCompressor.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/imageCompressor.ts) (134 baris) — Kompresi foto/bukti
- [`src/utils/posOfflineQueue.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/posOfflineQueue.ts) (106 baris) — Antrean transaksi offline POS
- [`src/utils/genericImport.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/genericImport.ts) (105 baris) — Parser CSV/Excel generik
- [`src/utils/whatsappReceipt.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/whatsappReceipt.ts) (90 baris) — Format nota WhatsApp
- [`src/utils/attendanceRecap.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/attendanceRecap.ts) — Resolusi ID karyawan kanonik, klasifikasi status presensi harian, kalkulasi durasi kerja (termasuk lintas tengah malam), pembaruan koreksi Manager, agregasi rekap absensi bulanan, dan sinkronisasi rekap manual
- [`src/utils/deviceDetector.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/deviceDetector.ts) (84 baris), [`src/utils/i18n.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/i18n.ts) (81 baris), [`src/utils/dateUtils.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/dateUtils.ts) (62 baris), [`src/utils/format.ts`](file:///c:/Users/User/Documents/coffee%20management/src/utils/format.ts) (8 baris).
