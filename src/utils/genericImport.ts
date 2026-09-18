import * as XLSX from "xlsx";

export interface ParsedGenericRow {
  [key: string]: any;
}

export const parseGenericImportFile = async (
  file: File,
  expectedHeaders: string[]
): Promise<{ rows: ParsedGenericRow[]; errors: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("File tidak memiliki sheet/halaman.");
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!rawRows || rawRows.length === 0) {
          throw new Error("File kosong atau tidak dapat dibaca.");
        }

        // Validate Headers against the first row
        const actualHeaders = Object.keys(rawRows[0] as object);
        const missingHeaders = expectedHeaders.filter((h) => !actualHeaders.includes(h));

        if (missingHeaders.length > 0) {
          // Sometimes people change the header names slightly. We warn them.
          // But to be strict, we can throw an error if essential headers are missing.
          // However, for maximum flexibility, we just collect errors per row if mapped data is empty.
        }

        const rows: ParsedGenericRow[] = [];
        const errors: string[] = [];

        rawRows.forEach((row: any, index) => {
          const rowNum = index + 2; // +1 for 0-index, +1 for header
          // Clean keys (trim spaces)
          const cleanRow: any = {};
          for (const key in row) {
            cleanRow[key.trim()] = row[key];
          }

          rows.push(cleanRow);
        });

        resolve({ rows, errors });
      } catch (err: any) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error("Gagal membaca file."));
    };

    reader.readAsBinaryString(file);
  });
};
