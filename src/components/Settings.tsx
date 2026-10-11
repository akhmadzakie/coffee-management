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
        message: "Koneksi Berhasil! Model Gemini 2.5 Flash aktif dan siap digunakan.",
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
          <Building2 className="w-5 h-5 mr-2 text-slate-500" />
          {language === "id" ? "Profil Perusahaan" : "Company Profile"}
        </h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {language === "id" ? "Nama Usaha / Brand" : "Company/Brand Name"}
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., THE NODE SUPPLY"
            />
            <p className="mt-1 text-xs text-slate-500">
              {language === "id"
                ? "Nama ini akan dicetak pada faktur/invoice dan laporan."
                : "This name will appear on invoices and reports."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {language === "id" ? "Logo Perusahaan" : "Company Logo"}
            </label>

            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50 overflow-hidden relative group">
                  {logoDataUrl ? (
                    <>
                      <img
                        src={logoDataUrl}
                        alt="Company Logo"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                        <button
                          onClick={removeLogo}
                          className="text-white text-xs font-semibold px-2 py-1 bg-rose-600 rounded"
                        >
                          {language === "id" ? "Hapus" : "Remove"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <Building2 className="mx-auto h-8 w-8 text-slate-400" />
                      <p className="mt-1 text-xs text-slate-500">
                        {language === "id" ? "Belum ada logo" : "No logo"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="logo-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-6 h-6 mb-2 text-slate-500" />
                      <p className="text-sm text-slate-500 font-medium">
                        {language === "id"
                          ? "Klik untuk upload logo"
                          : "Click to upload or drag and drop"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
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
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {language === "id" ? "Alamat Perusahaan" : "Company Address"}
            </label>
            <textarea
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
              placeholder="e.g., Kabupaten Hulu Sungai Utara..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {language === "id"
                  ? "Nama Sales Standar"
                  : "Default Sales Person"}
              </label>
              <input
                type="text"
                value={salesPerson}
                onChange={(e) => setSalesPerson(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Zakie"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {language === "id"
                  ? "Informasi Rekening / Bank"
                  : "Bank Details"}
              </label>
              <textarea
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                placeholder="e.g., Blu (Bank Digital BCA) 0090..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              System Language / Bahasa Sistem
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "id")}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Gemini API Key Configuration Card */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Google Gemini API Key (AI Copilot & OCR Struk)</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1 hover:underline"
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
                  className="w-full pl-3 pr-10 py-2 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-xs sm:text-sm font-mono text-stone-900"
                  placeholder="AIzaSy..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  title={showApiKey ? "Sembunyikan Key" : "Tampilkan Key"}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={isTestingKey}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5 shadow-xs"
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
                className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {language === "id" ? "Pesan Footer Invoice" : "Footer Message"}
            </label>
            <input
              type="text"
              value={footerMessage}
              onChange={(e) => setFooterMessage(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., You are our strongest connection..."
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end items-center space-x-4">
        {saveStatus && (
          <span className="text-blue-600 font-medium text-sm flex items-center bg-blue-50 px-3 py-1.5 rounded-lg">
            {saveStatus}
          </span>
        )}
        <button
          onClick={handleSave}
          className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm font-medium"
        >
          <Save className="w-4 h-4 mr-2" />
          {language === "id" ? "Simpan Pengaturan" : "Save Settings"}
        </button>
      </div>
    </div>
  );
};
