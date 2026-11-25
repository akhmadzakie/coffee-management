import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  Download,
  FileSpreadsheet,
  ChevronDown,
  Database,
  Loader2,
  Table,
  FileDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../context/ToastContext";
import { GenericImportModal, ImportActionResult } from "./GenericImportModal";
import {
  buildStyledWorkbook,
  buildTemplateWithDropdown,
  TemplateColumn,
  TemplateColumnFormat,
  TemplateColumnType,
} from "../../utils/excelTemplate";
import { exportToCSV } from "../../utils/export";
import { ParsedGenericRow } from "../../utils/genericImport";

const ID_HEADER = "ID_SISTEM (JANGAN DIUBAH)";

interface CsvImportExportProps {
  onImport: (
    data: any[],
    fileName?: string
  ) => ImportActionResult | Promise<ImportActionResult | void> | void;
  templateHeaders: string[];
  templateExampleRow?: string[];
  templateFilename?: string;
  buttonLabel?: string;
  currentData?: any[]; // Untuk Ekspor Rapi & Edit Massal
  /** Pilihan dropdown per header, contoh: { Role: ["KASIR", "LEADER"] } */
  templateDropdowns?: Record<string, string[]>;
  /** Validasi tipe per header: number | integer | date | text */
  templateColumnTypes?: Record<string, TemplateColumnType>;
  /** Format sel Excel per header: text | number | integer | currency | percent | date */
  templateFormats?: Record<string, TemplateColumnFormat>;
  /** Daftar header yang wajib diisi */
  requiredHeaders?: string[];
  /** Alias header fleksibel saat membaca file eksternal */
  headerAliases?: Record<string, string[]>;
  /** Teks bantuan per header (muncul saat sel dipilih di Excel) */
  templateHints?: Record<string, string>;
  /** Petunjuk tambahan di sheet "Petunjuk" */
  templateInstructions?: string[];
  /** Izinkan tombol impor & template (set false untuk mode Read-Only Owner agar tetap bisa Ekspor) */
  canImport?: boolean;
  /** Izinkan mode Edit Massal dengan ID_SISTEM (set false untuk data append-only seperti Sales/PO) */
  allowBulkEdit?: boolean;
  /** Nama file khusus untuk Ekspor Data Rapi */
  exportFilename?: string;
  /** Judul banner di file Ekspor Data Rapi */
  exportTitle?: string;
  /** Baris khusus jika ingin kolom ekspor lebih lengkap daripada kolom edit massal */
  exportRows?: Record<string, any>[];
  exportHeaders?: string[];
  /** Validator per baris untuk tampilan pratinjau */
  validateRow?: (
    row: ParsedGenericRow,
    index: number
  ) => { status: "new" | "update" | "error"; reason?: string };
}

interface DropdownMenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  placement: "bottom" | "top";
}

