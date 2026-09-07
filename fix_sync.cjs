const fs = require('fs');

const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const marker = 'app.post("/api/sync", async (req, res) => {';
const reqBodyIndex = content.indexOf(marker);
if (reqBodyIndex === -1) {
  console.error('marker not found');
  process.exit(1);
}

const txStart = content.indexOf('await db.transaction(async (tx) => {', reqBodyIndex);
const txEndStr = '      });\n      res.json({ success: true, serverTime: new Date().toISOString() });';
const txEnd = content.indexOf(txEndStr, txStart);

if (txStart === -1 || txEnd === -1) {
  console.error('Transaction block not found', { txStart, txEnd });
  process.exit(1);
}

const originalTxBlock = content.substring(txStart, txEnd + '      });'.length);

const entities = [
  { payloadKey: 'settings', schemaKey: 'settings', sanitizeFn: 'sanitizeSettings', isArray: false, extraCheck: 'settings !== null' },
  { payloadKey: 'cash_accounts', schemaKey: 'cashAccounts', sanitizeFn: 'sanitizeCashAccount', isArray: true },
  { payloadKey: 'users', schemaKey: 'users', sanitizeFn: 'sanitizeUser', isArray: true },
  { payloadKey: 'expense_categories', schemaKey: 'expenseCategories', sanitizeFn: 'sanitizeExpenseCategory', isArray: true },
  { payloadKey: 'budgets', schemaKey: 'budgets', sanitizeFn: 'sanitizeBudget', isArray: true },
  { payloadKey: 'employees', schemaKey: 'employees', sanitizeFn: 'sanitizeEmployee', isArray: true },
  { payloadKey: 'contracts', schemaKey: 'employeeContracts', sanitizeFn: 'sanitizeEmployeeContract', isArray: true },
  { payloadKey: 'attendances', schemaKey: 'attendanceRecords', sanitizeFn: 'sanitizeAttendanceRecord', isArray: true },
  { payloadKey: 'kpiRecords', schemaKey: 'kpiRecords', sanitizeFn: 'sanitizeKPIRecord', isArray: true },
  { payloadKey: 'payroll_records', schemaKey: 'payrollRecords', sanitizeFn: 'sanitizePayrollRecord', isArray: true },
  { payloadKey: 'suppliers', schemaKey: 'suppliers', sanitizeFn: 'sanitizeSupplier', isArray: true },
  { payloadKey: 'ingredients', schemaKey: 'ingredients', sanitizeFn: 'sanitizeIngredient', isArray: true },
  { payloadKey: 'purchase_orders', schemaKey: 'purchaseOrders', sanitizeFn: 'sanitizePurchaseOrder', isArray: true },
  { payloadKey: 'cash_transactions', schemaKey: 'cashTransactions', sanitizeFn: 'sanitizeCashTransaction', isArray: true },
  { payloadKey: 'stock_movements', schemaKey: 'stockMovements', sanitizeFn: 'sanitizeStockMovement', isArray: true },
  { payloadKey: 'sales_transactions', schemaKey: 'salesTransactions', sanitizeFn: 'sanitizeSalesTransaction', isArray: true },
  { payloadKey: 'sales_import_logs', schemaKey: 'salesImportLogs', sanitizeFn: 'sanitizeSalesImportLog', isArray: true },
  { payloadKey: 'audit_logs', schemaKey: 'auditLogs', sanitizeFn: 'sanitizeAuditLog', isArray: true, filterUserId: true },
  { payloadKey: 'shifts', schemaKey: 'shifts', sanitizeFn: 'sanitizeShift', isArray: true, filterUserId: true },
  { payloadKey: 'bank_reconciliations', schemaKey: 'bankReconciliations', sanitizeFn: 'sanitizeBankReconciliation', isArray: true },
  { payloadKey: 'bank_statement_lines', schemaKey: 'bankStatementLines', sanitizeFn: 'sanitizeBankStatementLine', isArray: true },
  { payloadKey: 'stock_opnames', schemaKey: 'stockOpnames', sanitizeFn: 'sanitizeStockOpname', isArray: true },
  { payloadKey: 'stock_opname_items', schemaKey: 'stockOpnameItems', sanitizeFn: 'sanitizeStockOpnameItem', isArray: true },
  { payloadKey: 'device_sessions', schemaKey: 'deviceSessions', sanitizeFn: 'sanitizeDeviceSession', isArray: true, filterUserId: true }
];

let newTxBlock = 'await db.transaction(async (tx) => {\n';
newTxBlock += '        // --- PHASE 1: DELETES (Child -> Parent) ---\n';
const reversedEntities = [...entities].reverse();
for (const ent of reversedEntities) {
  let cond = `${ent.payloadKey} !== undefined`;
  if (ent.extraCheck) cond += ` && ${ent.extraCheck}`;
  newTxBlock += `        if (${cond}) {\n          await tx.delete(schema.${ent.schemaKey});\n        }\n`;
}

newTxBlock += '\n        // --- PHASE 2: INSERTS (Parent -> Child) ---\n';
newTxBlock += '        let validUserIds: Set<string> | null = null;\n';
newTxBlock += '        if (users !== undefined && Array.isArray(users)) {\n';
newTxBlock += '          validUserIds = new Set(users.map((u: any) => String(u.id)));\n';
newTxBlock += '        }\n\n';

for (const ent of entities) {
  let cond = `${ent.payloadKey} !== undefined`;
  if (ent.extraCheck) cond += ` && ${ent.extraCheck}`;
  
  newTxBlock += `        if (${cond}) {\n`;
  if (ent.isArray) {
    newTxBlock += `          if (Array.isArray(${ent.payloadKey}) && ${ent.payloadKey}.length > 0) {\n`;
    
    if (ent.filterUserId) {
      newTxBlock += `            let filteredItems = ${ent.payloadKey};\n`;
      newTxBlock += `            if (validUserIds !== null) {\n`;
      newTxBlock += `              filteredItems = ${ent.payloadKey}.filter((item: any) => validUserIds!.has(String(item.userId)));\n`;
      newTxBlock += `            }\n`;
      newTxBlock += `            if (filteredItems.length > 0) {\n`;
      newTxBlock += `              await tx.insert(schema.${ent.schemaKey}).values(filteredItems.map(${ent.sanitizeFn}));\n`;
      newTxBlock += `            }\n`;
    } else {
      newTxBlock += `            await tx.insert(schema.${ent.schemaKey}).values(${ent.payloadKey}.map(${ent.sanitizeFn}));\n`;
    }
    
    newTxBlock += `          }\n`;
  } else {
    newTxBlock += `          await tx.insert(schema.${ent.schemaKey}).values([${ent.sanitizeFn}(${ent.payloadKey})]);\n`;
  }
  newTxBlock += `        }\n`;
}

newTxBlock += '      });';

content = content.replace(originalTxBlock, newTxBlock);

fs.writeFileSync(file, content);
console.log('Successfully updated server.ts sync logic with orphan filtering');
