/**
 * Quick Waste & Barista Calibration Logging Modal
 * Julia's Coffee Management System
 */

import React, { useState } from "react";
import { useStore } from "../../store/StoreContext";
import { formatCurrency } from "../../utils/format";
import { Trash2, Coffee, AlertTriangle, X, Check, Scale } from "lucide-react";

interface PosQuickWasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultReason?: string;
}

export const PosQuickWasteModal: React.FC<PosQuickWasteModalProps> = ({
  isOpen,
  onClose,
  defaultReason = "KALIBRASI_PAGI",
}) => {
  const { ingredients, addStockMovement, currentUser } = useStore();

  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(() => {
    // Default cari espresso beans
    const bean = ingredients.find(
      (i) => i.name.toLowerCase().includes("bean") || i.name.toLowerCase().includes("kopi")
    );
    return bean?.id || ingredients[0]?.id || "";
  });

  const [quantity, setQuantity] = useState<string>("36"); // Default ~36g kalibrasi 2x double shot
  const [reason, setReason] = useState<string>(defaultReason);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentIng = ingredients.find((i) => i.id === selectedIngredientId);
  const qtyNum = Math.max(0, parseFloat(quantity) || 0);
  const unitCost = Number(currentIng?.costPerUnit) || 0;
  const totalLoss = Math.round(qtyNum * unitCost);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredientId || qtyNum <= 0) {
      alert("Pilih bahan dan masukkan jumlah bahan yang terbuang/dikalibrasi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const reasonLabel = {
        KALIBRASI_PAGI: "Kalibrasi Grinder Espresso Pagi",
        TUMPAH: "Bahan Tumpah / Jatuh di Bar",
        SALAH_BUAT: "Minuman Salah Buat (Mistake)",
        KEDALUWARSA: "Basi / Rusak / Kedaluwarsa",
        LAINNYA: "Lainnya",
      }[reason] || reason;

      const fullNote = `[WASTE / ${reasonLabel}] ${notes.trim() ? `• ${notes.trim()}` : ""}`;

      addStockMovement({
        ingredientId: selectedIngredientId,
        type: "WASTE",
        quantity: qtyNum,
        unitCost,
        totalCost: totalLoss,
        date: new Date().toISOString(),
        note: fullNote,
        createdBy: currentUser?.name || "Barista POS",
      });

      alert(`Berhasil mencatat waste ${qtyNum} ${currentIng?.unit || "unit"} ${currentIng?.name}!`);
      onClose();
    } catch (err: any) {
      alert(`Gagal mencatat waste: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 px-6 bg-gradient-to-r from-amber-600 to-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Catat Waste & Kalibrasi Barista
              </h2>
              <p className="text-xs text-white/90">
                Pencatatan akurat biji kalibrasi, susu terbuang, atau salah racik.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* 1. Pilih Bahan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Pilih Bahan Baku
            </label>
            <select
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} (Sisa: {ing.currentStock} {ing.unit} • HPP: {formatCurrency(ing.costPerUnit)}/{ing.unit})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Jumlah Terbuang */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Jumlah Terbuang ({currentIng?.unit || "unit"})
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Misal 36"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Quick calibration buttons */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Preset Kalibrasi Cepat
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuantity("18")}
                  className="flex-1 py-2 px-1 text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-xl hover:bg-amber-100 transition cursor-pointer"
                >
                  18g (1x)
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity("36")}
                  className="flex-1 py-2 px-1 text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-xl hover:bg-amber-100 transition cursor-pointer"
                >
                  36g (2x)
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity("54")}
                  className="flex-1 py-2 px-1 text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-xl hover:bg-amber-100 transition cursor-pointer"
                >
                  54g (3x)
                </button>
              </div>
            </div>
          </div>

          {/* 3. Alasan Waste */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Alasan Pembuangan (Reason)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "KALIBRASI_PAGI", label: "Kalibrasi Espresso", icon: Coffee },
                { id: "TUMPAH", label: "Tumpah / Jatuh", icon: AlertTriangle },
                { id: "SALAH_BUAT", label: "Salah Racik", icon: Scale },
                { id: "KEDALUWARSA", label: "Basi / Expired", icon: Trash2 },
              ].map((r) => {
                const Icon = r.icon;
                const isSelected = reason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReason(r.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-2xl border text-xs font-bold transition text-left cursor-pointer ${
                      isSelected
                        ? "bg-amber-50 border-amber-500 text-amber-900 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? "text-amber-600" : "text-slate-400"}`} />
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Catatan Detail */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Catatan Barista (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Grinder terlalu halus, dial-in batch kedua"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Impact Snapshot */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between text-xs">
            <span className="text-amber-900 font-medium">Estimasi Nilai Kerugian (HPP):</span>
            <span className="font-mono font-bold text-amber-900 text-sm">{formatCurrency(totalLoss)}</span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || qtyNum <= 0}
              className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? "Menyimpan..." : "Simpan Waste"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

