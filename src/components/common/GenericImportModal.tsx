import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { parseGenericImportFile, ParsedGenericRow } from "../../utils/genericImport";

interface GenericImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  expectedHeaders: string[];
  onImport: (data: any[]) => void;
}

type Step = "upload" | "preview" | "done";

export const GenericImportModal: React.FC<GenericImportModalProps> = ({
  isOpen,
  onClose,
  title,
  expectedHeaders,
  onImport,
}) => {
  const [step, setStep] = useState<Step>("upload");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedGenericRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setStep("upload");
      setParsedRows([]);
      setParseErrors([]);
      setImportedCount(0);
    }
  }, [isOpen]);

  const handleFile = useCallback(
    async (file: File) => {
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
        const { rows, errors } = await parseGenericImportFile(file, expectedHeaders);
        setParsedRows(rows);
        setParseErrors(errors);
        if (rows.length > 0) setStep("preview");
      } catch (err: any) {
        setParseErrors([err.message]);
      } finally {
        setIsLoading(false);
      }
    },
    [expectedHeaders]
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
    if (file) handleFile(file);
  };

  const handleProcessImport = async () => {
    setIsLoading(true);
    try {
      // Small delay to let the UI show "Mengimport..."
      await new Promise((resolve) => setTimeout(resolve, 500));
      onImport(parsedRows);
      setImportedCount(parsedRows.length);
      setStep("done");
    } catch (err: any) {
      setParseErrors([err.message || "Gagal menyimpan data."]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-center items-start sm:items-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="my-auto bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] sm:max-h-[88vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            <p className="text-sm text-slate-500">
              {step === "upload" && "Upload file spreadsheet Anda"}
              {step === "preview" && "Periksa kembali data sebelum disimpan"}
              {step === "done" && "Proses import selesai"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6 bg-white">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200
                  ${
                    isDragOver
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"
                  }
                `}
              >
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileInput}
                />
                <div className="flex justify-center mb-4">
                  <div
                    className={`p-4 rounded-full ${
                      isDragOver ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-1">
                  Pilih file atau drag & drop ke sini
                </h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Mendukung format .xlsx, .xls, dan .csv
                </p>
              </div>

              {parseErrors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-700 text-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Error membaca file:</p>
                    <ul className="list-disc ml-4 mt-1 space-y-1">
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
              {/* Summary */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="text-sm">
                  <span className="font-bold text-emerald-800 text-base">
                    {parsedRows.length} baris data
                  </span>{" "}
                  <span className="text-emerald-700">terdeteksi dan siap di-import.</span>
                  {parseErrors.length > 0 && (
                    <span className="text-amber-600 ml-2">
                      ({parseErrors.length} peringatan)
                    </span>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                      <tr>
                        {expectedHeaders.map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left font-bold text-slate-700 border-b border-slate-200 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          {expectedHeaders.map((h) => (
                            <td key={h} className="px-4 py-2.5 text-slate-600 truncate max-w-[200px]">
                              {row[h] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 50 && (
                  <div className="px-4 py-3 bg-slate-50 text-sm font-medium text-slate-500 border-t border-slate-200 flex justify-between items-center">
                    <span>Menampilkan 50 baris pertama.</span>
                    <span className="text-slate-400">Total: {parsedRows.length} baris</span>
                  </div>
                )}
              </div>

              {/* Warnings */}
              {parseErrors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Peringatan:
                  </p>
                  <ul className="list-disc ml-5 text-sm text-amber-700 space-y-1">
                    {parseErrors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {parseErrors.length > 5 && (
                      <li className="text-amber-500">
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
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center animate-in zoom-in duration-300">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">Import Berhasil!</p>
                  <p className="text-slate-500 mt-2">
                    <span className="font-bold text-emerald-600 text-lg">{importedCount} baris data</span>{" "}
                    berhasil ditambahkan ke sistem.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={() => {
              if (step === "preview") {
                setStep("upload");
              } else {
                onClose();
              }
            }}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-xl transition-colors"
          >
            {step === "preview" ? "Kembali" : "Tutup"}
          </button>

          {step === "preview" && (
            <button
              onClick={handleProcessImport}
              disabled={isLoading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-sm transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isLoading ? "Memproses..." : `Import ${parsedRows.length} Data`}
            </button>
          )}

          {step === "done" && importedCount > 0 && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-sm transition-colors"
            >
              Selesai
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
