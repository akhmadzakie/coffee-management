import React, { useState, useMemo, useRef } from "react";
import { getLocalDateString } from "../utils/dateUtils";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Trash2,
  Wallet,
  Building2,
  Landmark,
  Settings2,
  Smartphone,
  Download,
  Upload,
  CheckCircle,
} from "lucide-react";
import { CashAccount } from "../types";
import { CsvImportExport } from "./common/CsvImportExport";


export const CashFlow = () => {
  const {
    cashTransactions,
    addCashTransaction,
    updateCashTransaction,
    deleteCashTransaction,
    cashAccounts,
    addCashAccount,
    deleteCashAccount,
    isReadOnly,
    expenseCategories,
    salesTransactions,
    salesImportLogs,
  } = useStore();


  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  const unverifiedSalesLogs = useMemo(() => {
    return salesImportLogs.filter((log) => {
      if (log.status !== "SUCCESS") return false;
      const isVerified = cashTransactions.some((c) => c.referenceId === log.id);
      return !isVerified;
    });
  }, [salesImportLogs, cashTransactions]);

  const [trxType, setTrxType] = useState<"CASH_IN" | "CASH_OUT" | "TRANSFER">(
    "CASH_IN",
  );

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = cashTransactions;
    if (selectedAccountId !== "all") {
      filtered = filtered.filter((f) => f.accountId === selectedAccountId);
    }
    if (searchTerm) {
      filtered = filtered.filter(
        (f) =>
          f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.category.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }
    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [cashTransactions, selectedAccountId, searchTerm]);

  // Calculate balances per account
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    cashAccounts.forEach((acc) => (balances[acc.id] = 0));

    cashTransactions.forEach((trx) => {
      if (balances[trx.accountId] === undefined) {
        balances[trx.accountId] = 0;
      }
      if (trx.type === "CASH_IN") {
        balances[trx.accountId] += trx.amount;
      } else if (trx.type === "CASH_OUT") {
        balances[trx.accountId] -= trx.amount;
      }
      // Transfer is more complex if it's one record. We assume TRANSFER is just an expense on one account and income on another.
      // For simplicity, we just use IN and OUT right now.
    });
    return balances;
  }, [cashTransactions, cashAccounts]);

  const totalBalance = (Object.values(accountBalances) as number[]).reduce(
    (sum, b) => sum + b,
    0,
  );

  const handleTrxSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const accId = formData.get("accountId") as string;
    const catId = formData.get("categoryId") as string;
    const catName = expenseCategories.find((c: any) => c.id === catId)?.name || "Lainnya";

    addCashTransaction({
      accountId: accId,
      type: trxType,
      date: new Date().toISOString(),
      amount: Number(formData.get("amount")),
      description: formData.get("description") as string,
      category: catName,
      categoryId: catId || null,
      referenceId: null,
    });

    setIsModalOpen(false);
  };

  const handleAccountSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    addCashAccount({
      name: formData.get("name") as string,
      type: formData.get("type") as "BANK" | "CASH" | "SAVINGS" | "E_WALLET",
      isDefault: cashAccounts.length === 0, // First account is default
    });

    setIsAccountModalOpen(false);
  };



  const handleImport = (parsedData: any[]) => {
    if (cashAccounts.length === 0) {
      alert("Silakan buat Pos Kas terlebih dahulu sebelum mengimport transaksi.");
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;
    let errors = 0;

    parsedData.forEach((row: any) => {
      try {
        const systemId = row["ID_SISTEM (JANGAN DIUBAH)"]?.trim();
        const date = row["Tanggal"] || new Date().toISOString();
        const rawJenis = String(row["Jenis"] || "").toLowerCase();
        const type = rawJenis.includes("masuk") ? "CASH_IN" : "CASH_OUT";
        const category = row["Kategori"] || "Lainnya";
        const description = row["Deskripsi"] || "Import Excel";
        const amount = parseFloat(row["Jumlah"]) || 0;
        const accountName = row["Pos Kas"];
        const posKas = cashAccounts.find((a) => a.name.toLowerCase() === (accountName || "").toLowerCase()) || cashAccounts[0];

        if (amount > 0 && posKas) {
          const existingTrx = cashTransactions.find((t) => t.id === systemId);
          if (existingTrx) {
            updateCashTransaction({
              ...existingTrx,
              accountId: posKas.id,
              type: type,
              date: date,
              amount: amount,
              description: description,
              category: category,
            });
            updatedCount++;
          } else {
            addCashTransaction({
              accountId: posKas.id,
              type: type,
              date: date,
              amount: amount,
              description: description,
              category: category,
              categoryId: null,
              referenceId: null,
            });
            addedCount++;
          }
        } else {
          errors++;
        }
      } catch (err) {
        errors++;
      }
    });

    alert(`Import selesai.\nDitambahkan: ${addedCount} data baru\nDiperbarui: ${updatedCount} data lama\nGagal/Dilewati: ${errors} baris`);
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "BANK":
        return <Building2 className="w-5 h-5" />;
      case "SAVINGS":
        return <Landmark className="w-5 h-5" />;
      case "E_WALLET":
        return <Smartphone className="w-5 h-5" />;
      default:
        return <Wallet className="w-5 h-5" />;
    }
  };

  return (
    <>
    <div className="space-y-6">
      {/* Accounts Overview */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">
            Pos Kas (Rekening/Dompet)
          </h2>
          {!isReadOnly && (
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="flex items-center text-sm font-medium text-primary hover:text-blue-800"
            >
              <Plus className="w-4 h-4 mr-1" /> Tambah Pos Kas
            </button>
          )}
        </div>

        {cashAccounts.length === 0 ? (
          <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200 flex items-center justify-between">
            <div>
              <p className="font-medium">Anda belum memiliki Pos Kas.</p>
              <p className="text-sm mt-1">
                Buat minimal satu pos kas (misal: "Kas Utama") untuk mulai
                mencatat transaksi.
              </p>
            </div>
            {!isReadOnly && (
              <button
                onClick={() => setIsAccountModalOpen(true)}
                className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded-lg font-medium transition-colors"
              >
                Buat Pos Kas
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div
              onClick={() => setSelectedAccountId("all")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedAccountId === "all"
                  ? "bg-slate-800 text-white border-slate-800 shadow-md"
                  : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div
                  className={`p-2 rounded-lg ${selectedAccountId === "all" ? "bg-white/20" : "bg-slate-100"}`}
                >
                  <Landmark className="w-5 h-5" />
                </div>
              </div>
              <p
                className={`text-sm ${selectedAccountId === "all" ? "text-slate-300" : "text-slate-500"}`}
              >
                Semua Pos Kas
              </p>
              <p className="text-xl font-bold mt-1">
                {formatCurrency(totalBalance)}
              </p>
            </div>

            {cashAccounts.map((acc) => (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`relative group p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedAccountId === acc.id
                    ? "bg-primary text-white border-primary shadow-md"
                    : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div
                    className={`p-2 rounded-lg ${selectedAccountId === acc.id ? "bg-white/20" : "bg-blue-50 text-primary"}`}
                  >
                    {getAccountIcon(acc.type)}
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Hapus pos kas "${acc.name}"? Transaksi di dalamnya mungkin tidak memiliki referensi pos kas yang valid.`,
                          )
                        ) {
                          deleteCashAccount(acc.id);
                        }
                      }}
                      className={`p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
                        selectedAccountId === acc.id
                          ? "hover:bg-white/20"
                          : "hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p
                  className={`text-sm ${selectedAccountId === acc.id ? "text-blue-100" : "text-slate-500"}`}
                >
                  {acc.name}
                </p>
                <p className="text-xl font-bold mt-1">
                  {formatCurrency(accountBalances[acc.id] || 0)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-800">
            Riwayat Transaksi{" "}
            {selectedAccountId !== "all"
              ? `(${cashAccounts.find((a) => a.id === selectedAccountId)?.name})`
              : ""}
          </h2>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent w-full sm:w-64"
              />
            </div>

            {!isReadOnly && cashAccounts.length > 0 && (
              <div className="flex items-center gap-2">
                <CsvImportExport 
                  onImport={handleImport}
                  templateHeaders={["Tanggal", "Pos Kas", "Jenis", "Kategori", "Deskripsi", "Jumlah"]}
                  templateExampleRow={[getLocalDateString(), cashAccounts[0]?.name || "Kas Utama", "Pemasukan", "Pendapatan Lain", "Contoh transaksi", "50000"]}
                  templateFilename="Template_Import_Arus_Kas.xlsx"
                  buttonLabel="Import Excel"
                  currentData={filteredTransactions.map((trx) => ({
                    id: trx.id,
                    Tanggal: getLocalDateString(new Date(trx.date)),
                    "Pos Kas": cashAccounts.find((a) => a.id === trx.accountId)?.name || "-",
                    Jenis: trx.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran",
                    Kategori: trx.category,
                    Deskripsi: trx.description,
                    Jumlah: trx.amount,
                  }))}
                  templateDropdowns={{
                    "Pos Kas": cashAccounts.map((a) => a.name),
                    Jenis: ["Pemasukan", "Pengeluaran"],
                    Kategori: expenseCategories.map((c: any) => c.name),
                  }}
                  templateColumnTypes={{
                    Tanggal: "date",
                    Jumlah: "number",
                  }}
                  templateHints={{
                    Tanggal: "Format: YYYY-MM-DD",
                    Jumlah: "Angka saja, tanpa titik atau koma",
                  }}
                />
                {unverifiedSalesLogs.length > 0 && (
                  <button
                    onClick={() => setIsVerificationModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shrink-0 text-sm font-medium shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Verifikasi Penjualan ({unverifiedSalesLogs.length})
                  </button>
                )}
                <button
                  onClick={() => {
                    setTrxType("CASH_IN");
                    setIsModalOpen(true);
                  }}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 text-sm font-medium shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Transaksi
                </button>
              </div>
            )}

          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-600">Tanggal</th>
                <th className="p-4 font-semibold text-slate-600">Pos Kas</th>
                <th className="p-4 font-semibold text-slate-600">Jenis</th>
                <th className="p-4 font-semibold text-slate-600">Kategori</th>
                <th className="p-4 font-semibold text-slate-600">Deskripsi</th>
                <th className="p-4 font-semibold text-slate-600 text-right">
                  Jumlah
                </th>
                <th className="p-4 font-semibold text-slate-600 text-center">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((trx) => (
                <tr
                  key={trx.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="p-4 text-slate-800">
                    {new Date(trx.date).toLocaleDateString("id-ID", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-4 text-slate-800 font-medium">
                    {cashAccounts.find((a) => a.id === trx.accountId)?.name ||
                      "-"}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        trx.type === "CASH_IN"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {trx.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran"}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600">{trx.category}</td>
                  <td className="p-4 text-slate-600">{trx.description}</td>
                  <td
                    className={`p-4 text-right font-medium ${trx.type === "CASH_IN" ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {trx.type === "CASH_IN" ? "+" : "-"}
                    {formatCurrency(trx.amount)}
                  </td>
                  <td className="p-4 text-center">
                    {!isReadOnly && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Apakah Anda yakin ingin menghapus transaksi ini?",
                            )
                          ) {
                            deleteCashTransaction(trx.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Tidak ada transaksi ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TRANSACTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50  flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                Tambah Transaksi
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleTrxSubmit} className="p-6">
              <div className="space-y-4">
                <div className="flex gap-4 p-1 bg-slate-100 rounded-lg mb-6">
                  <button
                    type="button"
                    onClick={() => setTrxType("CASH_IN")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      trxType === "CASH_IN"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Uang Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrxType("CASH_OUT")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      trxType === "CASH_OUT"
                        ? "bg-white text-rose-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Pengeluaran
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Pos Kas
                  </label>
                  <select
                    name="accountId"
                    required
                    defaultValue={
                      selectedAccountId !== "all"
                        ? selectedAccountId
                        : cashAccounts[0]?.id || ""
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  >
                    <option value="" disabled>
                      Pilih Pos Kas...
                    </option>
                    {cashAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Jumlah (Rp)
                  </label>
                  <input
                    type="number"
                    name="amount"
                    required
                    min="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    name="categoryId"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  >
                    <option value="" disabled selected>Pilih Kategori...</option>
                    {expenseCategories
                      .filter((c: any) => c.isActive)
                      .map((cat: any) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.parentId ? "— " : ""}{cat.name} ({cat.type})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    name="description"
                    required
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                    placeholder="Penjelasan detail transaksi..."
                  ></textarea>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCOUNT MODAL */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50  flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                Tambah Pos Kas Baru
              </h2>
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAccountSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nama Pos Kas
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                    placeholder="Contoh: Kas Utama, Rekening BCA, Tabungan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Jenis
                  </label>
                  <select
                    name="type"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  >
                    <option value="CASH">Tunai (Kas)</option>
                    <option value="BANK">Rekening Bank</option>
                    <option value="E_WALLET">
                      Dompet Digital (Gojek/Grab/OVO)
                    </option>
                    <option value="SAVINGS">Tabungan / Investasi</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-slate-800"
                >
                  Buat Pos Kas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

      {isVerificationModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-800 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-amber-500" />
                Verifikasi Penjualan ({unverifiedSalesLogs.length})
              </h2>
              <button
                onClick={() => setIsVerificationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {unverifiedSalesLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  Tidak ada data penjualan yang perlu diverifikasi.
                </p>
              ) : (
                <div className="space-y-4">
                  {unverifiedSalesLogs.map((log) => {
                    const totalSales = salesTransactions
                      .filter((t) => t.importLogId === log.id)
                      .reduce((sum, t) => sum + t.totalPrice, 0);

                    return (
                      <div key={log.id} className="p-4 border rounded-lg shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="font-semibold text-slate-800">
                              Data Penjualan: {new Date(log.importDate).toLocaleDateString("id-ID")}
                            </p>
                            <p className="text-sm text-slate-500">
                              {log.rowCount} baris data
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">
                              {formatCurrency(totalSales)}
                            </p>
                          </div>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const accountId = formData.get("accountId") as string;
                            if (!accountId) return;

                            addCashTransaction({
                              accountId: accountId,
                              type: "CASH_IN",
                              amount: totalSales,
                              date: new Date(log.importDate).toISOString(),
                              description: `Pemasukan Penjualan (${log.rowCount} transaksi)`,
                              category: "Penjualan",
                              categoryId: null,
                              referenceId: log.id,
                            });
                          }}
                          className="flex gap-2 items-end"
                        >
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Simpan ke Pos Kas
                            </label>
                            <select
                              name="accountId"
                              required
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            >
                              <option value="">-- Pilih Pos Kas --</option>
                              {cashAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shrink-0"
                          >
                            Simpan ke Arus Kas
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 flex justify-end shrink-0 bg-slate-50 rounded-b-xl">
              <button
                onClick={() => setIsVerificationModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
