import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../store/StoreContext";
import { toast } from "../context/ToastContext";
import { CustomSelect } from "./common/CustomSelect";
import {
  getLocalPeriodFromTimestamp,
  resolveCategoryMatchForImport,
} from "../utils/syncSanitizers";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";
import {
  downloadFinanceImportTemplate,
  parseFinanceImportFile,
  ParsedFinanceRow,
} from "../utils/exportXlsx";

interface ImportFinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "upload" | "preview" | "done";

export const ImportFinanceModal: React.FC<ImportFinanceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    expenseCategories,
    cashAccounts,
    addCashTransaction,
    isReadOnly,
    closedPeriods,
  } = useStore();

  const [step, setStep] = useState<Step>("upload");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedFinanceRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultAccount = cashAccounts.find((a) => a.isDefault) || cashAccounts[0];

  React.useEffect(() => {
    if (isOpen) {
      setStep("upload");
      setParsedRows([]);
      setParseErrors([]);
      setImportErrors([]);
      setImportedCount(0);
      setSelectedAccountId(defaultAccount?.id || "");
    }
  }, [isOpen, defaultAccount?.id]);

  const handleFile = useCallback(async (file: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const isValid =
      validTypes.includes(file.type) ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls") ||
      file.name.endsWith(".csv");

    if (!isValid) {
      setParseErrors(["Format file tidak didukung. Gunakan file .xlsx, .xls, atau .csv."]);
      return;
    }

    setIsLoading(true);
    setParseErrors([]);
    try {
      const { rows, errors } = await parseFinanceImportFile(file);
      setParsedRows(rows);
      setParseErrors(errors);
      if (rows.length > 0) setStep("preview");
    } catch (err: any) {
      setParseErrors([err.message]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (isReadOnly) {
      setImportErrors(["Mode Pemantauan Owner (Read-Only) tidak diizinkan mengimpor transaksi."]);
      return;
    }
    if (!selectedAccountId) {
      setImportErrors(["Pilih akun kas tujuan terlebih dahulu."]);
      return;
    }

    setIsLoading(true);
    setImportErrors([]);
    let count = 0;
    const errors: string[] = [];
    const closedSet = new Set(closedPeriods.map((p) => p.period));

    for (const row of parsedRows) {
      try {
        const rowPeriod = getLocalPeriodFromTimestamp(row.date);
        if (rowPeriod && closedSet.has(rowPeriod)) {
          errors.push(`Dilewati (${row.description}): Periode ${rowPeriod} sudah ditutup buku.`);
          continue;
        }
        const matchedCat = resolveCategoryMatchForImport(row.category, expenseCategories);
        const safeAmount = Math.round(Number(row.amount) || 0);
        if (safeAmount <= 0) {
          errors.push(`Dilewati (${row.description}): Nominal harus > Rp 0.`);
          continue;
        }

        addCashTransaction({
          accountId: selectedAccountId,
          type: row.type,
          date: row.date,
          amount: safeAmount,
          description: row.description,
          category: matchedCat.category,
          categoryId: matchedCat.categoryId,
        });
        count++;
      } catch (err: any) {
        errors.push(`Gagal import baris ${row.description}: ${err.message}`);
      }
    }

    setImportedCount(count);
    setImportErrors(errors);
    setIsLoading(false);
    setStep("done");

    if (count > 0) {
      toast.success(`Berhasil mengimpor ${count} transaksi ke Buku Kas.`);
    } else {
      toast.warning("Tidak ada transaksi yang berhasil diimpor.");
    }
  };

  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await downloadFinanceImportTemplate(expenseCategories);
    } catch (err: any) {
      toast.error("Gagal mengunduh template: " + (err?.message || err));
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  if (typeof document === "undefined" || isReadOnly) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="import-finance-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-[100] flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            className="my-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[88vh]"
          >
        {/* Header */}
        <div className="px-6 py-4 bg-brand-gradient text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Import Transaksi Keuangan</h3>
              <p className="text-xs text-brand-200">
                Upload file Excel/CSV untuk memasukkan data sekaligus
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-200 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Tutup modal impor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Step: Upload */}
          {step === "upload" && (
            <>
              {/* Download Template Button */}
              <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-500/30 rounded-xl p-3.5">
                <div className="flex items-center gap-2 text-sm text-brand-800 dark:text-brand-200">
                  <Info className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0" />
                  <span>Belum punya template? Download dulu agar format sesuai.</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors shrink-0 ml-3 cursor-pointer"
                >
                  {isDownloadingTemplate ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Template Excel
                </button>
              </div>

              {/* Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/15"
                    : "border-slate-300 dark:border-slate-700 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-brand-600 dark:text-brand-300 animate-spin" />
                    <p className="text-sm text-slate-600 dark:text-slate-300">Membaca file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="w-10 h-10 text-slate-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Drag &amp; drop file di sini, atau klik untuk pilih file
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Mendukung: .xlsx, .xls, .csv
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Parse Errors */}
              {parseErrors.length > 0 && (
                <div className="bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl p-3.5 space-y-1">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Error saat membaca file:
                  </p>
                  {parseErrors.map((e, i) => (
                    <p key={i} className="text-xs text-rose-600 dark:text-rose-300 pl-5">
                      {e}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <>
              {/* Account Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Masukkan ke Akun Kas
                </label>
                <CustomSelect
                  value={selectedAccountId}
                  onChange={setSelectedAccountId}
                  placeholder="-- Pilih Akun --"
                  options={[
                    { value: "", label: "-- Pilih Akun --" },
                    ...cashAccounts.map((a) => ({
                      value: a.id,
                      label: `${a.name} (${a.type})${a.isDefault ? " ★ Default" : ""}`,
                    })),
                  ]}
                  buttonClassName="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900"
                />
              </div>

              {/* Summary */}
              <div className="bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3.5 flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-300 shrink-0" />
                <div className="text-sm">
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">
                    {parsedRows.length} transaksi
                  </span>{" "}
                  <span className="text-emerald-700 dark:text-emerald-300">siap diimport.</span>
                  {parseErrors.length > 0 && (
                    <span className="text-amber-600 dark:text-amber-300 ml-2">
                      ({parseErrors.length} baris dilewati karena error)
                    </span>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                      <tr>
                        {["Tanggal", "Jenis", "Kategori", "Keterangan", "Jumlah"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800/50"}>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {new Date(row.date).toLocaleDateString("id-ID")}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`font-semibold ${
                                row.type === "CASH_IN"
                                  ? "text-emerald-600 dark:text-emerald-300"
                                  : "text-rose-600 dark:text-rose-300"
                              }`}
                            >
                              {row.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.category}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[160px] truncate">
                            {row.description}
                          </td>
                          <td className="px-3 py-2 font-semibold font-mono tabular-nums text-slate-800 dark:text-slate-100 text-right">
                            {new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              minimumFractionDigits: 0,
                            }).format(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 50 && (
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
                    Menampilkan 50 dari {parsedRows.length} baris. Semua baris akan diimport.
                  </div>
                )}
              </div>

              {/* Row Errors */}
              {parseErrors.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Baris yang dilewati ({parseErrors.length}):
                  </p>
                  {parseErrors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-300 pl-5">
                      {e}
                    </p>
                  ))}
                  {parseErrors.length > 5 && (
                    <p className="text-xs text-amber-500 pl-5">
                      ...dan {parseErrors.length - 5} lainnya
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="text-center py-6">
              {importedCount > 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Import Berhasil!</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      <span className="font-bold text-emerald-600 dark:text-emerald-300">{importedCount} transaksi</span>{" "}
                      berhasil dimasukkan ke database.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-9 h-9 text-rose-600 dark:text-rose-300" />
                  </div>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Import Gagal / Dilewati</p>
                </div>
              )}
              {importErrors.length > 0 && (
                <div className="mt-4 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-xl p-3 text-left space-y-1">
                  {importErrors.map((e, i) => (
                    <p key={i} className="text-xs text-rose-600 dark:text-rose-300">
                      {e}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              if (step === "preview") {
                setStep("upload");
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            {step === "preview" ? "← Kembali" : "Tutup"}
          </button>

          {step === "preview" && (
            <button
              type="button"
              onClick={handleImport}
              disabled={isLoading || !selectedAccountId}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isLoading ? "Mengimport..." : `Import ${parsedRows.length} Transaksi`}
            </button>
          )}

          {step === "done" && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
            >
              Selesai
            </button>
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
