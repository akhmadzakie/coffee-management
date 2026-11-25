import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Upload, Download, FileSpreadsheet, ChevronDown, Database, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../context/ToastContext";
import { GenericImportModal } from "./GenericImportModal";
import {
  buildTemplateWithDropdown,
  TemplateColumn,
  TemplateColumnType,
} from "../../utils/excelTemplate";

const ID_HEADER = "ID_SISTEM (JANGAN DIUBAH)";

interface CsvImportExportProps {
  onImport: (data: any[], fileName?: string) => void;
  templateHeaders: string[];
  templateExampleRow?: string[];
  templateFilename?: string;
  buttonLabel?: string;
  currentData?: any[]; // For export-to-edit
  /** Pilihan dropdown per header, contoh: { Role: ["KASIR", "LEADER"] } */
  templateDropdowns?: Record<string, string[]>;
  /** Validasi tipe per header: number | integer | date | text */
  templateColumnTypes?: Record<string, TemplateColumnType>;
  /** Teks bantuan per header (muncul saat sel dipilih di Excel) */
  templateHints?: Record<string, string>;
  /** Petunjuk tambahan di sheet "Petunjuk" */
  templateInstructions?: string[];
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
  templateFilename = "template.csv",
  buttonLabel = "Import Data",
  currentData,
  templateDropdowns = {},
  templateColumnTypes = {},
  templateHints = {},
  templateInstructions = [],
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [menuCoords, setMenuCoords] = useState<DropdownMenuCoords | null>(null);

  const updateMenuPosition = useCallback(() => {
    if (!dropdownRef.current || typeof window === "undefined") return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 12;
    const gap = 8;

    const width = Math.min(288, Math.max(200, viewportW - margin * 2));
    // Default align left of button; fallback to right if overflowing right edge, then clamp strictly inside viewport
    let left = rect.left;
    if (left + width > viewportW - margin) {
      left = rect.right - width;
    }
    left = Math.max(margin, Math.min(left, viewportW - width - margin));

    const estHeight = currentData ? 168 : 116;
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
  }, [currentData]);

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
    const cols: TemplateColumn[] = templateHeaders.map((h) => ({
      header: h,
      options: templateDropdowns[h],
      type: templateColumnTypes[h],
      hint: templateHints[h],
    }));
    return withId
      ? [{ header: ID_HEADER, locked: true, width: 28, hint: "Kosongkan untuk data baru. Jangan ubah untuk data lama." }, ...cols]
      : cols;
  };

  const filenameBase = templateFilename.replace(/\.(csv|xlsx)$/i, "");

  const runGenerate = async (fn: () => Promise<void>) => {
    setIsGenerating(true);
    try {
      await fn();
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal membuat template Excel: " + (err?.message || err));
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
        instructions: [
          ...(templateExampleRow ? ["Baris ke-2 adalah CONTOH — ganti atau hapus sebelum diimpor."] : []),
          ...templateInstructions,
        ],
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
          "Kolom ID_SISTEM dipakai untuk memperbarui data lama. Kosongkan ID untuk menambah data baru.",
          ...templateInstructions,
        ],
      });
    });

  // We add ID_SISTEM to the expected headers for the modal if currentData is provided
  const expectedHeadersWithId = currentData
    ? ["ID_SISTEM (JANGAN DIUBAH)", ...templateHeaders]
    : templateHeaders;

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
                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={isGenerating}
                    className="flex items-center w-full px-4 py-3 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left disabled:opacity-50 cursor-pointer"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 mr-3 text-slate-400 shrink-0 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-3 text-slate-400 shrink-0" />
                    )}
                    Download Template Excel (Dropdown)
                  </button>

                  {currentData && (
                    <button
                      type="button"
                      onClick={handleDownloadInteractive}
                      disabled={isGenerating}
                      className="flex items-center w-full px-4 py-3 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left border-t border-slate-100 dark:border-slate-800 disabled:opacity-50 cursor-pointer"
                    >
                      <Database className="w-4 h-4 mr-3 text-brand-500 shrink-0" />
                      Download Template &amp; Data Saat Ini (Edit Massal)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsModalOpen(true);
                    }}
                    className="flex items-center w-full px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 transition-colors text-left border-t border-slate-100 dark:border-slate-800 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 mr-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Upload Excel / CSV
                  </button>
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
          className="flex items-center justify-center px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-700 shadow-xs cursor-pointer whitespace-nowrap"
          title={buttonLabel}
        >
          <FileSpreadsheet className="w-4 h-4 sm:mr-2 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="hidden sm:inline font-medium text-sm">{buttonLabel}</span>
          <ChevronDown
            className={`w-3 h-3 ml-2 hidden sm:block opacity-70 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {portalMenu}
      </div>

      <GenericImportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Import ${buttonLabel}`}
        expectedHeaders={expectedHeadersWithId}
        onImport={(data) => {
          onImport(data);
        }}
      />
    </>
  );
};
