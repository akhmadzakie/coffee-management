import React, { useState, useMemo, useRef } from "react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import { PayrollRecord } from "../types";
import {
  Calculator,
  CheckCircle,
  Clock,
  Download,
  Search,
  Wallet,
  AlertCircle,
  FileText
} from "lucide-react";

export function Payroll() {
  const {
    employees,
    contracts,
    attendances,
    kpiRecords,
    payrollRecords,
    addPayrollRecord,
    updatePayrollRecord,
    bulkAddPayrollRecords,
    cashAccounts,
    addCashTransaction,
    expenseCategories,
    currentUser,
    users,
    isReadOnly
  } = (useStore() as any);

  const [period, setPeriod] = useState(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"list" | "generate">("list");
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);

  const isFinance = currentUser?.role === "FINANCE" || currentUser?.role === "SUPER_ADMIN";
  const isHRD = currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN";
  const canApprove = isHRD || currentUser?.role === "OWNER";
  const canPay = isFinance || currentUser?.role === "OWNER";

  // Filter records based on period
  const currentPeriodRecords = useMemo(() => {
    let filtered = (payrollRecords || []).filter((r: PayrollRecord) => r.period === period);
    if (searchTerm) {
      filtered = filtered.filter((r: PayrollRecord) => {
        const empName = employees.find((e: any) => e.id === r.employeeId)?.name || "";
        return empName.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }
    return filtered;
  }, [payrollRecords, period, searchTerm, employees]);

  // Generate calculations for employees
  const generatedCalculations = useMemo(() => {
    return employees
      .filter((e: any) => e.status === "AKTIF")
      .map((emp: any) => {
        const contract = contracts.find((c: any) => c.employeeId === emp.id && c.status === "ACTIVE");
        const attendance = attendances.find((a: any) => a.employeeId === emp.id && a.period === period);
        const kpi = kpiRecords.find((k: any) => k.employeeId === emp.id && k.period === period);

        const basicSalary = contract?.baseSalary || 0;
        const positionAllowance = contract?.positionAllowance || 0;
        const mealAllowanceRate = contract?.mealAllowance || 0;
        
        const presentDays = attendance?.presentDays || 0;
        const alphaDays = attendance?.alphaDays || 0;

        const totalMealAllowance = presentDays * mealAllowanceRate;
        const alphaDeduction = alphaDays * (basicSalary / 22); // Assuming 22 working days
        const kpiBonus = kpi?.bonusAmount || 0;

        const grossPay = basicSalary + positionAllowance + totalMealAllowance + kpiBonus;
        const netPay = grossPay - alphaDeduction;

        const existingRecord = (payrollRecords || []).find(
          (r: PayrollRecord) => r.employeeId === emp.id && r.period === period
        );

        return {
          emp,
          existingRecord,
          calculation: {
            employeeId: emp.id,
            period,
            basicSalary,
            mealAllowance: totalMealAllowance,
            positionAllowance,
            kpiBonus,
            alphaDeduction,
            otherDeductions: 0,
            grossPay,
            netPay: netPay > 0 ? netPay : 0,
            status: "DRAFT" as const,
          }
        };
      });
  }, [employees, contracts, attendances, kpiRecords, period, payrollRecords]);

  const handleGenerateAll = () => {
    const newRecords = generatedCalculations
      .filter(item => !item.existingRecord)
      .map(item => ({
        id: `pay-${Date.now()}-${item.emp.id}`,
        ...item.calculation,
        createdAt: new Date().toISOString()
      }));

    if (newRecords.length > 0) {
      if (confirm(`Generate ${newRecords.length} slip gaji untuk periode ${period}?`)) {
        bulkAddPayrollRecords(newRecords);
        setActiveTab("list");
      }
    } else {
      alert("Semua slip gaji untuk periode ini sudah tergenerate.");
      setActiveTab("list");
    }
  };

  const handleUpdateStatus = (record: PayrollRecord, newStatus: "APPROVED" | "PAID") => {
    if (newStatus === "PAID") {
      // Find default or first bank account
      const account = cashAccounts.find((a: any) => a.type === "BANK") || cashAccounts[0];
      if (!account) {
        alert("Tidak ada akun kas/bank untuk pembayaran.");
        return;
      }
      if (confirm(`Bayar gaji ini menggunakan akun: ${account.name}?`)) {
        // Find "Gaji" category ID
        const salaryCat = expenseCategories?.find((c: any) => c.name.toLowerCase().includes("gaji"));

        addCashTransaction({
          accountId: account.id,
          type: "CASH_OUT",
          date: new Date().toISOString(),
          amount: record.netPay,
          description: `Pembayaran Gaji - ${employees.find((e: any) => e.id === record.employeeId)?.name} (${record.period})`,
          category: salaryCat ? salaryCat.name : "Gaji Karyawan",
          categoryId: salaryCat ? salaryCat.id : null,
          referenceId: record.id,
        });

        updatePayrollRecord({
          ...record,
          status: newStatus,
          paidDate: new Date().toISOString(),
          paidVia: account.id
        });
      }
    } else {
      updatePayrollRecord({
        ...record,
        status: newStatus
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Penggajian (Payroll)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kalkulasi otomatis take-home pay berdasarkan kehadiran dan kontrak
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent"
          />
          {!isReadOnly && isHRD && (
            <button
              onClick={() => setActiveTab(activeTab === "generate" ? "list" : "generate")}
              className="flex items-center gap-2 bg-primary hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {activeTab === "generate" ? "Lihat Riwayat" : <><Calculator size={16} /> Generate Payroll</>}
            </button>
          )}
        </div>
      </div>

      {activeTab === "generate" ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="font-semibold text-slate-800">Preview Kalkulasi Gaji ({period})</h2>
            <button 
              onClick={handleGenerateAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Simpan & Generate Semua Draft
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="p-4 font-medium border-b border-slate-200">Karyawan</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Gaji Pokok</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Tunjangan</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Bonus KPI</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Potongan Alpha</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right text-emerald-700">Take Home Pay</th>
                  <th className="p-4 font-medium border-b border-slate-200">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {generatedCalculations.map(({ emp, calculation, existingRecord }) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">{emp.name}</td>
                    <td className="p-4 text-right">{formatCurrency(calculation.basicSalary)}</td>
                    <td className="p-4 text-right">{formatCurrency(calculation.positionAllowance + calculation.mealAllowance)}</td>
                    <td className="p-4 text-right text-emerald-600">+{formatCurrency(calculation.kpiBonus)}</td>
                    <td className="p-4 text-right text-rose-600">-{formatCurrency(calculation.alphaDeduction)}</td>
                    <td className="p-4 text-right font-bold text-slate-800">{formatCurrency(calculation.netPay)}</td>
                    <td className="p-4">
                      {existingRecord ? (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium border border-slate-200">Sudah Digenerate</span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium border border-amber-200">Baru (Draft)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
            <h2 className="font-semibold text-slate-800">Daftar Slip Gaji ({period})</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari karyawan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="p-4 font-medium border-b border-slate-200">Karyawan</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Gaji Pokok</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right text-emerald-700">Take Home Pay</th>
                  <th className="p-4 font-medium border-b border-slate-200">Status</th>
                  <th className="p-4 font-medium border-b border-slate-200 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {currentPeriodRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      <Calculator className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p>Belum ada data penggajian untuk periode ini.</p>
                      {isHRD && (
                        <button 
                          onClick={() => setActiveTab("generate")}
                          className="mt-3 text-primary hover:underline text-sm font-medium"
                        >
                          Generate sekarang
                        </button>
                      )}
                    </td>
                  </tr>
                ) : currentPeriodRecords.map((record: PayrollRecord) => {
                  const empName = employees.find((e: any) => e.id === record.employeeId)?.name || users.find((u: any) => u.id === record.employeeId)?.name || "Unknown";
                  return (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-800">{empName}</td>
                      <td className="p-4 text-right">{formatCurrency(record.basicSalary)}</td>
                      <td className="p-4 text-right font-bold text-slate-800">{formatCurrency(record.netPay)}</td>
                      <td className="p-4">
                        {record.status === "DRAFT" && (
                          <span className="flex w-fit items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium border border-slate-200">
                            <Clock size={12} /> Draft
                          </span>
                        )}
                        {record.status === "APPROVED" && (
                          <span className="flex w-fit items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200">
                            <CheckCircle size={12} /> Disetujui
                          </span>
                        )}
                        {record.status === "PAID" && (
                          <span className="flex w-fit items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium border border-emerald-200">
                            <Wallet size={12} /> Dibayar
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedPayroll(record)}
                            className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                            title="Lihat Detail & Slip Gaji"
                          >
                            <FileText size={16} />
                          </button>
                          
                          {record.status === "DRAFT" && canApprove && !isReadOnly && (
                            <button
                              onClick={() => handleUpdateStatus(record, "APPROVED")}
                              className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded font-medium transition-colors"
                            >
                              Setujui
                            </button>
                          )}
                          
                          {record.status === "APPROVED" && canPay && !isReadOnly && (
                            <button
                              onClick={() => handleUpdateStatus(record, "PAID")}
                              className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs rounded font-medium transition-colors"
                            >
                              Tandai Dibayar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slip Gaji Modal */}
      {selectedPayroll && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                Detail Slip Gaji
              </h3>
              <button onClick={() => setSelectedPayroll(null)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
              <div className="text-center mb-6">
                <h4 className="font-bold text-lg">{employees.find((e: any) => e.id === selectedPayroll.employeeId)?.name}</h4>
                <p className="text-slate-500">Periode: {selectedPayroll.period}</p>
                <div className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
                  Status: {selectedPayroll.status}
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-800 border-b pb-1 mb-2">Penghasilan</p>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Gaji Pokok</span>
                  <span className="font-medium">{formatCurrency(selectedPayroll.basicSalary)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Tunjangan Jabatan</span>
                  <span className="font-medium">{formatCurrency(selectedPayroll.positionAllowance)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Uang Makan</span>
                  <span className="font-medium">{formatCurrency(selectedPayroll.mealAllowance)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Bonus KPI</span>
                  <span className="font-medium text-emerald-600">+{formatCurrency(selectedPayroll.kpiBonus)}</span>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-800 border-b pb-1 mb-2 mt-4">Potongan</p>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Potongan Ketidakhadiran</span>
                  <span className="font-medium text-rose-600">-{formatCurrency(selectedPayroll.alphaDeduction)}</span>
                </div>
                {selectedPayroll.otherDeductions > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-600">Potongan Lainnya</span>
                    <span className="font-medium text-rose-600">-{formatCurrency(selectedPayroll.otherDeductions)}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t-2 border-slate-200">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-800">Total Take Home Pay</span>
                  <span className="font-bold text-lg text-primary">{formatCurrency(selectedPayroll.netPay)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
