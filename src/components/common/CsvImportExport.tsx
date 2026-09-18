import React, { useRef, useState, useEffect } from "react";
import Papa from "papaparse";
import { Upload, Download, FileSpreadsheet, ChevronDown } from "lucide-react";
import { downloadCsvTemplate } from "../../utils/export";

interface CsvImportExportProps {
  onImport: (data: any[]) => void;
  templateHeaders: string[];
  templateExampleRow?: string[];
  templateFilename?: string;
  buttonLabel?: string;
}

export const CsvImportExport: React.FC<CsvImportExportProps> = ({
  onImport,
  templateHeaders,
  templateExampleRow,
  templateFilename = "template.csv",
  buttonLabel = "Import Data",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownloadTemplate = () => {
    downloadCsvTemplate(templateFilename.replace(".csv", ""), templateHeaders, templateExampleRow);
    setIsOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setIsOpen(false);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        onImport(results.data);
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        setIsUploading(false);
        alert("Gagal membaca file CSV. Pastikan formatnya benar.");
      }
    });
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <input
        type="file"
        accept=".csv"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
        disabled={isUploading}
      />
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUploading}
        className="flex items-center justify-center px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-300 shadow-sm"
        title={buttonLabel}
      >
        {isUploading ? (
          <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"></div>
        ) : (
          <FileSpreadsheet className="w-4 h-4 sm:mr-2 text-emerald-600" />
        )}
        <span className="hidden sm:inline font-medium text-sm">{buttonLabel}</span>
        <ChevronDown className="w-3 h-3 ml-2 hidden sm:block opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
          <div className="py-1">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center w-full px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <Download className="w-4 h-4 mr-3 text-slate-400" />
              Download Template
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                fileInputRef.current?.click();
              }}
              className="flex items-center w-full px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
            >
              <Upload className="w-4 h-4 mr-3 text-emerald-600" />
              Upload CSV Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
