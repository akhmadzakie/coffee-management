import React, { useState, useRef } from "react";
import { useStore } from "../store/StoreContext";
import {
  Upload,
  Search,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { formatCurrency } from "../utils/format";

export const Sales = () => {
  const { salesTransactions, salesImportLogs, syncData, currentUser } =
    useStore();
  const [activeTab, setActiveTab] = useState<"sales" | "logs">("sales");
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSales = salesTransactions
    .filter((s) => s.menuName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredLogs = salesImportLogs.sort(
    (a, b) =>
      new Date(b.importDate).getTime() - new Date(a.importDate).getTime(),
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", currentUser?.id || "");

    try {
      const response = await fetch("/api/import/sales", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("node_session_id")}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadStatus({
          type: "success",
          message: `Berhasil import ${data.insertedCount} baris data penjualan.`,
        });
        await syncData(); // Refresh data from server
      } else {
        setUploadStatus({
          type: "error",
          message: data.error || "Gagal import data.",
        });
      }
    } catch (err) {
      setUploadStatus({
        type: "error",
        message: "Terjadi kesalahan jaringan.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab("sales")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "sales"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Data Penjualan
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "logs"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Riwayat Import
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {activeTab === "sales" && (
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari Menu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent w-full"
              />
            </div>
          )}

          <div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shrink-0 disabled:opacity-50"
            >
              {isUploading ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2"></div>
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Import CSV Kasir
            </button>
          </div>
        </div>
      </div>

      {uploadStatus && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${uploadStatus.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}
        >
          {uploadStatus.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="font-medium">{uploadStatus.message}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {activeTab === "sales" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-600">Tanggal</th>
                  <th className="p-4 font-semibold text-slate-600">
                    Nama Menu
                  </th>
                  <th className="p-4 font-semibold text-slate-600 text-right">
                    Quantity
                  </th>
                  <th className="p-4 font-semibold text-slate-600 text-right">
                    Total Penjualan
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-4 text-slate-800">
                      {new Date(sale.date).toLocaleDateString("id-ID", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="p-4 font-medium text-slate-800">
                      {sale.menuName}
                    </td>
                    <td className="p-4 text-slate-800 text-right">
                      {sale.quantitySold}
                    </td>
                    <td className="p-4 text-slate-800 text-right font-medium">
                      {formatCurrency(sale.totalPrice)}
                    </td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      Tidak ada data penjualan. Silakan import CSV dari mesin
                      kasir/POS.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-600">
                    Tanggal Import
                  </th>
                  <th className="p-4 font-semibold text-slate-600">
                    Nama File
                  </th>
                  <th className="p-4 font-semibold text-slate-600 text-center">
                    Jumlah Baris
                  </th>
                  <th className="p-4 font-semibold text-slate-600">Status</th>
                  <th className="p-4 font-semibold text-slate-600">
                    Diimport Oleh
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-4 text-slate-800">
                      {new Date(log.importDate).toLocaleDateString("id-ID", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-4 text-slate-800 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                      {log.fileName}
                    </td>
                    <td className="p-4 text-slate-800 text-center">
                      {log.rowCount}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{log.createdBy}</td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Belum ada riwayat import CSV.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
