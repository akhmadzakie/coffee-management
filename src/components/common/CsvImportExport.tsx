import React, { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, Download } from "lucide-react";
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
  buttonLabel = "Import CSV",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDownloadTemplate = () => {
    downloadCsvTemplate(templateFilename.replace(".csv", ""), templateHeaders, templateExampleRow);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

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
    <div className="flex gap-2">
      <input
        type="file"
        accept=".csv"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
        disabled={isUploading}
      />
      <button
        onClick={handleDownloadTemplate}
        className="flex items-center px-3 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors border border-slate-300 shadow-sm"
        title="Download Template"
      >
        <Download className="w-4 h-4 sm:mr-2" />
        <span className="hidden sm:inline">Template</span>
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
      >
        {isUploading ? (
          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin sm:mr-2"></div>
        ) : (
          <Upload className="w-4 h-4 sm:mr-2" />
        )}
        <span className="hidden sm:inline">{buttonLabel}</span>
      </button>
    </div>
  );
};
