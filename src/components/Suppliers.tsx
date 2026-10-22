import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Building2,
  User,
  MapPin,
  FileText,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { Supplier } from "../types";
import { CsvImportExport } from "./common/CsvImportExport";

export const Suppliers = () => {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, isReadOnly } =
    useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.picName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
    } else {
      setEditingSupplier(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const handleImportSuppliers = (data: any[]) => {
    let importedCount = 0;
    let updatedCount = 0;
    data.forEach((row) => {
      const idSistem = row["ID_SISTEM (JANGAN DIUBAH)"];
      if (row["Nama Supplier"] || row.name) {
        const supplierData = {
          name: row["Nama Supplier"] || row.name || "-",
          picName: row["Nama PIC"] || row.picName || row.pic || "-",
          contact: row["Kontak"] || row.contact || row.phone || "-",
          address: row["Alamat"] || row.address || "-",
          notes: row["Catatan"] || row.notes || "-",
        };

        if (idSistem) {
          const existing = suppliers.find((s) => s.id === idSistem);
          if (existing) {
            updateSupplier({ ...supplierData, id: idSistem });
            updatedCount++;
          }
        } else {
          addSupplier(supplierData);
          importedCount++;
        }
      }
    });
    if (importedCount > 0 || updatedCount > 0)
      alert(
        `Berhasil menambahkan ${importedCount} data baru dan memperbarui ${updatedCount} data supplier.`
      );
    else alert("Tidak ada data valid yang diimpor.");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const supplierData = {
      name: formData.get("name") as string,
      picName: formData.get("picName") as string,
      address: formData.get("address") as string,
      contact: formData.get("contact") as string,
      notes: formData.get("notes") as string,
    };

    if (editingSupplier) {
      updateSupplier({ ...supplierData, id: editingSupplier.id });
    } else {
      addSupplier(supplierData);
    }
    handleCloseModal();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ─── Header Banner ────────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-brand-50 text-brand-700 uppercase border border-brand-200/70">
              Vendor Directory
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              {suppliers.length} Mitra Terdaftar
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            Daftar Supplier & Distributor
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Data kontak vendor resmi biji kopi, susu UHT fresh, sirup rasa, kemasan cup take-away, dan bahan baku kafe.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
          {!isReadOnly && (
            <>
              <CsvImportExport
                onImport={handleImportSuppliers}
                templateHeaders={["Nama Supplier", "Nama PIC", "Kontak", "Alamat", "Catatan"]}
                templateExampleRow={["PT Kopi Nikmat", "Budi", "0812345678", "Jl Mawar 1", "Supplier Sirup"]}
                currentData={suppliers.map((s) => ({
                  id: s.id,
                  "Nama Supplier": s.name,
                  "Nama PIC": s.picName,
                  Kontak: s.contact,
                  Alamat: s.address,
                  Catatan: s.notes,
                }))}
                templateFilename="template_supplier"
                buttonLabel="Impor / Ekspor"
                templateHints={{
                  "Nama Supplier": "Wajib diisi",
                  Kontak: "No. HP / WhatsApp, contoh: 081234567890",
                }}
              />
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center justify-center px-4 py-2.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 active:scale-[0.98] transition-all shadow-xs text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1.5 shrink-0" />
                Tambah Supplier
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Search Bar ───────────────────────────────────────────────────────────── */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500/20 bg-white shadow-2xs text-base sm:text-xs font-medium outline-none"
          placeholder="Cari nama supplier, nama PIC, atau alamat..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ─── Suppliers Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-white rounded-3xl border border-slate-200/80 border-dashed">
            Belum ada supplier yang cocok. Klik "Tambah Supplier" untuk mendaftarkan vendor baru!
          </div>
        ) : (
          filteredSuppliers.map((supplier) => {
            const cleanPhone = supplier.contact ? supplier.contact.replace(/\D/g, "") : "";
            const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone}` : "";

            return (
              <div
                key={supplier.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col justify-between hover:border-brand-300 hover:shadow-md transition-all group"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 font-bold shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-brand-600 transition-colors">
                          {supplier.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>PIC: <strong className="text-slate-700">{supplier.picName || "-"}</strong></span>
                        </div>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenModal(supplier)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Supplier"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Hapus supplier "${supplier.name}"?`)) {
                              deleteSupplier(supplier.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Supplier"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Address Badge */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{supplier.address || "Alamat tidak dicantumkan"}</span>
                  </div>

                  {/* Direct WhatsApp Call */}
                  <div className="flex items-center justify-between text-xs bg-emerald-50/70 border border-emerald-200/70 p-2.5 rounded-xl mb-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-emerald-950 font-mono">
                        {supplier.contact || "-"}
                      </span>
                    </div>
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 transition-all shadow-2xs"
                      >
                        <span>Chat WA</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-2">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                    Catatan Suplai
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {supplier.notes || "Tidak ada catatan khusus."}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── MODAL: Add / Edit Supplier ───────────────────────────────────────────── */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[85vh] sm:max-h-[88vh] my-auto border border-slate-200/80 flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-100 p-4 sm:p-5 bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingSupplier ? "Edit Data Supplier" : "Tambah Supplier Baru"}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Perusahaan / Supplier / Toko <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    name="name"
                    defaultValue={editingSupplier?.name}
                    placeholder="Contoh: PT Sukses Kopi Nusantara"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-brand-500/20 bg-slate-50 focus:bg-white outline-none text-base sm:text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama PIC / Sales
                    </label>
                    <input
                      required
                      type="text"
                      name="picName"
                      defaultValue={editingSupplier?.picName}
                      placeholder="Contoh: Budi Santoso"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-brand-500/20 bg-slate-50 focus:bg-white outline-none text-base sm:text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Alamat / Wilayah Gudang
                    </label>
                    <input
                      required
                      type="text"
                      name="address"
                      defaultValue={editingSupplier?.address}
                      placeholder="Contoh: Jakarta Barat"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-brand-500/20 bg-slate-50 focus:bg-white outline-none text-base sm:text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nomor Kontak / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    name="contact"
                    defaultValue={editingSupplier?.contact}
                    placeholder="Contoh: 081234567890"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-brand-500/20 bg-slate-50 focus:bg-white outline-none text-base sm:text-xs font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Catatan Pasokan / Term of Payment (TOP)
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    defaultValue={editingSupplier?.notes}
                    placeholder="Contoh: Supplier Fresh Milk Greenfields, TOP Tempo 14 hari, minimum order 2 krat."
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-brand-500/20 bg-slate-50 focus:bg-white outline-none text-base sm:text-xs resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 active:scale-95 font-bold text-xs transition-all shadow-xs cursor-pointer"
                >
                  {editingSupplier ? "Simpan Perubahan" : "Tambah Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}
    </div>
  );
};
