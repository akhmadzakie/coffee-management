import React, { useState, useEffect } from "react";
import { PosPrinter, PrintDestination } from "../../types";
import {
  Printer,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Wifi,
  Usb,
  Bluetooth,
  Save,
  RotateCcw,
  Sparkles,
  AlertCircle,
} from "lucide-react";

interface PosPrinterSettingsModalProps {
  onClose: () => void;
}

export const PosPrinterSettingsModal: React.FC<PosPrinterSettingsModalProps> = ({
  onClose,
}) => {
  const [printers, setPrinters] = useState<PosPrinter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<PrintDestination>("BAR");

  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    connectionType: "LAN" | "BLUETOOTH" | "USB";
    targetStation: PrintDestination;
    ipAddress: string;
    port: number;
    paperWidth: "58mm" | "80mm";
  }>({
    name: "Printer Bar Minuman",
    connectionType: "LAN",
    targetStation: "BAR",
    ipAddress: "192.168.1.200",
    port: 9100,
    paperWidth: "80mm",
  });

  const fetchPrinters = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/pos/printers");
      if (res.ok) {
        const data = await res.json();
        setPrinters(data);
      }
    } catch (e) {
      console.error("Gagal mengambil printer:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  const handleSavePrinter = async () => {
    setIsSaving(true);
    try {
      const payload = {
        id: formData.id || crypto.randomUUID(),
        name: formData.name.trim() || `Printer ${formData.targetStation}`,
        connectionType: formData.connectionType,
        targetStation: formData.targetStation,
        ipAddress: formData.ipAddress.trim() || null,
        port: formData.port || 9100,
        paperWidth: formData.paperWidth,
        isActive: true,
      };

      const res = await fetch("/api/pos/printers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Gagal menyimpan konfigurasi printer");
      }

      alert("Konfigurasi printer berhasil disimpan.");
      fetchPrinters();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Routing Printer Stasiun & Kasir
              </h2>
              <p className="text-xs text-slate-400">
                Pemisahan tiket cetak otomatis ke Bar, Kitchen, Bakery, dan Kasir.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Station Tabs */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex gap-2">
          {[
            { id: "RECEIPT", label: "Kasir (Struk)", desc: "Thermal 80mm/58mm" },
            { id: "BAR", label: "Bar Minuman", desc: "Tiket Barista" },
            { id: "KITCHEN", label: "Kitchen Makanan", desc: "Tiket Dapur" },
            { id: "BAKERY", label: "Bakery & Pastry", desc: "Tiket Pastry" },
          ].map((st) => {
            const isSelected = activeTab === st.id;
            return (
              <button
                key={st.id}
                onClick={() => {
                  setActiveTab(st.id as PrintDestination);
                  const existing = printers.find((p) => p.targetStation === st.id);
                  if (existing) {
                    setFormData({
                      id: existing.id,
                      name: existing.name,
                      connectionType: existing.connectionType,
                      targetStation: existing.targetStation,
                      ipAddress: existing.ipAddress || "",
                      port: existing.port || 9100,
                      paperWidth: existing.paperWidth,
                    });
                  } else {
                    setFormData({
                      id: undefined,
                      name: `Printer ${st.label}`,
                      connectionType: "LAN",
                      targetStation: st.id as PrintDestination,
                      ipAddress: "192.168.1.200",
                      port: 9100,
                      paperWidth: "80mm",
                    });
                  }
                }}
                className={`flex-1 py-2 px-2.5 rounded-xl text-left border transition ${
                  isSelected
                    ? "bg-sky-500/15 border-sky-500 text-white shadow-md shadow-sky-500/10"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <p className="text-xs font-bold leading-tight">{st.label}</p>
                <p className="text-[10px] text-slate-500">{st.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">
              Nama Printer / Identifikasi
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-2 block">
              Tipe Konektivitas
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "LAN", label: "LAN / Wi-Fi (ESC/POS)", icon: Wifi },
                { id: "BLUETOOTH", label: "Bluetooth Thermal", icon: Bluetooth },
                { id: "USB", label: "Kabel USB", icon: Usb },
              ].map((c) => {
                const Icon = c.icon;
                const isSelected = formData.connectionType === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        connectionType: c.id as "LAN" | "BLUETOOTH" | "USB",
                      })
                    }
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                      isSelected
                        ? "bg-sky-500/20 border-sky-500 text-sky-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px]">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {formData.connectionType === "LAN" && (
            <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-slate-400 mb-1 block">
                  IP Address Printer Jaringan
                </label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.200"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400 mb-1 block">
                  Port RAW ESC/POS
                </label>
                <input
                  type="number"
                  placeholder="9100"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) || 9100 })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Lebar Kertas Thermal
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setFormData({ ...formData, paperWidth: "80mm" })}
                className={`py-1.5 text-xs font-semibold rounded-lg ${
                  formData.paperWidth === "80mm"
                    ? "bg-sky-500 text-slate-950"
                    : "text-slate-400"
                }`}
              >
                80mm (Standar POS Kafe / Resto)
              </button>
              <button
                onClick={() => setFormData({ ...formData, paperWidth: "58mm" })}
                className={`py-1.5 text-xs font-semibold rounded-lg ${
                  formData.paperWidth === "58mm"
                    ? "bg-sky-500 text-slate-950"
                    : "text-slate-400"
                }`}
              >
                58mm (Mobile Mini Printer)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            Tutup
          </button>
          <button
            onClick={handleSavePrinter}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-lg shadow-sky-500/20 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Konfigurasi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
