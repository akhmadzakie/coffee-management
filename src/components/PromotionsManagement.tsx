import React, { useState, useMemo } from "react";
import {
  Tag,
  Plus,
  Percent,
  DollarSign,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { Promotion, PromotionType } from "../types";

export const PromotionsManagement: React.FC = () => {
  const {
    promotions,
    addPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotionStatus,
    currentUser,
    isReadOnly,
  } = useStore();

  const isOwner = currentUser?.role === "OWNER" || isReadOnly;
  const canManage =
    !isOwner &&
    (currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "MANAGER");

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const getPromoStatus = (
    promo: Promotion
  ): "ACTIVE" | "UPCOMING" | "EXPIRED" | "INACTIVE" => {
    if (!promo.isActive) return "INACTIVE";
    if (promo.endDate && promo.endDate.slice(0, 10) < todayStr) return "EXPIRED";
    if (promo.startDate && promo.startDate.slice(0, 10) > todayStr)
      return "UPCOMING";
    return "ACTIVE";
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "PERCENT" | "NOMINAL">(
    "ALL"
  );
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "ACTIVE" | "UPCOMING" | "EXPIRED" | "INACTIVE"
  >("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "PERCENT" as PromotionType,
    value: 10,
    minSpend: 0,
    maxDiscount: 0,
    isActive: true,
    description: "",
    startDate: "",
    endDate: "",
  });

  const [formError, setFormError] = useState("");

  // Filtered promotions
  const filteredPromos = useMemo(() => {
    return (promotions || []).filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.description &&
          p.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchType = filterType === "ALL" || p.type === filterType;
      const status = getPromoStatus(p);
      const matchStatus =
        filterStatus === "ALL" ||
        (filterStatus === "ACTIVE" && status === "ACTIVE") ||
        (filterStatus === "UPCOMING" && status === "UPCOMING") ||
        (filterStatus === "EXPIRED" && status === "EXPIRED") ||
        (filterStatus === "INACTIVE" && status === "INACTIVE");

      return matchSearch && matchType && matchStatus;
    });
  }, [promotions, searchTerm, filterType, filterStatus, todayStr]);

  // KPIs
  const totalCount = promotions.length;
  const activeCount = promotions.filter(
    (p) => getPromoStatus(p) === "ACTIVE"
  ).length;
  const percentCount = promotions.filter((p) => p.type === "PERCENT").length;
  const nominalCount = promotions.filter((p) => p.type === "NOMINAL").length;
  const expiredCount = promotions.filter(
    (p) => getPromoStatus(p) === "EXPIRED"
  ).length;

  const handleOpenAddModal = () => {
    setEditingPromo(null);
    setFormData({
      name: "",
      code: "",
      type: "PERCENT",
      value: 10,
      minSpend: 0,
      maxDiscount: 0,
      isActive: true,
      description: "",
      startDate: "",
      endDate: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormData({
      name: promo.name,
      code: promo.code || "",
      type: promo.type,
      value: promo.value,
      minSpend: promo.minSpend || 0,
      maxDiscount: promo.maxDiscount || 0,
      isActive: promo.isActive,
      description: promo.description || "",
      startDate: promo.startDate ? promo.startDate.slice(0, 10) : "",
      endDate: promo.endDate ? promo.endDate.slice(0, 10) : "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSavePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Nama promo wajib diisi.");
      return;
    }
    if (formData.value <= 0) {
      setFormError("Besaran diskon harus lebih besar dari 0.");
      return;
    }
    if (formData.type === "PERCENT" && formData.value > 100) {
      setFormError("Diskon persen tidak boleh melebihi 100%.");
      return;
    }

    const payload: Promotion = {
      id: editingPromo ? editingPromo.id : `promo_${Date.now()}`,
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase() || undefined,
      type: formData.type,
      value: Number(formData.value),
      minSpend: Number(formData.minSpend) || 0,
      maxDiscount: formData.type === "PERCENT" ? Number(formData.maxDiscount) || undefined : undefined,
      isActive: formData.isActive,
      description: formData.description.trim() || undefined,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      createdAt: editingPromo ? editingPromo.createdAt : new Date().toISOString(),
      createdBy: editingPromo ? editingPromo.createdBy : currentUser?.name || currentUser?.username,
    };

    if (editingPromo) {
      updatePromotion(payload);
    } else {
      addPromotion(payload);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    deletePromotion(id);
    setDeleteConfirmId(null);
  };

  // Preview helper for simulation box
  const previewSimulation = useMemo(() => {
    const sampleSpend = 100000;
    if (formData.minSpend > 0 && sampleSpend < formData.minSpend) {
      return {
        applied: false,
        reason: `Subtotal Rp ${sampleSpend.toLocaleString("id-ID")} kurang dari min. belanja Rp ${formData.minSpend.toLocaleString("id-ID")}`,
        discount: 0,
        finalTotal: sampleSpend,
      };
    }

    let calculatedDiscount = 0;
    if (formData.type === "PERCENT") {
      calculatedDiscount = (sampleSpend * (formData.value || 0)) / 100;
      if (formData.maxDiscount > 0 && calculatedDiscount > formData.maxDiscount) {
        calculatedDiscount = formData.maxDiscount;
      }
    } else {
      calculatedDiscount = formData.value || 0;
    }

    return {
      applied: true,
      reason: null,
      discount: calculatedDiscount,
      finalTotal: Math.max(0, sampleSpend - calculatedDiscount),
    };
  }, [formData]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-brand-600 to-amber-600 text-white rounded-xl shadow-md">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Promo & Diskon POS
              </h1>
              <p className="text-sm text-slate-500">
                Kelola whitelist diskon yang diizinkan untuk kasir. Mencegah manipulasi diskon manual di kasir.
              </p>
            </div>
          </div>
        </div>

        {canManage ? (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Promo Baru</span>
          </button>
        ) : isOwner ? (
          <div className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Mode Pemantauan Owner (Read-Only)</span>
          </div>
        ) : null}
      </div>

      {/* ── Owner Read-Only Guard Banner ── */}
      {isOwner && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start justify-between gap-3.5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="text-sm">
              <span className="font-bold text-amber-900">
                Mode Pemantauan Owner (Read-Only):
              </span>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                Sesuai aturan bisnis kafe, akun Owner berstatus read-only. Anda dapat meninjau katalog promo, syarat belanja, dan efektivitas diskon kasir, namun wewenang penambahan, perubahan, dan aktivasi promo dikelola oleh Manager dan Super Admin.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-amber-200 text-amber-800 shrink-0">
            Read-Only Guard
          </span>
        </div>
      )}

      {/* ── Policy Banner ── */}
      <div className="bg-brand-50/60 border border-brand-200/80 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs">
        <div className="p-2 bg-brand-100 text-brand-800 rounded-lg shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="text-sm">
          <span className="font-bold text-brand-950">Kebijakan Otorisasi POS Julia's Coffee (Aturan #12):</span>
          <p className="text-brand-800 mt-0.5 leading-relaxed">
            Kasir hanya dapat memilih promo yang statusnya <strong>Aktif Berlaku</strong> pada tabel di bawah. 
            Kasir <strong>tidak dapat</strong> menginput diskon manual secara bebas. Setiap diskon manual di luar daftar ini wajib mendapat persetujuan PIN Manajer.
          </p>
        </div>
      </div>

      {/* ── KPI Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Promo</span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-800">{totalCount}</div>
          <p className="text-xs text-slate-400 mt-1">Semua promo terdaftar</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Aktif di Kasir</span>
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-800 flex items-center gap-2">
            {activeCount}
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-xs text-emerald-600 mt-1">Tampil di tablet kasir</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Promo Persen</span>
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-800">{percentCount}</div>
          <p className="text-xs text-purple-600 mt-1">Diskon berbasis %</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Potongan Flat</span>
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-800">{nominalCount}</div>
          <p className="text-xs text-blue-600 mt-1">Potongan flat Rp</p>
        </div>

        <div className={`p-4 rounded-2xl border shadow-xs ${
          expiredCount > 0
            ? "bg-rose-50/60 border-rose-200 text-rose-900"
            : "bg-white border-slate-200/80 text-slate-700"
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              expiredCount > 0 ? "text-rose-700" : "text-slate-500"
            }`}>Kedaluwarsa</span>
            <div className={`p-2 rounded-lg ${
              expiredCount > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
            }`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-bold ${expiredCount > 0 ? "text-rose-800" : "text-slate-800"}`}>
            {expiredCount}
          </div>
          <p className={`text-xs mt-1 ${expiredCount > 0 ? "text-rose-600 font-medium" : "text-slate-400"}`}>
            {expiredCount > 0 ? "Nonaktif otomatis di POS" : "Semua masa berlaku aman"}
          </p>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama atau kode promo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl text-sm focus:outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filter Type */}
          <select
            value={filterType}
            onChange={(e: any) => setFilterType(e.target.value)}
            aria-label="Filter Tipe Promo"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">Semua Tipe Diskon</option>
            <option value="PERCENT">Persentase (%)</option>
            <option value="NOMINAL">Potongan Flat (Rp)</option>
          </select>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e: any) => setFilterStatus(e.target.value)}
            aria-label="Filter Status Promo"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif Berlaku di Kasir</option>
            <option value="UPCOMING">Akan Datang (Terjadwal)</option>
            <option value="EXPIRED">Kedaluwarsa</option>
            <option value="INACTIVE">Nonaktif Manual</option>
          </select>
        </div>
      </div>

      {/* ── Promotions Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nama & Kode</th>
                <th className="py-3.5 px-4">Tipe & Nilai Diskon</th>
                <th className="py-3.5 px-4">Syarat Belanja</th>
                <th className="py-3.5 px-4">Masa Berlaku</th>
                <th className="py-3.5 px-4 text-center">Status di Kasir</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredPromos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Tag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">Tidak ada promo ditemukan</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchTerm || filterType !== "ALL" || filterStatus !== "ALL"
                        ? "Coba sesuaikan kata kunci pencarian atau filter Anda."
                        : "Klik 'Tambah Promo Baru' untuk membuat whitelist diskon pertama Anda."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPromos.map((promo) => {
                  const status = getPromoStatus(promo);
                  return (
                    <tr key={promo.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                              promo.type === "PERCENT"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {promo.type === "PERCENT" ? (
                              <Percent className="w-4 h-4" />
                            ) : (
                              <DollarSign className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{promo.name}</span>
                              {promo.code && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[11px] font-bold rounded-md border border-slate-200">
                                  {promo.code}
                                </span>
                              )}
                            </div>
                            {promo.description && (
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{promo.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Value & Type */}
                      <td className="py-3.5 px-4">
                        {promo.type === "PERCENT" ? (
                          <div>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              {promo.value}% OFF
                            </span>
                            {promo.maxDiscount && promo.maxDiscount > 0 ? (
                              <p className="text-[11px] text-slate-500 mt-1">
                                Maks. Rp {promo.maxDiscount.toLocaleString("id-ID")}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400 mt-1">Tanpa batas maks</p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              -Rp {promo.value.toLocaleString("id-ID")}
                            </span>
                            <p className="text-[11px] text-slate-400 mt-1">Potongan tetap</p>
                          </div>
                        )}
                      </td>

                      {/* Min Spend */}
                      <td className="py-3.5 px-4">
                        {promo.minSpend && promo.minSpend > 0 ? (
                          <div className="text-xs">
                            <span className="text-slate-500">Min. Belanja:</span>
                            <div className="font-semibold text-slate-800">
                              Rp {promo.minSpend.toLocaleString("id-ID")}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-block text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                            Tanpa Minimum
                          </span>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {promo.startDate || promo.endDate ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {promo.startDate ? promo.startDate.slice(0, 10) : "Mulai"} s/d{" "}
                                {promo.endDate ? promo.endDate.slice(0, 10) : "Seterusnya"}
                              </span>
                            </div>
                            {status === "EXPIRED" && (
                              <span className="inline-block text-[10px] text-rose-600 font-semibold">
                                Lewat masa berlaku
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Selalu Berlaku</span>
                        )}
                      </td>

                      {/* Whitelist Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (status === "EXPIRED") {
                                handleOpenEditModal(promo);
                              } else {
                                togglePromotionStatus(promo.id);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                              status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                : status === "EXPIRED"
                                ? "bg-rose-100 text-rose-800 hover:bg-rose-200"
                                : status === "UPCOMING"
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                            title={
                              status === "ACTIVE"
                                ? "Klik untuk nonaktifkan dari kasir"
                                : status === "EXPIRED"
                                ? "Masa berlaku telah lewat. Klik untuk perbarui tanggal berakhir."
                                : status === "UPCOMING"
                                ? "Promo akan otomatis aktif sesuai tanggal mulai."
                                : "Klik untuk aktifkan ke kasir"
                            }
                          >
                            {status === "ACTIVE" ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Aktif di POS</span>
                              </>
                            ) : status === "EXPIRED" ? (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Kedaluwarsa</span>
                              </>
                            ) : status === "UPCOMING" ? (
                              <>
                                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                <span>Akan Datang</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                <span>Nonaktif</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                              status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : status === "EXPIRED"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : status === "UPCOMING"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            {status === "ACTIVE" ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Aktif di POS</span>
                              </>
                            ) : status === "EXPIRED" ? (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Kedaluwarsa</span>
                              </>
                            ) : status === "UPCOMING" ? (
                              <>
                                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                <span>Akan Datang</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                <span>Nonaktif</span>
                              </>
                            )}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {canManage ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(promo)}
                              className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Promo"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(promo.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Promo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic font-medium">Read-Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Tambah/Edit Promo ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand-100 text-brand-700 rounded-lg">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">
                  {editingPromo ? "Edit Promo Whitelist" : "Tambah Promo Whitelist Baru"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePromo} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name & Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Promo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Diskon Karyawan 20%"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Promo (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: STAFF20"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Type & Value */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipe Diskon
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: "PERCENT" })}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                        formData.type === "PERCENT"
                          ? "bg-purple-50 border-purple-300 text-purple-700 font-bold"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Percent className="w-4 h-4" />
                      <span>Persen (%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: "NOMINAL" })}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                        formData.type === "NOMINAL"
                          ? "bg-blue-50 border-blue-300 text-blue-700 font-bold"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Nominal (Rp)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Besaran Diskon <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      max={formData.type === "PERCENT" ? 100 : undefined}
                      value={formData.value || ""}
                      onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                      className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-brand-500"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {formData.type === "PERCENT" ? "%" : "IDR"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Min Spend & Max Discount */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimal Belanja (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    placeholder="0 = Tanpa syarat belanja"
                    value={formData.minSpend || ""}
                    onChange={(e) => setFormData({ ...formData, minSpend: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Kosongkan jika tanpa minimum transaksi</p>
                </div>

                {formData.type === "PERCENT" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Maksimal Diskon (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      placeholder="0 = Tanpa batas maksimal"
                      value={formData.maxDiscount || ""}
                      onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Batas maksimal nominal potongan</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan / Catatan Syarat
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Khusus staf internal Julia's Coffee / Promo hari Jumat"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-slate-800">Status Aktif di Kasir</div>
                  <p className="text-xs text-slate-500">
                    Jika aktif, kasir dapat memilih promo ini langsung di tablet POS.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    formData.isActive ? "bg-emerald-600 justify-end" : "bg-slate-300 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                </button>
              </div>

              {/* Live Preview / Simulation Box */}
              <div className="p-4 bg-gradient-to-br from-brand-50 to-amber-50/50 border border-brand-200/60 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-900 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Simulasi Kalkulasi Kasir (Contoh Order Rp 100.000):</span>
                </div>
                {previewSimulation.applied ? (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal Belanja:</span>
                      <span>Rp 100.000</span>
                    </div>
                    <div className="flex justify-between font-semibold text-rose-600">
                      <span>Diskon ({formData.name || "Promo"}):</span>
                      <span>-Rp {previewSimulation.discount.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="pt-1 border-t border-brand-200 flex justify-between font-bold text-slate-900">
                      <span>Total Akhir Bayar:</span>
                      <span className="text-emerald-700">Rp {previewSimulation.finalTotal.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-800 italic">
                    ⚠️ {previewSimulation.reason}
                  </p>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
                >
                  {editingPromo ? "Simpan Perubahan" : "Tambahkan ke Whitelist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Hapus Promo Ini?</h4>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Promo ini tidak akan tersedia lagi untuk dipilih di kasir POS. Riwayat pesanan sebelumnya tidak akan terhapus.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
