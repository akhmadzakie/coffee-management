import React, { useRef, useState } from "react";
import { useStore } from "../store/StoreContext";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
} from "lucide-react";
import { Supplier } from "../types";


export const Suppliers = () => {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, isReadOnly } =
    useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.picName.toLowerCase().includes(searchTerm.toLowerCase()),
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
    data.forEach((row) => {
      if (row["Nama Supplier"] || row.name) {
        const supplierData = {
          name: row["Nama Supplier"] || row.name || "-",
          picName: row["Nama PIC"] || row.picName || row.pic || "-",
          contact: row["Kontak"] || row.contact || row.phone || "-",
          address: row["Alamat"] || row.address || "-",
          notes: row["Catatan"] || row.notes || "-",
        };
        addSupplier(supplierData);
        importedCount++;
      }
    });
    if (importedCount > 0) alert(`Berhasil mengimpor ${importedCount} supplier!`);
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
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm text-sm"
            placeholder="Search suppliers by name or PIC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {!isReadOnly && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">

            <button
              onClick={() => handleOpenModal()}
              className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm text-sm font-medium w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-10 text-center text-slate-500 text-sm bg-white rounded-xl border border-slate-200 border-dashed">
            No suppliers found. Add your first supplier!
          </div>
        ) : (
          filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col hover:border-blue-200 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {supplier.name}
                  </h3>
                  <p className="text-sm text-blue-600 font-medium mt-1">
                    {supplier.address} • {supplier.picName}
                  </p>
                </div>
                <div className="flex space-x-1">
                  {!isReadOnly && (
                    <>
                      <button
                        onClick={() => handleOpenModal(supplier)}
                        className="text-slate-400 hover:text-blue-600 p-1 transition-colors"
                        title="Edit Supplier"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteSupplier(supplier.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="Delete Supplier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center text-sm text-slate-600 mb-4 bg-slate-50 p-2 rounded-lg">
                <Phone className="h-4 w-4 mr-2 text-slate-400" />
                <a
                  href={`https://wa.me/${supplier.contact.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-blue-600 font-medium"
                >
                  {supplier.contact}
                </a>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                  Notes
                </p>
                <p className="text-sm text-slate-700 line-clamp-2">
                  {supplier.notes || "-"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Supplier Name
                  </label>
                  <input
                    required
                    type="text"
                    name="name"
                    defaultValue={editingSupplier?.name}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      PIC Name
                    </label>
                    <input
                      required
                      type="text"
                      name="picName"
                      defaultValue={editingSupplier?.picName}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Address/Area
                    </label>
                    <input
                      required
                      type="text"
                      name="address"
                      defaultValue={editingSupplier?.address}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact (WhatsApp)
                  </label>
                  <input
                    required
                    type="text"
                    name="contact"
                    defaultValue={editingSupplier?.contact}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    defaultValue={editingSupplier?.notes}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
                >
                  {editingSupplier ? "Save Changes" : "Add Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
