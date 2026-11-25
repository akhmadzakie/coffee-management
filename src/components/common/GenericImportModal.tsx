import React, { useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  Info,
  Sparkles,
} from "lucide-react";
import { parseGenericImportFile, ParsedGenericRow } from "../../utils/genericImport";

export interface ImportActionResult {
  added?: number;
  updated?: number;
  skipped?: number;
  message?: string;
}

export interface GenericImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  expectedHeaders: string[];
  onImport: (
    data: any[],
    fileName?: string
  ) => ImportActionResult | Promise<ImportActionResult | void> | void;
  requiredHeaders?: string[];
  headerAliases?: Record<string, string[]>;
  exampleRowValues?: string[];
  onDownloadTemplate?: () => void;
  isDownloadingTemplate?: boolean;
  instructions?: string[];
  validateRow?: (
    row: ParsedGenericRow,
    index: number
  ) => { status: "new" | "update" | "error"; reason?: string };
}

type Step = "upload" | "preview" | "done";

export const GenericImportModal: React.FC<GenericImportModalProps> = ({
  isOpen,
  onClose,
  title,
  expectedHeaders,
  onImport,
  requiredHeaders = [],
  headerAliases,
  exampleRowValues,
  onDownloadTemplate,
  isDownloadingTemplate = false,
  instructions = [],
  validateRow,
}) => {
  const [step, setStep] = useState<Step>("upload");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedGenericRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [exampleRowDetected, setExampleRowDetected] = useState(false);
  const [skipExampleRow, setSkipExampleRow] = useState(true);
  const [importSummary, setImportSummary] = useState<ImportActionResult>({
    added: 0,
    updated: 0,
    skipped: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setStep("upload");
      setParsedRows([]);
      setParseErrors([]);
      setUploadedFileName("");
      setExampleRowDetected(false);
      setSkipExampleRow(true);
      setImportSummary({ added: 0, updated: 0, skipped: 0 });
    }
  }, [isOpen]);

  const handleFile = useCallback(
    async (file: File) => {
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
      ];
      const lowerName = file.name.toLowerCase();
      const isValid =
        validTypes.includes(file.type) ||
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xls") ||
        lowerName.endsWith(".csv");

      if (!isValid) {
        setParseErrors([
          "Format file tidak didukung. Gunakan file .xlsx, .xls, atau .csv.",
        ]);
        return;
      }

      setIsLoading(true);
      setParseErrors([]);
      setUploadedFileName(file.name);
      try {
        const result = await parseGenericImportFile(file, expectedHeaders, {
          requiredHeaders,
          headerAliases,
          exampleRowValues,
        });
        setParsedRows(result.rows);
        setParseErrors(result.errors);
        setExampleRowDetected(Boolean(result.exampleRowDetected));
        setSkipExampleRow(Boolean(result.exampleRowDetected));
        if (result.rows.length > 0) {
          setStep("preview");
        } else if (result.errors.length === 0) {
          setParseErrors(["Tidak ditemukan baris data yang dapat dibaca."]);
        }
      } catch (err: any) {
        setParseErrors([err?.message || "Gagal membaca file spreadsheet."]);
      } finally {
        setIsLoading(false);
      }
    },
    [expectedHeaders, requiredHeaders, headerAliases, exampleRowValues]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFile(file);
  };

  const activeRows = useMemo(() => {
    if (exampleRowDetected && skipExampleRow && parsedRows.length > 0) {
      return parsedRows.slice(1);
    }
    return parsedRows;
  }, [parsedRows, exampleRowDetected, skipExampleRow]);

  const rowEvaluations = useMemo(() => {
    return activeRows.map((row, idx) => {
      if (validateRow) return validateRow(row, idx);
      const missingReq = requiredHeaders.filter((h) => {
        const v = row[h];
        return v === undefined || v === null || String(v).trim() === "";
      });
      if (missingReq.length > 0) {
        return {
          status: "error" as const,
          reason: `Kolom wajib kosong: ${missingReq.join(", ")}`,
        };
      }
      const sysId = String(row["ID_SISTEM (JANGAN DIUBAH)"] || "").trim();
      return {
        status: sysId ? ("update" as const) : ("new" as const),
      };
    });
  }, [activeRows, validateRow, requiredHeaders]);

  const counts = useMemo(() => {
    let added = 0;
    let updated = 0;
    let error = 0;
    rowEvaluations.forEach((ev) => {
      if (ev.status === "new") added++;
      else if (ev.status === "update") updated++;
      else error++;
    });
    return { added, updated, error };
  }, [rowEvaluations]);

  const validRowsToImport = useMemo(
    () => activeRows.filter((_, idx) => rowEvaluations[idx]?.status !== "error"),
    [activeRows, rowEvaluations]
  );

  const visibleHeaders = useMemo(() => {
    if (expectedHeaders.length > 0) return expectedHeaders;
    const first = parsedRows[0];
    return first ? Object.keys(first) : [];
  }, [expectedHeaders, parsedRows]);

  const handleProcessImport = async () => {
    if (validRowsToImport.length === 0) return;
    setIsLoading(true);
    try {
      const res = await onImport(validRowsToImport, uploadedFileName);
      if (res && typeof res === "object") {
        setImportSummary({
          added: res.added ?? 0,
          updated: res.updated ?? 0,
          skipped: (res.skipped ?? 0) + counts.error,
          message: res.message,
        });
      } else {
        setImportSummary({
          added: validRowsToImport.length,
          updated: 0,
          skipped: counts.error,
        });
      }
      setStep("done");
    } catch (err: any) {
      setParseErrors([err?.message || "Gagal menyimpan data."]);
    } finally {
      setIsLoading(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="generic-import-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-[100] flex justify-center items-start sm:items-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            className="my-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[86vh] sm:max-h-[88vh] flex flex-col overflow-hidden border border-slate-200/90 dark:border-slate-800"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-brand-gradient text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-white truncate">
                    {title}
                  </h2>
                  <p className="text-xs text-brand-200 truncate">
                    {step === "upload" && "Unduh template agar format rapi, lalu unggah file .xlsx / .csv"}
                    {step === "preview" &&
                      `Pratinjau ${uploadedFileName || "file"} sebelum disimpan ke sistem`}
                    {step === "done" && "Proses impor data selesai"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-brand-200 hover:text-white cursor-pointer shrink-0"
                aria-label="Tutup modal impor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 sm:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-5 bg-white dark:bg-slate-900">
              {/* Step: Upload */}
              {step === "upload" && (
                <div className="space-y-4">
                  {onDownloadTemplate && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-50/70 dark:bg-brand-500/15 border border-brand-200/80 dark:border-brand-500/30 rounded-2xl p-4">
                      <div className="flex items-start gap-2.5 text-xs sm:text-sm text-brand-950 dark:text-slate-100">
                        <Info className="w-4 h-4 text-brand-600 dark:text-brand-300 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Belum punya format Excel-nya?</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            Template sudah dilengkapi dropdown pilihan, format angka/teks otomatis, dan petunjuk pengisian.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onDownloadTemplate}
                        disabled={isDownloadingTemplate}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-sm shadow-brand-600/20 transition-colors shrink-0 cursor-pointer"
                      >
                        {isDownloadingTemplate ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Download Template Excel
                      </button>
                    </div>
                  )}

                  {requiredHeaders.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                        Kolom Wajib Terisi:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {requiredHeaders.map((h) => (
                          <span
                            key={h}
                            className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-500/30"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
                      isDragOver
                        ? "border-brand-500 bg-brand-50/70 dark:bg-brand-500/15"
                        : "border-slate-300 dark:border-slate-700 hover:border-brand-400 hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileInput}
                    />
                    {isLoading ? (
                      <div className="flex flex-col items-center gap-3 py-2">
                        <Loader2 className="w-10 h-10 text-brand-600 dark:text-brand-300 animate-spin" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Membaca &amp; memvalidasi file...
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-center mb-4">
                          <div
                            className={`p-4 rounded-2xl ${
                              isDragOver
                                ? "bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300"
                            }`}
                          >
                            <FileSpreadsheet className="w-8 h-8" />
                          </div>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
                          Pilih file atau seret &amp; lepas ke sini
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                          Mendukung format <strong>.xlsx</strong>, <strong>.xls</strong>, dan <strong>.csv</strong>
                        </p>
                      </>
                    )}
                  </div>

                  {instructions.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-300" />
                        Catatan Penting:
                      </p>
                      <ul className="list-disc ml-4 space-y-0.5">
                        {instructions.map((ins, i) => (
                          <li key={i}>{ins}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parseErrors.length > 0 && (
                    <div className="bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 rounded-2xl p-4 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-sm">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Error membaca file:</p>
                        <ul className="list-disc ml-4 mt-1 space-y-1 text-xs">
                          {parseErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step: Preview */}
              {step === "preview" && (
                <>
                  {exampleRowDetected && (
                    <label className="flex items-start sm:items-center gap-3 p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipExampleRow}
                        onChange={(e) => setSkipExampleRow(e.target.checked)}
                        className="mt-0.5 sm:mt-0 w-4 h-4 rounded accent-brand-600 shrink-0"
                      />
                      <span>
                        <strong>Baris contoh bawaan template terdeteksi</strong> di baris pertama data. Lewati baris contoh ini agar tidak ikut tersimpan.
                      </span>
                    </label>
                  )}

                  {/* Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-500/30 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-300 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Data Baru
                        </p>
                        <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                          {counts.added} baris
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-brand-50/70 via-white to-white dark:from-brand-500/15 dark:via-slate-900 dark:to-slate-900 border border-brand-200/80 dark:border-brand-500/30 flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-brand-600 dark:text-brand-300 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Perbarui (Edit Massal)
                        </p>
                        <p className="text-base font-extrabold text-brand-700 dark:text-brand-300 tabular-nums">
                          {counts.updated} baris
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-50/70 via-white to-white dark:from-rose-500/15 dark:via-slate-900 dark:to-slate-900 border border-rose-200/80 dark:border-rose-500/30 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-300 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Dilewati (Tidak Lengkap)
                        </p>
                        <p className="text-base font-extrabold text-rose-700 dark:text-rose-300 tabular-nums">
                          {counts.error} baris
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-[360px]">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="bg-slate-50/95 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="px-3 py-2.5 text-left font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                              Status
                            </th>
                            {visibleHeaders.map((h) => (
                              <th
                                key={h}
                                className="px-3.5 py-2.5 text-left font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {activeRows.slice(0, 50).map((row, i) => {
                            const ev = rowEvaluations[i];
                            return (
                              <tr
                                key={i}
                                className={
                                  ev?.status === "error"
                                    ? "bg-rose-50/40 dark:bg-rose-500/10"
                                    : i % 2 === 0
                                      ? "bg-white dark:bg-slate-900"
                                      : "bg-slate-50/60 dark:bg-slate-800/40"
                                }
                              >
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {ev?.status === "error" ? (
                                    <span
                                      title={ev.reason}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                                    >
                                      Dilewati
                                    </span>
                                  ) : ev?.status === "update" ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300">
                                      Update
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                      Baru
                                    </span>
                                  )}
                                </td>
                                {visibleHeaders.map((h) => (
                                  <td
                                    key={h}
                                    className="px-3.5 py-2 text-slate-600 dark:text-slate-300 truncate max-w-[200px]"
                                  >
                                    {row[h] !== undefined && row[h] !== ""
                                      ? String(row[h])
                                      : "-"}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {activeRows.length > 50 && (
                      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <span>Menampilkan 50 baris pertama dari {activeRows.length} baris.</span>
                        <span>Semua baris valid akan diproses.</span>
                      </div>
                    )}
                  </div>

                  {/* Warnings */}
                  {parseErrors.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 space-y-1.5">
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Peringatan Header / File:
                      </p>
                      <ul className="list-disc ml-5 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                        {parseErrors.slice(0, 5).map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                        {parseErrors.length > 5 && (
                          <li className="text-amber-600 dark:text-amber-300">
                            ...dan {parseErrors.length - 5} lainnya
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* Step: Done */}
              {step === "done" && (
                <div className="text-center py-8 sm:py-10">
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", damping: 22, stiffness: 320 }}
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        (importSummary.added || 0) + (importSummary.updated || 0) > 0
                          ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                          : "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300"
                      }`}
                    >
                      {(importSummary.added || 0) + (importSummary.updated || 0) > 0 ? (
                        <CheckCircle2 className="w-9 h-9" />
                      ) : (
                        <AlertTriangle className="w-9 h-9" />
                      )}
                    </motion.div>
                    <div>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {(importSummary.added || 0) + (importSummary.updated || 0) > 0
                          ? "Proses Impor Selesai"
                          : "Tidak Ada Data Baru Disimpan"}
                      </p>
                      {importSummary.message ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 max-w-md mx-auto">
                          {importSummary.message}
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs font-bold">
                          <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 tabular-nums">
                            +{importSummary.added || 0} Ditambahkan
                          </span>
                          <span className="px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 tabular-nums">
                            {importSummary.updated || 0} Diperbarui
                          </span>
                          {(importSummary.skipped || 0) > 0 && (
                            <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 tabular-nums">
                              {importSummary.skipped} Dilewati
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50/90 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (step === "preview") {
                    setStep("upload");
                  } else {
                    onClose();
                  }
                }}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                {step === "preview" ? "Ganti File" : "Tutup"}
              </button>

              {step === "preview" && (
                <button
                  type="button"
                  onClick={handleProcessImport}
                  disabled={isLoading || validRowsToImport.length === 0}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-sm shadow-brand-600/20 transition-colors cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {isLoading
                    ? "Memproses..."
                    : `Impor ${validRowsToImport.length} Baris Valid`}
                </button>
              )}

              {step === "done" && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm shadow-brand-600/20 transition-colors cursor-pointer"
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
