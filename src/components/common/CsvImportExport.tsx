import React, { useRef, useState, useEffect } from "react";
import { Upload, Download, FileSpreadsheet, ChevronDown } from "lucide-react";
import { downloadCsvTemplate } from "../../utils/export";
import { GenericImportModal } from "./GenericImportModal";

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
            <div className="py-1">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center w-full px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <Download className="w-4 h-4 mr-3 text-slate-400" />
                Download Template CSV
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="flex items-center w-full px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-t border-slate-100"
              >
                <Upload className="w-4 h-4 mr-3 text-emerald-600" />
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
        expectedHeaders={templateHeaders}
        onImport={(data) => {
          onImport(data);
        }}
      />
    </>
  );
};
