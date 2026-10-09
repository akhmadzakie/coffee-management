import React, { useState } from "react";
import { useStore } from "../store/StoreContext";
import { Upload, Save, Building2, Shield } from "lucide-react";
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
  const [leaderBarTasks, setLeaderBarTasks] = useState<string[]>(settings.leaderBarTasks || []);
  const [leaderKitchenTasks, setLeaderKitchenTasks] = useState<string[]>(settings.leaderKitchenTasks || []);
  const [leaderBakerTasks, setLeaderBakerTasks] = useState<string[]>(settings.leaderBakerTasks || []);
  const [managerTasks, setManagerTasks] = useState<string[]>(settings.managerTasks || []);
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || "");
  
  const addTask = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    const task = prompt(language === "id" ? "Masukkan tugas baru:" : "Enter new task:");
    if (task) setter(prev => [...prev, task]);
  };
  
  const removeTask = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };
  
  const updateTask = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
    setter(prev => {
      const newTasks = [...prev];
      newTasks[index] = value;
      return newTasks;
    });
  };
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
      brandName,
      logoDataUrl,
      companyAddress,
      bankDetails,
      salesPerson,
      footerMessage,
      language,
      leaderBarTasks,
      leaderKitchenTasks,
      leaderBakerTasks,
      managerTasks,
      geminiApiKey,
    });
    setSaveStatus("Settings saved successfully!");
    setTimeout(() => setSaveStatus(null), 3000);
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
      {currentUser?.role !== "MANAGER" && (
        <>
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center">
              <span className="mr-2">✨</span> Gemini API Key
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="AI_..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Digunakan untuk fitur AI Assistant (Otomatisasi pengeluaran dari Struk/Teks).
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
    </>
  )}

  {currentUser?.role !== "OWNER" && (
    <>
          
      <div className="pt-6 border-t border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-4">{language === "id" ? "Tugas Checklist Leader (Bar)" : "Leader Bar Tasks"}</h4>
            <div className="space-y-2 mb-3">
              {leaderBarTasks.map((task, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" value={task} onChange={(e) => updateTask(setLeaderBarTasks, i, e.target.value)} />
                  <button onClick={() => removeTask(setLeaderBarTasks, i)} className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm">Hapus</button>
                </div>
              ))}
            </div>
            <button onClick={() => addTask(setLeaderBarTasks)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium">+ Tambah Tugas Bar</button>
          </div>
          
          <div className="pt-6 border-t border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-4">{language === "id" ? "Tugas Checklist Leader (Kitchen)" : "Leader Kitchen Tasks"}</h4>
            <div className="space-y-2 mb-3">
              {leaderKitchenTasks.map((task, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" value={task} onChange={(e) => updateTask(setLeaderKitchenTasks, i, e.target.value)} />
                  <button onClick={() => removeTask(setLeaderKitchenTasks, i)} className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm">Hapus</button>
                </div>
              ))}
            </div>
            <button onClick={() => addTask(setLeaderKitchenTasks)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium">+ Tambah Tugas Kitchen</button>
          </div>
          
          <div className="pt-6 border-t border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-4">{language === "id" ? "Tugas Checklist Leader (Baker)" : "Leader Baker Tasks"}</h4>
            <div className="space-y-2 mb-3">
              {leaderBakerTasks.map((task, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" value={task} onChange={(e) => updateTask(setLeaderBakerTasks, i, e.target.value)} />
                  <button onClick={() => removeTask(setLeaderBakerTasks, i)} className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm">Hapus</button>
                </div>
              ))}
            </div>
            <button onClick={() => addTask(setLeaderBakerTasks)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium">+ Tambah Tugas Baker</button>
          </div>
          
          <div className="pt-6 border-t border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-4">{language === "id" ? "Tugas Checklist (Manager)" : "Manager Tasks"}</h4>
            <div className="space-y-2 mb-3">
              {managerTasks.map((task, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" value={task} onChange={(e) => updateTask(setManagerTasks, i, e.target.value)} />
                  <button onClick={() => removeTask(setManagerTasks, i)} className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm">Hapus</button>
                </div>
              ))}
            </div>
            <button onClick={() => addTask(setManagerTasks)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium">+ Tambah Tugas Manager</button>
          </div>
    </>
  )}
          


  {currentUser?.role !== "OWNER" && (
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
  )}
    </div>
  );
};
