import React, { useState, useRef, useCallback } from "react";
import { useStore } from "../store/StoreContext";
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
  const { expenseCategories, cashAccounts, addCashTransaction } = useStore();

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
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!selectedAccountId) {
      setImportErrors(["Pilih akun kas tujuan terlebih dahulu."]);
      return;
    }

    setIsLoading(true);
    setImportErrors([]);
    let count = 0;
    const errors: string[] = [];

    for (const row of parsedRows) {
      try {
        addCashTransaction({
          accountId: selectedAccountId,
          type: row.type,
          date: row.date,
          amount: row.amount,
          description: row.description,
          category: row.category,
          categoryId: null,
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Import Transaksi Keuangan</h3>
              <p className="text-xs text-slate-400">
                Upload file Excel/CSV untuk memasukkan data sekaligus
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Step: Upload */}
          {step === "upload" && (
            <>
              {/* Download Template Button */}
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Belum punya template? Download dulu agar format sesuai.</span>
                </div>
                <button
                  onClick={() => downloadFinanceImportTemplate(expenseCategories)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 ml-3"
                >
                  <Download className="w-3.5 h-3.5" />
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
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
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
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-sm text-slate-600">Membaca file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="w-10 h-10 text-slate-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Drag & drop file di sini, atau klik untuk pilih file
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Mendukung: .xlsx, .xls, .csv
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Parse Errors */}
              {parseErrors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1">
                  <p className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Error saat membaca file:
                  </p>
                  {parseErrors.map((e, i) => (
                    <p key={i} className="text-xs text-rose-600 pl-5">
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
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Masukkan ke Akun Kas
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Akun --</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type}){a.isDefault ? " ★ Default" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Summary */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div className="text-sm">
                  <span className="font-bold text-green-800">
                    {parsedRows.length} transaksi
                  </span>{" "}
                  <span className="text-green-700">siap diimport.</span>
                  {parseErrors.length > 0 && (
                    <span className="text-amber-600 ml-2">
                      ({parseErrors.length} baris dilewati karena error)
                    </span>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        {["Tanggal", "Jenis", "Kategori", "Keterangan", "Jumlah"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-bold text-slate-600"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="px-3 py-2 text-slate-600">
                            {new Date(row.date).toLocaleDateString("id-ID")}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`font-semibold ${
                                row.type === "CASH_IN"
                                  ? "text-green-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {row.type === "CASH_IN" ? "Pemasukan" : "Pengeluaran"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{row.category}</td>
                          <td className="px-3 py-2 text-slate-600 max-w-[160px] truncate">
                            {row.description}
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-800 text-right">
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
                  <div className="px-3 py-2 bg-slate-50 text-xs text-slate-500 border-t border-slate-200">
                    Menampilkan 50 dari {parsedRows.length} baris. Semua baris akan diimport.
                  </div>
                )}
              </div>

              {/* Row Errors */}
              {parseErrors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Baris yang dilewati ({parseErrors.length}):
                  </p>
                  {parseErrors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-amber-700 pl-5">
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
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-green-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800">Import Berhasil!</p>
                    <p className="text-sm text-slate-500 mt-1">
                      <span className="font-bold text-green-600">{importedCount} transaksi</span>{" "}
                      berhasil dimasukkan ke database.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center">
                    <AlertTriangle className="w-9 h-9 text-rose-600" />
                  </div>
                  <p className="text-lg font-bold text-slate-800">Import Gagal</p>
                </div>
              )}
              {importErrors.length > 0 && (
                <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-left space-y-1">
                  {importErrors.map((e, i) => (
                    <p key={i} className="text-xs text-rose-600">
                      {e}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={() => {
              if (step === "preview") {
                setStep("upload");
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            {step === "preview" ? "← Kembali" : "Tutup"}
          </button>

          {step === "preview" && (
            <button
              onClick={handleImport}
              disabled={isLoading || !selectedAccountId}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isLoading ? "Mengimport..." : `Import ${parsedRows.length} Transaksi`}
            </button>
          )}

          {step === "done" && importedCount > 0 && (
            <button
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm"
            >
              Selesai
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
