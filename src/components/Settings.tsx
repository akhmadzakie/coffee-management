import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { FEATURES } from "../config/features";
import { useStore } from "../store/StoreContext";
import { authFetch } from "../utils/authHeaders";
import { toast } from "../context/ToastContext";
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
  BookOpen,
  FileText,
  Download,
  PieChart,
} from "lucide-react";
import { ConnectedDevices } from "./ConnectedDevices";
import { DataCleaningPanel } from "./DataCleaningPanel";
import { CustomSelect } from "./common/CustomSelect";

export const SettingsComponent = () => {
  const { settings, updateSettings, currentUser } = useStore();
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const isManager = currentUser?.role === "MANAGER";
  const isOwner = currentUser?.role === "OWNER";

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
  const [autoDeductStockOnSale, setAutoDeductStockOnSale] = useState(settings.autoDeductStockOnSale === true);
  const [allowNegativeStockSale, setAllowNegativeStockSale] = useState(settings.allowNegativeStockSale !== false);
  const [profitShareOwnerPercent, setProfitShareOwnerPercent] = useState<number>(settings.profitShareOwnerPercent ?? 70);
  const [profitShareReservePercent, setProfitShareReservePercent] = useState<number>(settings.profitShareReservePercent ?? 30);
  const [profitShareInvestorPercent, setProfitShareInvestorPercent] = useState<number>(settings.profitShareInvestorPercent ?? 0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [hasEdited, setHasEdited] = useState(false);

  // Sinkronkan state form ketika data settings dari server selesai dimuat (kecuali user sudah mulai mengedit)
  useEffect(() => {
    if (hasEdited) return;
    setBrandName(settings.brandName || "");
    setLogoDataUrl(settings.logoDataUrl || null);
    setCompanyAddress(settings.companyAddress || "");
    setBankDetails(settings.bankDetails || "");
    setSalesPerson(settings.salesPerson || "");
    setFooterMessage(settings.footerMessage || "");
    setGeminiApiKey(settings.geminiApiKey || "");
    setLanguage(settings.language || "id");
    setTaxEnabled(settings.taxEnabled ?? false);
    setTaxRate(settings.taxRate ?? 10);
    setTaxMode(settings.taxMode ?? "EXCLUSIVE");
    setMaxCashierDiscount(settings.maxCashierDiscount ?? 10);
    setPosSupervisorPin(settings.posSupervisorPin || "1234");
    setAutoDeductStockOnSale(settings.autoDeductStockOnSale === true);
    setAllowNegativeStockSale(settings.allowNegativeStockSale !== false);
    setProfitShareOwnerPercent(settings.profitShareOwnerPercent ?? 70);
    setProfitShareReservePercent(settings.profitShareReservePercent ?? 30);
    setProfitShareInvestorPercent(settings.profitShareInvestorPercent ?? 0);
  }, [settings, hasEdited]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isOwner) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setHasEdited(true);
        setLogoDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (isOwner) {
      toast.warning("Akun Owner berstatus Read-Only dan tidak dapat mengubah pengaturan sistem.");
      return;
    }
    const canEditProfitShare = isSuperAdmin || isManager;
    const ownerPct = Math.min(100, Math.max(0, Math.round(Number(profitShareOwnerPercent) || 0)));
    const reservePct = Math.min(100, Math.max(0, Math.round(Number(profitShareReservePercent) || 0)));
    const investorPct = Math.min(100, Math.max(0, Math.round(Number(profitShareInvestorPercent) || 0)));
    if (canEditProfitShare && ownerPct + reservePct + investorPct !== 100) {
      toast.error("Total pembagian keuntungan (Owner + Tabungan Kedai + Investor) harus tepat 100%.");
      return;
    }
    updateSettings({
      ...settings,
      brandName,
      logoDataUrl,
      companyAddress,
      bankDetails,
      salesPerson,
      footerMessage,
      language,
      geminiApiKey: isSuperAdmin ? geminiApiKey : settings.geminiApiKey,
      taxEnabled,
      taxRate: Number(taxRate) || 0,
      taxMode,
      maxCashierDiscount: Number(maxCashierDiscount) || 0,
      posSupervisorPin: posSupervisorPin.trim() || "1234",
      autoDeductStockOnSale,
      allowNegativeStockSale,
      profitShareOwnerPercent: canEditProfitShare ? ownerPct : (settings.profitShareOwnerPercent ?? 70),
      profitShareReservePercent: canEditProfitShare ? reservePct : (settings.profitShareReservePercent ?? 30),
      profitShareInvestorPercent: canEditProfitShare ? investorPct : (settings.profitShareInvestorPercent ?? 0),
    });
    setHasEdited(false);
    const msg =
      language === "id"
        ? "Pengaturan berhasil disimpan!"
        : "Settings saved successfully!";
    setSaveStatus(msg);
    toast.success(msg);
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
      const res = await authFetch("/api/ai/test-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: geminiApiKey.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghubungi Gemini API");
      }

      setTestResult({
        success: true,
        message: `Koneksi Berhasil! Model ${data.model || "Gemini 2.5 Flash"} aktif dan siap digunakan.`,
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
    if (isOwner) return;
    setHasEdited(true);
    setLogoDataUrl(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-8 max-w-4xl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        {/* Role Access Indicator Badge */}
        <div>
          {isSuperAdmin && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold shadow-2xs">
              <Shield className="w-3.5 h-3.5 text-sky-600" />
              <span>Super Admin (Akses Penuh IT & Sistem)</span>
            </span>
          )}
          {isManager && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 text-xs font-bold shadow-2xs">
              <Store className="w-3.5 h-3.5 text-brand-600" />
              <span>Manager Operasional (Toko & Pajak)</span>
            </span>
          )}
          {isOwner && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs">
              <Eye className="w-3.5 h-3.5 text-amber-600" />
              <span>Owner / Investor (Pengawasan Eksekutif - Read Only)</span>
            </span>
          )}
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
              disabled={isOwner}
              value={brandName}
              onChange={(e) => {
                setHasEdited(true);
                setBrandName(e.target.value);
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
              <div className="shrink-0 flex flex-col items-center gap-2">
                <div className="w-28 h-28 sm:w-32 sm:h-32 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center bg-slate-50 overflow-hidden relative group shadow-2xs">
                  {logoDataUrl ? (
                    <>
                      <img
                        src={logoDataUrl}
                        alt="Company Logo"
                        className="w-full h-full object-contain p-2"
                      />
                      {!isOwner && (
                        <div className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center transition-all">
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="text-white text-xs font-bold px-3 py-1.5 bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
                          >
                            {language === "id" ? "Hapus" : "Remove"}
                          </button>
                        </div>
                      )}
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
                {logoDataUrl && !isOwner && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="text-xs font-bold px-3 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer transition-colors"
                  >
                    {language === "id" ? "Hapus Logo" : "Remove Logo"}
                  </button>
                )}
              </div>

              <div className="flex-1 w-full">
                <label
                  htmlFor={isOwner ? undefined : "logo-upload"}
                  className={`flex flex-col items-center justify-center w-full h-28 sm:h-32 border-2 border-slate-300 border-dashed rounded-2xl transition-colors ${
                    isOwner
                      ? "bg-slate-100 opacity-60 cursor-not-allowed"
                      : "cursor-pointer bg-slate-50 hover:bg-slate-100"
                  }`}
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
                    disabled={isOwner}
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
              disabled={isOwner}
              value={companyAddress}
              onChange={(e) => {
                setHasEdited(true);
                setCompanyAddress(e.target.value);
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all min-h-[80px] disabled:opacity-60 disabled:cursor-not-allowed"
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
                disabled={isOwner}
                value={salesPerson}
                onChange={(e) => {
                  setHasEdited(true);
                  setSalesPerson(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
                disabled={isOwner}
                value={bankDetails}
                onChange={(e) => {
                  setHasEdited(true);
                  setBankDetails(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all min-h-[80px] disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="e.g., BCA 123456789 a.n Julia..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              System Language / Bahasa Sistem
            </label>
            <CustomSelect
              value={language}
              disabled={isOwner}
              onChange={(val) => {
                setHasEdited(true);
                setLanguage(val as "en" | "id");
              }}
              options={[
                { value: "id", label: "Bahasa Indonesia" },
                { value: "en", label: "English" },
              ]}
              buttonClassName="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold text-slate-800 hover:bg-white"
            />
          </div>

          {/* Gemini API Key Configuration Card */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Google Gemini API Key (AI Copilot &amp; OCR Struk)</span>
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
                  disabled={!isSuperAdmin}
                  onChange={(e) => {
                    if (isSuperAdmin) {
                      setHasEdited(true);
                      setGeminiApiKey(e.target.value);
                      setTestResult(null);
                    }
                  }}
                  className={`w-full pl-3 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base sm:text-xs font-mono text-slate-900 outline-none ${
                    !isSuperAdmin ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
                  }`}
                  placeholder={isSuperAdmin ? "AIzaSy..." : "Terkunci (Hanya Super Admin)"}
                />
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showApiKey ? "Sembunyikan Key" : "Tampilkan Key"}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {isSuperAdmin && (
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
              )}
            </div>

            {!isSuperAdmin && (
              <p className="text-[11px] text-amber-800 bg-amber-100/70 px-3 py-1.5 rounded-lg border border-amber-200 font-medium flex items-center gap-1.5">
                <span>🔒</span>
                <span>Konfigurasi teknis API Key & sistem AI dikelola khusus oleh <strong>Super Admin (IT)</strong>.</span>
              </p>
            )}

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

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Kunci API ini digunakan untuk mengaktifkan AI Copilot (konsultasi bisnis, resep, strategi margin) dan pembacaan otomatis dokumen nota/faktur PDF &amp; foto secara cerdas.
            </p>
          </div>

          {/* POS Kasir & Pajak Resto Configuration Card */}
          <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-brand-600" />
                <span>{FEATURES.POS ? "Pengaturan POS Kasir & Pajak Restoran (PB1)" : "Pengaturan Pajak Restoran (PB1)"}</span>
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
                    {FEATURES.POS ? "Otomatis tambahkan atau hitung pajak PB1 di kasir POS tablet." : "Otomatis tambahkan atau hitung pajak PB1 pada perhitungan omzet penjualan."}
                  </p>
                </div>
                <label className={`relative inline-flex items-center ${isOwner ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    disabled={isOwner}
                    checked={taxEnabled}
                    onChange={(e) => {
                      setHasEdited(true);
                      setTaxEnabled(e.target.checked);
                    }}
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
                      disabled={isOwner}
                      value={taxRate}
                      onChange={(e) => {
                        setHasEdited(true);
                        setTaxRate(Number(e.target.value) || 0);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base sm:text-xs font-mono focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">
                      Model Perhitungan Pajak
                    </label>
                    <CustomSelect
                      value={taxMode}
                      disabled={isOwner}
                      onChange={(val) => {
                        setHasEdited(true);
                        setTaxMode(val as "INCLUSIVE" | "EXCLUSIVE");
                      }}
                      options={[
                        {
                          value: "EXCLUSIVE",
                          label: "Eksklusif (Subtotal + Pajak = Total Tagihan)",
                        },
                        {
                          value: "INCLUSIVE",
                          label: "Inklusif (Harga menu sudah termasuk pajak)",
                        },
                      ]}
                      buttonClassName="w-full px-3 py-2 border border-slate-300 rounded-xl text-base sm:text-xs font-semibold bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Plafon Diskon Kasir */}
{FEATURES.POS && (
<>
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
                disabled={isOwner}
                min="0"
                max="100"
                value={maxCashierDiscount}
                onChange={(e) => {
                  setHasEdited(true);
                  setMaxCashierDiscount(Number(e.target.value) || 0);
                }}
                className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-xl text-base sm:text-xs font-mono focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
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
                    disabled={isOwner}
                    maxLength={6}
                    value={posSupervisorPin}
                    onChange={(e) => {
                      setHasEdited(true);
                      setPosSupervisorPin(e.target.value.replace(/\D/g, ""));
                    }}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-xl text-base sm:text-sm font-mono tracking-widest text-slate-900 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
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
                  <strong className="text-slate-700">Wewenang:</strong> <strong>Manager Operasional</strong> dan <strong>Super Admin</strong> dapat memperbarui PIN ini sewaktu-waktu. Kasir cukup meminta otorisasi PIN ini di kasir untuk aksi Void &amp; Refund tanpa meminjam akun login pribadi Manager. Default: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">1234</code>.
                </p>
              </div>
            </div>

            </>
)}
            {/* Pembagian Keuntungan & Tabungan Kedai */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-500/30 flex items-center justify-center text-brand-700 dark:text-brand-300">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Pembagian Keuntungan &amp; Tabungan Kedai
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Diatur oleh <strong>Manager / Super Admin</strong> (total porsi harus 100%). Terhubung ke Rekap Keuntungan Owner &amp; Laporan Laba Rugi.
                    </p>
                  </div>
                </div>
                <span
                  className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[11px] font-bold font-mono tabular-nums border ${
                    profitShareOwnerPercent + profitShareReservePercent + profitShareInvestorPercent === 100
                      ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                      : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
                  }`}
                >
                  Total: {profitShareOwnerPercent + profitShareReservePercent + profitShareInvestorPercent}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Porsi Owner (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!(isSuperAdmin || isManager)}
                    value={profitShareOwnerPercent}
                    onChange={(e) => {
                      setHasEdited(true);
                      setProfitShareOwnerPercent(Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tabungan / Cadangan Kedai (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!(isSuperAdmin || isManager)}
                    value={profitShareReservePercent}
                    onChange={(e) => {
                      setHasEdited(true);
                      setProfitShareReservePercent(Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Porsi Investor / Lainnya (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!(isSuperAdmin || isManager)}
                    value={profitShareInvestorPercent}
                    onChange={(e) => {
                      setHasEdited(true);
                      setProfitShareInvestorPercent(Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
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
                    Otomatisasi Stok Bahan dari Penjualan
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Atur bagaimana rekap/impor penjualan memengaruhi stok bahan baku.
                  </p>
                </div>
              </div>

              {/* Toggle 1: Potong Stok Otomatis */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Potong Stok Bahan Otomatis dari Penjualan {FEATURES.POS ? "POS" : "(Rekap/Impor)"}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-200">OFF (Disarankan untuk kontrol mutasi + opname mingguan):</strong> Stok hanya berkurang dari pencatatan mutasi keluar harian &amp; stok opname, sementara penjualan produk menghitung <strong className="text-brand-700 dark:text-brand-300">Perkiraan Pemakaian Bahan &amp; Estimasi HPP</strong> sebagai pembanding. Nyalakan hanya jika tidak mencatat mutasi keluar harian.
                  </p>
                </div>
                <label className={`relative inline-flex items-center shrink-0 ${isOwner ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    disabled={isOwner}
                    checked={autoDeductStockOnSale}
                    onChange={(e) => {
                      setHasEdited(true);
                      setAutoDeductStockOnSale(e.target.checked);
                    }}
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
                    Penjualan tetap dapat diproses dan dicatat walaupun stok di sistem tercatat 0 (misal akibat staf terlambat input stok opname atau nota belanja). Stok akan tercatat minus untuk direkonsiliasi kemudian.
                  </p>
                </div>
                <label className={`relative inline-flex items-center shrink-0 ${isOwner ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    disabled={isOwner}
                    checked={allowNegativeStockSale}
                    onChange={(e) => {
                      setHasEdited(true);
                      setAllowNegativeStockSale(e.target.checked);
                    }}
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
              disabled={isOwner}
              value={footerMessage}
              onChange={(e) => {
                setHasEdited(true);
                setFooterMessage(e.target.value);
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="e.g., You are our strongest connection..."
            />
          </div>

          {/* Buku Panduan Resmi & SOP Julia's Coffee */}
          <div className="pt-5 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Buku Panduan Resmi & Standar Operasional Prosedur (SOP)
                </h3>
                <p className="text-xs text-slate-500">
                  Unduh dokumen panduan format PDF resmi untuk operasional kedai dan pelatihan tim.
                </p>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${FEATURES.POS || FEATURES.KDS ? "md:grid-cols-3" : "md:grid-cols-2"} gap-3`}>
              {/* Card 1: Master Guide */}
              <a
                href="/Buku_Panduan_Lengkap_Julia_Coffee.pdf"
                target="_blank"
                rel="noreferrer"
                download="Buku_Panduan_Lengkap_Julia_Coffee.pdf"
                className="group flex flex-col justify-between p-3.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-all shadow-xs border border-brand-500"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                      Master Guide
                    </span>
                    <Download className="w-4 h-4 text-amber-400 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">
                    Buku Panduan Komprehensif
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    Dokumen induk mencakup arsitektur 9 role, alur sistem, formula HPP, inventori, dan pemeliharaan.
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Unduh PDF Lengkap (4 Hal)
                </div>
              </a>

              {(FEATURES.POS || FEATURES.KDS) && (
              /* Card 2: Kasir & KDS */
              <a
                href="/Panduan_Operasional_Kasir_dan_KDS.pdf"
                target="_blank"
                rel="noreferrer"
                download="Panduan_Operasional_Kasir_dan_KDS.pdf"
                className="group flex flex-col justify-between p-3.5 bg-gradient-to-br from-brand-900 to-brand-950 text-white rounded-xl hover:from-brand-800 hover:to-brand-900 transition-all shadow-xs border border-brand-800"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-500 text-white">
                      Front & Back Office
                    </span>
                    <Download className="w-4 h-4 text-brand-300 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">
                    Panduan Kasir & KDS Dapur
                  </h4>
                  <p className="text-[11px] text-brand-100">
                    SOP Buka Shift, Transaksi Meja, Split Bill, Tiket Layar Barista/Dapur, Kalibrasi, hingga Z-Report.
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-brand-300 font-semibold flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Unduh PDF Kasir & KDS (3 Hal)
                </div>
              </a>
              )}

              {/* Card 3: Owner & Manager */}
              <a
                href="/Panduan_Manajerial_Owner_dan_Manager.pdf"
                target="_blank"
                rel="noreferrer"
                download="Panduan_Manajerial_Owner_dan_Manager.pdf"
                className="group flex flex-col justify-between p-3.5 bg-gradient-to-br from-emerald-950 to-slate-900 text-white rounded-xl hover:from-emerald-900 hover:to-slate-800 transition-all shadow-xs border border-emerald-800"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
                      Executive & Finance
                    </span>
                    <Download className="w-4 h-4 text-emerald-300 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1">
                    Panduan Owner & Manager
                  </h4>
                  <p className="text-[11px] text-emerald-100">
                    Dashboard P&L Laba-Rugi, Otorisasi PIN Void, Pembelian PO, Stok Opname, Payroll & Reset Bersih.
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Unduh PDF Manajerial (3 Hal)
                </div>
              </a>
            </div>
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
          disabled={isOwner}
          className={`flex items-center px-5 py-2.5 rounded-xl transition-all shadow-xs font-bold text-xs sm:text-sm ${
            isOwner
              ? "bg-slate-200 text-slate-500 cursor-not-allowed"
              : "bg-brand-600 text-white hover:bg-brand-700 cursor-pointer active:scale-95"
          }`}
        >
          <Save className="w-4 h-4 mr-2" />
          {isOwner
            ? "Akun Pengawasan (Hanya Baca)"
            : language === "id"
            ? "Simpan Pengaturan"
            : "Save Settings"}
        </button>
      </div>

      {/* Super Admin Data Cleaning & Client Setup */}
      {isSuperAdmin && <DataCleaningPanel />}
    </motion.div>
  );
};
