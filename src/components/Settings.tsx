import React, { useState } from "react";
import { useStore } from "../store/StoreContext";
import {
  Upload,
  Save,
  Building2,
  Shield,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Percent,
  Store,
  KeyRound,
  Boxes,
} from "lucide-react";
import { ConnectedDevices } from "./ConnectedDevices";

export const SettingsComponent = () => {
  const { settings, updateSettings, currentUser } = useStore();
  const [brandName, setBrandName] = useState(settings.brandName);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(
    settings.logoDataUrl,
  );
  const [companyAddress, setCompanyAddress] = useState(settings.companyAddress);
  const [bankDetails, setBankDetails] = useState(settings.bankDetails);
  const [salesPerson, setSalesPerson] = useState(settings.salesPerson);
  const [footerMessage, setFooterMessage] = useState(settings.footerMessage);
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [language, setLanguage] = useState(settings.language || "id");
  const [taxEnabled, setTaxEnabled] = useState(settings.taxEnabled ?? false);
  const [taxRate, setTaxRate] = useState(settings.taxRate ?? 10);
  const [taxMode, setTaxMode] = useState<"INCLUSIVE" | "EXCLUSIVE">(settings.taxMode ?? "EXCLUSIVE");
  const [maxCashierDiscount, setMaxCashierDiscount] = useState(settings.maxCashierDiscount ?? 10);
  const [posSupervisorPin, setPosSupervisorPin] = useState(settings.posSupervisorPin || "1234");
  const [showSupervisorPin, setShowSupervisorPin] = useState(false);
  const [autoDeductStockOnSale, setAutoDeductStockOnSale] = useState(settings.autoDeductStockOnSale !== false);
  const [allowNegativeStockSale, setAllowNegativeStockSale] = useState(settings.allowNegativeStockSale !== false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    updateSettings({
      ...settings,
      brandName,
      logoDataUrl,
      companyAddress,
      bankDetails,
      salesPerson,
      footerMessage,
      language,
      geminiApiKey,
      taxEnabled,
      taxRate: Number(taxRate) || 0,
      taxMode,
      maxCashierDiscount: Number(maxCashierDiscount) || 0,
      posSupervisorPin: posSupervisorPin.trim() || "1234",
      autoDeductStockOnSale,
      allowNegativeStockSale,
    });
    setSaveStatus("Settings saved successfully!");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleTestApiKey = async () => {
    if (!geminiApiKey.trim()) {
      setTestResult({
        success: false,
        message: "Silakan masukkan Gemini API Key terlebih dahulu.",
      });
      return;
    }

    setIsTestingKey(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/ai/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: geminiApiKey.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghubungi Gemini API");
      }

      setTestResult({
        success: true,
        message: "Koneksi Berhasil! Model Gemini 3.8 Flash aktif dan siap digunakan.",
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Gagal menghubungkan API Key. Pastikan key aktif dan valid.",
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const removeLogo = () => {
    setLogoDataUrl(null);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {language === "id" ? "Pengaturan Sistem" : "Application Settings"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {language === "id"
              ? "Konfigurasi profil usaha, informasi invoice, dan keamanan sesi perangkat."
              : "Configure company profile, invoice information, and device session security."}
          </p>
        </div>
      </div>

      {/* Connected Devices & Active Sessions Management */}
      <ConnectedDevices />

      {/* Company Profile Settings Card */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-5 sm:p-6">
        <h3 className="text-base sm:text-lg font-black text-slate-900 mb-6 flex items-center">
          <Building2 className="w-5 h-5 mr-2 text-brand-600" />
          {language === "id" ? "Profil Perusahaan & Usaha" : "Company Profile"}
        </h3>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              {language === "id" ? "Nama Usaha / Brand" : "Company/Brand Name"}
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
              placeholder="e.g., Julia's Specialty Coffee"
            />
            <p className="mt-1 text-xs text-slate-500">
              {language === "id"
                ? "Nama ini akan dicetak pada faktur/invoice dan laporan."
                : "This name will appear on invoices and reports."}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              {language === "id" ? "Logo Perusahaan" : "Company Logo"}
            </label>

            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="shrink-0">
                <div className="w-28 h-28 sm:w-32 sm:h-32 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center bg-slate-50 overflow-hidden relative group shadow-2xs">
                  {logoDataUrl ? (
                    <>
                      <img
                        src={logoDataUrl}
                        alt="Company Logo"
                        className="w-full h-full object-contain p-2"
                      />
                      <div className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center transition-all">
                        <button
                          onClick={removeLogo}
                          className="text-white text-xs font-bold px-3 py-1.5 bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
                        >
                          {language === "id" ? "Hapus" : "Remove"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <Building2 className="mx-auto h-8 w-8 text-slate-400" />
                      <p className="mt-1 text-xs text-slate-500 font-medium">
                        {language === "id" ? "Belum ada logo" : "No logo"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 w-full">
                <label
                  htmlFor="logo-upload"
                  className="flex flex-col items-center justify-center w-full h-28 sm:h-32 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-6 h-6 mb-2 text-brand-600" />
                    <p className="text-xs sm:text-sm text-slate-700 font-bold">
                      {language === "id"
                        ? "Klik untuk upload logo brand"
                        : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      PNG, JPG, SVG, WEBP (Maks. 2MB)
                    </p>
                  </div>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              {language === "id" ? "Alamat Perusahaan" : "Company Address"}
            </label>
            <textarea
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all min-h-[80px]"
              placeholder="e.g., Jl. Sudirman No. 123..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {language === "id"
                  ? "Nama Sales Standar"
                  : "Default Sales Person"}
              </label>
              <input
                type="text"
                value={salesPerson}
                onChange={(e) => setSalesPerson(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                placeholder="e.g., Zakie"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {language === "id"
                  ? "Informasi Rekening / Bank"
                  : "Bank Details"}
              </label>
              <textarea
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all min-h-[80px]"
                placeholder="e.g., BCA 123456789 a.n Julia..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              System Language / Bahasa Sistem
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "id")}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Gemini API Key Configuration Card */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-bold text-stone-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Google Gemini API Key (AI Copilot & OCR Struk)</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-amber-700 hover:text-amber-900 font-bold inline-flex items-center gap-1 hover:underline"
              >
                <span>Dapatkan API Key Gratis</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={geminiApiKey}
                  onChange={(e) => {
                    setGeminiApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full pl-3 pr-10 py-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base sm:text-xs font-mono text-stone-900 outline-none"
                  placeholder="AIzaSy..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  title={showApiKey ? "Sembunyikan Key" : "Tampilkan Key"}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={isTestingKey}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                {isTestingKey ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menguji...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tes Koneksi</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                  testResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <p className="text-[11px] text-stone-500 leading-relaxed">
              Kunci API ini digunakan untuk mengaktifkan AI Copilot (konsultasi bisnis, resep, strategi margin) dan pembacaan otomatis dokumen nota/faktur PDF & foto secara cerdas.
            </p>
          </div>

          {/* POS Kasir & Pajak Resto Configuration Card */}
          <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-brand-600" />
                <span>Pengaturan POS Kasir & Pajak Restoran (PB1)</span>
              </label>
            </div>

            {/* Pajak Toggle & Details */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Aktifkan Pajak Restoran (PB1)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Otomatis tambahkan atau hitung pajak PB1 di kasir POS tablet.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxEnabled}
                    onChange={(e) => setTaxEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                </label>
              </div>

              {taxEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">
                      Tarif Pajak Resto (%)
                    </label>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base sm:text-xs font-mono focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">
                      Model Perhitungan Pajak
                    </label>
                    <select
                      value={taxMode}
                      onChange={(e) => setTaxMode(e.target.value as "INCLUSIVE" | "EXCLUSIVE")}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base sm:text-xs font-semibold focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white outline-none"
                    >
                      <option value="EXCLUSIVE">
                        Eksklusif (Subtotal + Pajak = Total Tagihan)
                      </option>
                      <option value="INCLUSIVE">
                        Inklusif (Harga menu sudah termasuk pajak)
                      </option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Plafon Diskon Kasir */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1">
                <span>Batas Plafon Diskon Mandiri Kasir (%)</span>
                <span className="text-[11px] text-brand-600 font-bold">{maxCashierDiscount}%</span>
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Kasir di tablet hanya bisa memberikan diskon maksimal sampai persentase ini. Diskon di atas nilai ini wajib memasukkan PIN otorisasi Supervisor/Manager.
              </p>
              <input
                type="number"
                min="0"
                max="100"
                value={maxCashierDiscount}
                onChange={(e) => setMaxCashierDiscount(Number(e.target.value) || 0)}
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-xl text-base sm:text-xs font-mono focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                placeholder="10"
              />
            </div>

            {/* PIN Otorisasi Supervisor POS */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      PIN Otorisasi Supervisor POS
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      PIN khusus untuk otorisasi Void, Refund, Buka Laci Kasir, dan Diskon di tablet kasir.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="relative w-full max-w-xs">
                  <input
                    type={showSupervisorPin ? "text" : "password"}
                    maxLength={6}
                    value={posSupervisorPin}
                    onChange={(e) => setPosSupervisorPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-xl text-base sm:text-sm font-mono tracking-widest text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    placeholder="1234"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupervisorPin(!showSupervisorPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showSupervisorPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  <strong className="text-slate-700">Keamanan:</strong> Kasir tidak perlu meminjam akun manajer. Cukup gunakan PIN Supervisor ini di kasir. Default: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">1234</code>.
                </p>
              </div>
            </div>

            {/* Otomatisasi & Kontrol Stok POS */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Otomatisasi Stok Bahan dari Penjualan Kasir
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Atur bagaimana penjualan di kasir memengaruhi stok bahan baku.
                  </p>
                </div>
              </div>

              {/* Toggle 1: Potong Stok Otomatis */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Potong Stok Bahan Otomatis dari Penjualan POS
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Saat pesanan lunas, bahan baku resep otomatis dipotong secara real-time. Jika dimatikan, stok hanya berubah dari mutasi manual atau stok opname.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={autoDeductStockOnSale}
                    onChange={(e) => setAutoDeductStockOnSale(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Toggle 2: Mode Anti-Macet (Allow Negative Stock) */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Mode Operasional Anti-Macet (Izinkan Jual saat Stok Sistem Habis)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Kasir tetap bisa melayani tamu walaupun stok di sistem tercatat 0 (misal akibat staf terlambat input stok opname atau nota belanja). Stok akan tercatat minus untuk direkonsiliasi kemudian.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={allowNegativeStockSale}
                    onChange={(e) => setAllowNegativeStockSale(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              {language === "id" ? "Pesan Footer Invoice" : "Footer Message"}
            </label>
            <input
              type="text"
              value={footerMessage}
              onChange={(e) => setFooterMessage(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
              placeholder="e.g., You are our strongest connection..."
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end items-center gap-3">
        {saveStatus && (
          <span className="text-emerald-700 font-bold text-xs sm:text-sm flex items-center bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl shadow-2xs">
            <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
            {saveStatus}
          </span>
        )}
        <button
          onClick={handleSave}
          className="flex items-center px-5 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-all shadow-xs font-bold text-xs sm:text-sm cursor-pointer active:scale-95"
        >
          <Save className="w-4 h-4 mr-2" />
          {language === "id" ? "Simpan Pengaturan" : "Save Settings"}
        </button>
      </div>
    </div>
  );
};
