import React, { useRef, useState, useEffect } from "react";
import { Upload, Download, FileSpreadsheet, ChevronDown, Database, Loader2 } from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [dropdownAlign, setDropdownAlign] = useState<"left" | "right">("right");

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      if (window.innerWidth - rect.left >= 280) {
        setDropdownAlign("left");
      } else {
        setDropdownAlign("right");
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      alert("Gagal membuat template Excel: " + (err?.message || err));
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

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-300 shadow-sm"
          title={buttonLabel}
        >
          <FileSpreadsheet className="w-4 h-4 sm:mr-2 text-emerald-600" />
          <span className="hidden sm:inline font-medium text-sm">{buttonLabel}</span>
          <ChevronDown className="w-3 h-3 ml-2 hidden sm:block opacity-70" />
        </button>

        {isOpen && (
          <div
            className={`absolute ${
              dropdownAlign === "left" ? "left-0" : "right-0"
            } mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150`}
          >
            <div className="py-1">
              <button
                onClick={handleDownloadTemplate}
                disabled={isGenerating}
                className="flex items-center w-full px-4 py-3 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left disabled:opacity-50 cursor-pointer"
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
                  onClick={handleDownloadInteractive}
                  disabled={isGenerating}
                  className="flex items-center w-full px-4 py-3 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  <Database className="w-4 h-4 mr-3 text-blue-500 shrink-0" />
                  Download Template & Data Saat Ini (Edit Massal)
                </button>
              )}

              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="flex items-center w-full px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors text-left border-t border-slate-100 cursor-pointer"
              >
                <Upload className="w-4 h-4 mr-3 text-emerald-600 shrink-0" />
                Upload Excel / CSV
              </button>
            </div>
          </div>
        )}
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
