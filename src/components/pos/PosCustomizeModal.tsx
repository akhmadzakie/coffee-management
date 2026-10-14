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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>{item.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {item.category}
                </span>
              </h2>
              <p className="text-[11px] text-amber-400 font-semibold">
                Harga Dasar: {formatCurrency(basePrice)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Opsi Kustomisasi */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Suhu: Hot vs Iced (khusus minuman) */}
          {isDrink && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Pilihan Suhu Minuman
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTemperature("ICED")}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                    temperature === "ICED"
                      ? "bg-sky-500/20 border-sky-400 text-sky-300 shadow-md shadow-sky-500/10"
                      : "bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <Snowflake className="w-4 h-4 text-sky-400" />
                  <span>Dingin / Iced (+Rp 2.000)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTemperature("HOT")}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                    temperature === "HOT"
                      ? "bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10"
                      : "bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Panas / Hot (Rp 0)</span>
                </button>
              </div>
            </div>
          )}

          {/* Level Gula / Sweetness (khusus minuman) */}
          {isDrink && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
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
                        ? "bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
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
              <label className="block text-xs font-semibold text-slate-300 mb-2">
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
                        ? "bg-sky-500/20 text-sky-300 font-bold border-sky-400"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
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
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Milk className="w-3.5 h-3.5 text-amber-400" />
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
                          ? "bg-emerald-500/15 border-emerald-400 text-emerald-300 font-bold"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"
                      }`}
                    >
                      <span>{milk.name}</span>
                      <span className="text-[10px] text-slate-400">
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
            <label className="block text-xs font-semibold text-slate-300 mb-2">
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
                        ? "bg-amber-500/15 border-amber-400 text-amber-300 font-bold"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"
                    }`}
                  >
                    <span>{addon.name}</span>
                    <span className="text-[10px] font-semibold text-amber-400">
                      +{formatCurrency(addon.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Catatan Khusus untuk Barista/Dapur */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Catatan Khusus Barista / Dapur</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pisah es di cup lain, bawa tumbler sendiri..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Footer: Kuantitas & Konfirmasi Tambah */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          {/* Stepper Jumlah */}
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-2xl border border-slate-700">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-xl bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center font-bold text-sm text-white">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-xl bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tombol Simpan */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-between shadow-lg shadow-amber-500/20 transition"
          >
            <span>Tambah ke Keranjang</span>
            <span className="bg-slate-950/20 px-2 py-0.5 rounded-lg text-slate-950 font-extrabold text-sm">
              {formatCurrency(subtotal)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
