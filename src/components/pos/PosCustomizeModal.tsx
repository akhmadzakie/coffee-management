import React, { useState, useMemo } from "react";
import { formatCurrency } from "../../utils/format";
import { OrderModifier, PrintDestination } from "../../types";
import {
  Coffee,
  Flame,
  Snowflake,
  Plus,
  Minus,
  Check,
  X,
  Sparkles,
  Milk,
  MessageSquare,
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  defaultStation: PrintDestination;
  price?: number;
}

interface PosCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem | null;
  onAddToCartWithCustomization: (customizedItem: {
    recipeId: string;
    menuName: string;
    variantName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    modifiers: OrderModifier[];
    notes?: string;
    printDestination: PrintDestination;
  }) => void;
}

export const PosCustomizeModal: React.FC<PosCustomizeModalProps> = ({
  isOpen,
  onClose,
  item,
  onAddToCartWithCustomization,
}) => {
  if (!isOpen || !item) return null;

  const basePrice = item.price || 20000;
  const isDrink =
    item.category.toUpperCase() === "COFFEE" ||
    item.category.toUpperCase() === "NON-COFFEE";

  // State pilihan kustomisasi
  const [temperature, setTemperature] = useState<"ICED" | "HOT">(
    isDrink ? "ICED" : "HOT"
  );
  const [sweetness, setSweetness] = useState<string>("Normal Sugar (100%)");
  const [iceLevel, setIceLevel] = useState<string>("Normal Ice");
  const [selectedMilk, setSelectedMilk] = useState<{
    name: string;
    price: number;
  }>({ name: "Fresh Milk (Default)", price: 0 });
  const [selectedAddons, setSelectedAddons] = useState<
    { name: string; price: number }[]
  >([]);
  const [notes, setNotes] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  // Daftar opsi
  const milkOptions = [
    { name: "Fresh Milk (Default)", price: 0 },
    { name: "Oat Milk", price: 8000 },
    { name: "Almond Milk", price: 8000 },
    { name: "Soy Milk", price: 7000 },
  ];

  const addonOptions = [
    { name: "Extra Espresso Shot", price: 5000 },
    { name: "Vanilla Syrup", price: 4000 },
    { name: "Caramel Drizzle", price: 4000 },
    { name: "Hazelnut Syrup", price: 4000 },
    { name: "Coffee Jelly", price: 5000 },
    { name: "Whipped Cream", price: 5000 },
  ];

  const toggleAddon = (addon: { name: string; price: number }) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((a) => a.name === addon.name);
      if (exists) {
        return prev.filter((a) => a.name !== addon.name);
      }
      return [...prev, addon];
    });
  };

  // Kalkulasi harga per unit
  const unitPrice = useMemo(() => {
    let price = basePrice;
    if (isDrink && temperature === "ICED") {
      price += 2000; // Iced +2000
    }
    price += selectedMilk.price;
    selectedAddons.forEach((a) => {
      price += a.price;
    });
    return price;
  }, [basePrice, isDrink, temperature, selectedMilk, selectedAddons]);

  const subtotal = useMemo(() => {
    return unitPrice * quantity;
  }, [unitPrice, quantity]);

  const handleConfirm = () => {
    const modifiers: OrderModifier[] = [];

    if (isDrink) {
      if (temperature === "ICED") {
        modifiers.push({ name: "Suhu: Dingin (Iced)", extraPrice: 2000 });
      } else {
        modifiers.push({ name: "Suhu: Panas (Hot)", extraPrice: 0 });
      }

      modifiers.push({ name: sweetness, extraPrice: 0 });

      if (temperature === "ICED") {
        modifiers.push({ name: iceLevel, extraPrice: 0 });
      }

      if (selectedMilk.price > 0) {
        modifiers.push({
          name: `Susu: ${selectedMilk.name}`,
          extraPrice: selectedMilk.price,
        });
      }
    }

    selectedAddons.forEach((a) => {
      modifiers.push({ name: `+ ${a.name}`, extraPrice: a.price });
    });

    const variantName = isDrink
      ? `${temperature === "ICED" ? "Iced" : "Hot"}${
          selectedMilk.price > 0 ? ` (${selectedMilk.name})` : ""
        }`
      : "Regular";

    onAddToCartWithCustomization({
      recipeId: item.id,
      menuName: item.name,
      variantName,
      quantity,
      unitPrice,
      subtotal,
      modifiers,
      notes: notes.trim() || undefined,
      printDestination: item.defaultStation || "BAR",
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-50 border border-brand-200 text-brand-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>{item.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {item.category}
                </span>
              </h2>
              <p className="text-[11px] text-brand-700 font-bold">
                Harga Dasar: {formatCurrency(basePrice)}
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

        {/* Body Opsi Kustomisasi */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Suhu: Hot vs Iced (khusus minuman) */}
          {isDrink && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Pilihan Suhu Minuman
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTemperature("ICED")}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                    temperature === "ICED"
                      ? "bg-sky-50 border-sky-400 text-sky-800 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Snowflake className="w-4 h-4 text-sky-600" />
                  <span>Dingin / Iced (+Rp 2.000)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTemperature("HOT")}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                    temperature === "HOT"
                      ? "bg-rose-50 border-rose-400 text-rose-900 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Flame className="w-4 h-4 text-rose-600" />
                  <span>Panas / Hot (Rp 0)</span>
                </button>
              </div>
            </div>
          )}

          {/* Level Gula / Sweetness (khusus minuman) */}
          {isDrink && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Tingkat Kemanisan (Sweetness)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  "Normal (100%)",
                  "Less (70%)",
                  "Half (50%)",
                  "No Sugar (0%)",
                ].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSweetness(lvl)}
                    className={`py-2 px-1 rounded-xl border text-[11px] font-semibold text-center transition ${
                      sweetness === lvl
                        ? "bg-brand-600 text-white font-bold border-brand-600 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Level Es (hanya jika Iced) */}
          {isDrink && temperature === "ICED" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Porsi Es (Ice Level)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {["Normal Ice", "Less Ice", "No Ice"].map((ice) => (
                  <button
                    key={ice}
                    type="button"
                    onClick={() => setIceLevel(ice)}
                    className={`py-2 px-1 rounded-xl border text-[11px] font-semibold text-center transition ${
                      iceLevel === ice
                        ? "bg-sky-600 text-white font-bold border-sky-600 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {ice}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opsi Susu (khusus minuman) */}
          {isDrink && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Milk className="w-3.5 h-3.5 text-brand-600" />
                <span>Pilihan Jenis Susu</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {milkOptions.map((milk) => {
                  const isSelected = selectedMilk.name === milk.name;
                  return (
                    <button
                      key={milk.name}
                      type="button"
                      onClick={() => setSelectedMilk(milk)}
                      className={`p-2.5 rounded-xl border text-xs text-left transition flex items-center justify-between ${
                        isSelected
                          ? "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span>{milk.name}</span>
                      <span className="text-[10px] text-slate-500">
                        {milk.price > 0 ? `+${formatCurrency(milk.price)}` : "Rp 0"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons / Topping Tambahan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Ekstra Add-on / Topping Tambahan
            </label>
            <div className="grid grid-cols-2 gap-2">
              {addonOptions.map((addon) => {
                const isSelected = selectedAddons.some(
                  (a) => a.name === addon.name
                );
                return (
                  <button
                    key={addon.name}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={`p-2.5 rounded-xl border text-xs text-left transition flex items-center justify-between ${
                      isSelected
                        ? "bg-brand-50 border-brand-500 text-brand-900 font-bold shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{addon.name}</span>
                    <span className="text-[10px] font-bold text-brand-700">
                      +{formatCurrency(addon.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Catatan Khusus untuk Barista/Dapur */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>Catatan Khusus Barista / Dapur</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pisah es di cup lain, bawa tumbler sendiri..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition"
            />
          </div>
        </div>

        {/* Footer: Kuantitas & Konfirmasi Tambah */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          {/* Stepper Jumlah */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center font-bold text-sm text-slate-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tombol Simpan */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-between shadow-md shadow-brand-600/20 transition"
          >
            <span>Tambah ke Keranjang</span>
            <span className="bg-brand-700/60 px-2 py-0.5 rounded-lg text-white font-extrabold text-sm">
              {formatCurrency(subtotal)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
