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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Routing Printer Stasiun & Kasir
              </h2>
              <p className="text-xs text-slate-500">
                Pemisahan tiket cetak otomatis ke Bar, Kitchen, Bakery, dan Kasir.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Station Tabs */}
        <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex gap-2">
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
                    ? "bg-white border-brand-500 text-slate-900 shadow-xs ring-1 ring-brand-500/30"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
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
            <label className="text-xs font-bold text-slate-700 mb-1.5 block">
              Nama Printer / Identifikasi
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
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
                        ? "bg-brand-600 border-brand-600 text-white font-bold shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px] font-semibold">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {formData.connectionType === "LAN" ? (
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="col-span-2">
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  IP Address Printer Jaringan
                </label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.200"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 font-mono transition"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Port RAW ESC/POS
                </label>
                <input
                  type="number"
                  placeholder="9100"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) || 9100 })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 font-mono transition"
                />
              </div>
            </div>
          ) : formData.connectionType === "BLUETOOTH" ? (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                  Status Perangkat Bluetooth
                </label>
                <input
                  type="text"
                  placeholder="Belum ada printer Bluetooth terhubung"
                  value={formData.ipAddress}
                  readOnly
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!("bluetooth" in navigator)) {
                    alert("Browser tablet ini belum mengizinkan Web Bluetooth. Gunakan Google Chrome pada Android/Windows.");
                    return;
                  }
                  try {
                    const device = await (navigator as any).bluetooth.requestDevice({
                      acceptAllDevices: true,
                    });
                    if (device) {
                      setFormData((prev) => ({
                        ...prev,
                        name: device.name || "Printer Bluetooth",
                        ipAddress: `BT-${device.name || device.id}`,
                      }));
                      alert(`Printer Bluetooth terhubung: ${device.name || device.id}`);
                    }
                  } catch (e: any) {
                    if (e.name !== "NotFoundError") {
                      alert(`Gagal menghubungkan Bluetooth: ${e.message}`);
                    }
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Bluetooth className="w-4 h-4 text-sky-600" />
                <span>Pindai & Pasangkan Printer Bluetooth</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
              <p className="text-xs text-slate-600">
                Hubungkan printer thermal kasir via kabel USB OTG ke tablet kasir.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1.5 block">
              Lebar Kertas Thermal
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setFormData({ ...formData, paperWidth: "80mm" })}
                className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                  formData.paperWidth === "80mm"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                80mm (Standar POS Kafe / Resto)
              </button>
              <button
                onClick={() => setFormData({ ...formData, paperWidth: "58mm" })}
                className={`py-1.5 text-xs font-semibold rounded-lg transition ${
                  formData.paperWidth === "58mm"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                58mm (Mobile Mini Printer)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
          >
            Tutup
          </button>
          <button
            onClick={handleSavePrinter}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Konfigurasi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