export const CsvImportExport: React.FC<CsvImportExportProps> = ({
  onImport,
  templateHeaders,
  templateExampleRow,
  templateFilename = "template.xlsx",
  buttonLabel,
  currentData,
  templateDropdowns = {},
  templateColumnTypes = {},
  templateFormats = {},
  requiredHeaders = [],
  headerAliases,
  templateHints = {},
  templateInstructions = [],
  canImport = true,
  allowBulkEdit = true,
  exportFilename,
  exportTitle,
  exportRows,
  exportHeaders,
  validateRow,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [menuCoords, setMenuCoords] = useState<DropdownMenuCoords | null>(null);

  const effectiveExportRows = exportRows ?? currentData ?? [];
  const hasExportableRows = effectiveExportRows.length > 0;
  const effectiveLabel = buttonLabel ?? (canImport ? "Impor / Ekspor" : "Ekspor Data");

  const updateMenuPosition = useCallback(() => {
    if (!dropdownRef.current || typeof window === "undefined") return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 12;
    const gap = 8;

    const width = Math.min(312, Math.max(220, viewportW - margin * 2));
    let left = rect.left;
    if (left + width > viewportW - margin) {
      left = rect.right - width;
    }
    left = Math.max(margin, Math.min(left, viewportW - width - margin));

    const estHeight = (canImport ? 210 : 96) + (hasExportableRows ? 105 : 0);
    const spaceBelow = Math.max(0, viewportH - rect.bottom - gap - margin);
    const spaceAbove = Math.max(0, rect.top - gap - margin);
    const openUpward = spaceBelow < estHeight && spaceAbove > spaceBelow;

    if (openUpward) {
      setMenuCoords({
        bottom: Math.max(margin, viewportH - rect.top + gap),
        left,
        width,
        placement: "top",
      });
    } else {
      setMenuCoords({
        top: Math.max(margin, rect.bottom + gap),
        left,
        width,
        placement: "bottom",
      });
    }
  }, [canImport, hasExportableRows]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => updateMenuPosition();
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updateMenuPosition]);

  const buildColumns = (withId: boolean): TemplateColumn[] => {
    const reqSet = new Set(requiredHeaders);
    const cols: TemplateColumn[] = templateHeaders.map((h) => ({
      header: h,
      options: templateDropdowns[h],
      type: templateColumnTypes[h],
      format: templateFormats[h],
      required: reqSet.has(h),
      hint: templateHints[h],
    }));
    return withId
      ? [
          {
            header: ID_HEADER,
            locked: true,
            format: "text",
            width: 28,
            hint: "Kosongkan untuk data baru. Jangan ubah untuk memperbarui data lama.",
          },
          ...cols,
        ]
      : cols;
  };

  const filenameBase = templateFilename.replace(/\.(csv|xlsx)$/i, "");
  const cleanExportBase = (
    exportFilename || filenameBase.replace(/^template_/i, "Data_")
  ).replace(/\.(csv|xlsx)$/i, "");

  const runGenerate = async (fn: () => Promise<void> | void) => {
    setIsGenerating(true);
    try {
      await fn();
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal memproses berkas: " + (err?.message || err));
    } finally {
      setIsGenerating(false);
      setIsOpen(false);
    }
  };

  const handleDownloadTemplate = () =>
    runGenerate(() =>
      buildTemplateWithDropdown({
        filename: filenameBase,
        columns: buildColumns(false),
        rows: templateExampleRow ? [templateExampleRow] : [],
        isExampleFirstRow: Boolean(templateExampleRow && templateExampleRow.length > 0),
        instructions: templateInstructions,
      })
    );

  const handleDownloadInteractive = () =>
    runGenerate(() => {
      const cols = buildColumns(true);
      const rows = (currentData || []).map((row) =>
        cols.map((c) => (c.header === ID_HEADER ? row.id || "" : row[c.header] ?? ""))
      );
      return buildTemplateWithDropdown({
        filename: `${filenameBase}_Edit_Massal`,
        columns: cols,
        rows,
        instructions: [
          "Kolom ID_SISTEM dipakai untuk memperbarui data lama. Kosongkan ID jika ingin menambah baris data baru.",
          ...templateInstructions,
        ],
      });
    });

  const handleExportCleanXlsx = () =>
    runGenerate(async () => {
      if (!hasExportableRows) {
        toast.warning("Belum ada data untuk diekspor.");
        return;
      }
      const headers =
        exportHeaders && exportHeaders.length > 0 ? exportHeaders : templateHeaders;
      const columnFormats = headers.map(
        (h) => templateFormats[h] ?? templateColumnTypes[h]
      );
      const rows = effectiveExportRows.map((row) =>
        headers.map((h) => row[h] ?? "")
      );
      await buildStyledWorkbook({
        filename: cleanExportBase,
        sheets: [
          {
            name: "Data",
            title: exportTitle || cleanExportBase.replace(/_/g, " "),
            headers,
            rows,
            columnFormats,
          },
        ],
      });
      toast.success(`Berhasil mengekspor ${effectiveExportRows.length} baris ke Excel.`);
    });

  const handleExportCleanCsv = () =>
    runGenerate(() => {
      if (!hasExportableRows) {
        toast.warning("Belum ada data untuk diekspor.");
        return;
      }
      const headers =
        exportHeaders && exportHeaders.length > 0 ? exportHeaders : templateHeaders;
      const mappedRows = effectiveExportRows.map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((h) => {
          obj[h] = row[h] ?? "";
        });
        return obj;
      });
      exportToCSV(cleanExportBase, mappedRows);
      toast.success(`Berhasil mengekspor ${effectiveExportRows.length} baris ke CSV.`);
    });

  const expectedHeadersWithId =
    currentData && allowBulkEdit ? [ID_HEADER, ...templateHeaders] : templateHeaders;

  const portalMenu =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {isOpen && menuCoords && (
              <motion.div
                ref={menuRef}
                initial={{
                  opacity: 0,
                  y: menuCoords.placement === "top" ? -6 : 6,
                  scale: 0.97,
                }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: menuCoords.placement === "top" ? -4 : 4,
                  scale: 0.97,
                }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  top: menuCoords.top,
                  bottom: menuCoords.bottom,
                  left: menuCoords.left,
                  width: `${menuCoords.width}px`,
                }}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[9999] overflow-hidden"
              >
                <div className="py-1.5">
                  {hasExportableRows && (
                    <>
                      <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Ekspor Data ({effectiveExportRows.length} baris)
                      </div>
                      <button
                        type="button"
                        onClick={handleExportCleanXlsx}
                        disabled={isGenerating}
                        className="flex items-center w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left disabled:opacity-50 cursor-pointer"
                      >
                        <FileDown className="w-4 h-4 mr-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Ekspor Data Rapi (.xlsx)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportCleanCsv}
                        disabled={isGenerating}
                        className="flex items-center w-full px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left disabled:opacity-50 cursor-pointer"
                      >
                        <Table className="w-4 h-4 mr-2.5 text-slate-400 shrink-0" />
                        <span>Ekspor CSV (.csv)</span>
                      </button>
                    </>
                  )}

                  {canImport && (
                    <>
                      <div
                        className={`px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${
                          hasExportableRows
                            ? "border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
                            : ""
                        }`}
                      >
                        Template &amp; Impor Data
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        disabled={isGenerating}
                        className="flex items-center w-full px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left disabled:opacity-50 cursor-pointer"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 mr-2.5 text-brand-500 shrink-0 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-2.5 text-brand-500 dark:text-brand-300 shrink-0" />
                        )}
                        <span>Download Template Kosong (.xlsx)</span>
                      </button>

                      {currentData && allowBulkEdit && (
                        <button
                          type="button"
                          onClick={handleDownloadInteractive}
                          disabled={isGenerating}
                          className="flex items-center w-full px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left disabled:opacity-50 cursor-pointer"
                        >
                          <Database className="w-4 h-4 mr-2.5 text-brand-600 dark:text-brand-300 shrink-0" />
                          <span>Template + Data (Edit Massal)</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          setIsModalOpen(true);
                        }}
                        className="flex items-center w-full px-3.5 py-2.5 text-xs font-bold text-brand-700 dark:text-brand-300 bg-brand-50/50 dark:bg-brand-500/10 hover:bg-brand-100/70 dark:hover:bg-brand-500/20 transition-colors text-left border-t border-slate-100 dark:border-slate-800 mt-1 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 mr-2.5 text-brand-600 dark:text-brand-300 shrink-0" />
                        <span>Upload File Excel / CSV</span>
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          className="flex items-center justify-center px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer whitespace-nowrap"
          title={effectiveLabel}
        >
          <FileSpreadsheet className="w-4 h-4 sm:mr-2 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="hidden sm:inline font-semibold text-xs">{effectiveLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 ml-1.5 hidden sm:block opacity-70 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {portalMenu}
      </div>

      {canImport && (
        <GenericImportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Impor ${effectiveLabel}`}
          expectedHeaders={expectedHeadersWithId}
          requiredHeaders={requiredHeaders}
          headerAliases={headerAliases}
          exampleRowValues={templateExampleRow}
          instructions={templateInstructions}
          onDownloadTemplate={handleDownloadTemplate}
          isDownloadingTemplate={isGenerating}
          validateRow={validateRow}
          onImport={(data, fileName) => onImport(data, fileName)}
        />
      )}
    </>
  );
};
