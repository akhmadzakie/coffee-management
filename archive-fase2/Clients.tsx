import React, { useRef, useState } from "react";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  History,
  FileText,
  Upload,
  Download,
} from "lucide-react";
import { Client } from "../types";
import Papa from "papaparse";

export const Clients = () => {
  const {
    clients,
    invoices,
    products,
    addClient,
    updateClient,
    deleteClient,
    pricingTiers,
    addPricingTier,
    updatePricingTier,
    deletePricingTier,
  } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"clients" | "tiers">("clients");
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryClient, setSelectedHistoryClient] =
    useState<Client | null>(null);

  const filteredClients = clients.filter(
    (c) =>
      c.coffeeShop.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.picName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
    } else {
      setEditingClient(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const handleDownloadTemplate = () => {
    let csvContent = "";

    if (clients && clients.length > 0) {
      const dataToExport = clients.map((c) => ({
        "Nama Usaha": c.coffeeShop,
        "Nama PIC": c.picName,
        Kontak: c.contact,
        Email: c.email || "",
        Alamat: c.address || "",
        "Role/Jenis Usaha": c.role || "",
      }));
      csvContent = Papa.unparse(dataToExport);
    } else {
      csvContent =
        "Nama Usaha,Nama PIC,Kontak,Email,Alamat,Role/Jenis Usaha\nKedai Kopi Senja,Budi Santoso,08123456789,budi@senja.com,Jl. Merdeka No.1,Coffee Shop";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      clients && clients.length > 0
        ? "data_pelanggan.csv"
        : "template_import_pelanggan.csv",
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        let importedCount = 0;

        data.forEach((row) => {
          if (row["Nama Usaha"] || row.coffeeShop || row.name) {
            const clientData = {
              coffeeShop:
                row["Nama Usaha"] || row.coffeeShop || row.name || "-",
              picName: row["Nama PIC"] || row.picName || row.pic || "-",
              contact: row["Kontak"] || row.contact || row.phone || "-",
              email: row["Email"] || row.email || "-",
              address: row["Alamat"] || row.address || "-",
              role: row["Role/Jenis Usaha"] || row.role || "Regular",
              tier: "REGULAR",
            };
            addClient(clientData);
            importedCount++;
          }
        });

        alert(`Berhasil mengimpor ${importedCount} pelanggan!`);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        alert(`Gagal mengimpor CSV: ${error.message}`);
      },
    });
  };

  const handleOpenHistory = (client: Client) => {
    setSelectedHistoryClient(client);
    setIsHistoryModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const clientData = {
      coffeeShop: formData.get("coffeeShop") as string,
      picName: formData.get("picName") as string,
      role: formData.get("role") as string,
      contact: formData.get("contact") as string,
      notes: formData.get("notes") as string,
      tier: formData.get("tier") as string,
    };

    if (editingClient) {
      updateClient({ ...clientData, id: editingClient.id });
    } else {
      addClient(clientData);
    }
    handleCloseModal();
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex border-b border-slate-200 mb-2">
        <button
          onClick={() => setActiveTab("clients")}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === "clients" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          Clients List
        </button>
        <button
          onClick={() => setActiveTab("tiers")}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === "tiers" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
        >
          Pricing Tiers
        </button>
      </div>

      {activeTab === "clients" && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm text-sm"
                placeholder="Search clients by shop or PIC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImportCSV}
              />
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium justify-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Export / Template CSV
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium justify-center"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm text-sm font-medium w-full sm:w-auto justify-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-500 text-sm bg-white rounded-xl border border-slate-200 border-dashed">
                No clients found. Add your first coffee shop client!
              </div>
            ) : (
              filteredClients.map((client) => {
                const clientInv = invoices.filter(
                  (i) => i.clientId === client.id,
                );
                const orderCount = clientInv.length;

                return (
                  <div
                    key={client.id}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col hover:border-blue-200 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900 leading-tight">
                            {client.coffeeShop}
                          </h3>
                          {client.tier && client.tier !== "REGULAR" && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                              {pricingTiers?.find((t) => t.id === client.tier)
                                ?.name || client.tier}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-blue-600 font-medium mt-1">
                          {client.role} • {client.picName}
                        </p>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleOpenHistory(client)}
                          className="text-slate-400 hover:text-blue-600 p-1 transition-colors"
                          title="View History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(client)}
                          className="text-slate-400 hover:text-blue-600 p-1 transition-colors"
                          title="Edit Client"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteClient(client.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                          title="Delete Client"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center text-sm text-slate-600 mb-4 bg-slate-50 p-2 rounded-lg">
                      <Phone className="h-4 w-4 mr-2 text-slate-400" />
                      <a
                        href={`https://wa.me/${client.contact.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-blue-600 font-medium"
                      >
                        {client.contact}
                      </a>
                    </div>

                    <div className="flex justify-between items-center mb-4 px-3 py-2 bg-blue-50 text-blue-800 rounded-lg text-xs font-medium border border-blue-100">
                      <span>Total Orders:</span>
                      <span className="font-bold">{orderCount}x</span>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                        Notes
                      </p>
                      <p className="text-sm text-slate-700 line-clamp-2">
                        {client.notes || "-"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {activeTab === "tiers" && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Pricing Tiers
              </h2>
              <p className="text-sm text-slate-500">
                Manage client categories and special pricing rules.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingTier(null);
                setIsTierModalOpen(true);
              }}
              className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm text-sm font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Tier
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Tier Name</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Discount / Rule</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    REGULAR
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    Default pricing (no special prices)
                  </td>
                  <td className="px-6 py-4 text-slate-500">-</td>
                  <td className="px-6 py-4 text-right">-</td>
                </tr>
                {pricingTiers?.map((tier) => (
                  <tr
                    key={tier.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {tier.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {tier.description}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {tier.discountType === "PERCENTAGE" ||
                      tier.discountPercentage
                        ? `Diskon ${tier.discountValue || tier.discountPercentage}% (dari ${tier.basePrice === "NORMAL_PRICE" ? "Harga Normal" : "Harga Jual"})`
                        : tier.discountType === "NOMINAL"
                          ? `Diskon Rp ${(tier.discountValue || 0).toLocaleString()} (dari ${tier.basePrice === "NORMAL_PRICE" ? "Harga Normal" : "Harga Jual"})`
                          : "Harga Kustom (Per Item)"}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingTier(tier);
                          setIsTierModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deletePricingTier(tier.id)}
                        className="text-rose-600 hover:text-rose-800 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tier Modal */}
      {isTierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingTier ? "Edit Pricing Tier" : "Add Pricing Tier"}
              </h3>
              <button
                onClick={() => setIsTierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  name: formData.get("name") as string,
                  description: formData.get("description") as string,
                  discountType:
                    (formData.get("discountType") as
                      "PERCENTAGE" | "NOMINAL" | "NONE") || "NONE",
                  discountValue: formData.get("discountValue")
                    ? Number(formData.get("discountValue"))
                    : undefined,
                  basePrice:
                    (formData.get("basePrice") as
                      "SELLING_PRICE" | "NORMAL_PRICE") || "SELLING_PRICE",
                };

                // Backwards compatibility for existing logic
                const finalData = {
                  ...data,
                  discountPercentage:
                    data.discountType === "PERCENTAGE"
                      ? data.discountValue
                      : undefined,
                  discountType:
                    data.discountType === "NONE"
                      ? undefined
                      : data.discountType,
                } as any;

                if (editingTier) updatePricingTier(editingTier.id, finalData);
                else addPricingTier(finalData);
                setIsTierModalOpen(false);
              }}
              className="p-6"
            >
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tier Name (e.g., VIP, Gold, B2B)
                  </label>
                  <input
                    required
                    type="text"
                    name="name"
                    defaultValue={editingTier?.name}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <input
                    required
                    type="text"
                    name="description"
                    defaultValue={editingTier?.description}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">
                    Aturan Harga & Diskon Global (Opsional)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Harga Dasar (Base Price)
                      </label>
                      <select
                        name="basePrice"
                        defaultValue={editingTier?.basePrice || "SELLING_PRICE"}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      >
                        <option value="SELLING_PRICE">
                          Harga Jual (Selling Price)
                        </option>
                        <option value="NORMAL_PRICE">
                          Harga Normal (Normal Price)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Tipe Diskon
                      </label>
                      <select
                        name="discountType"
                        defaultValue={
                          editingTier?.discountType ||
                          (editingTier?.discountPercentage
                            ? "PERCENTAGE"
                            : "NONE")
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      >
                        <option value="NONE">
                          Tanpa Diskon (Harga Khusus Item)
                        </option>
                        <option value="PERCENTAGE">Persentase (%)</option>
                        <option value="NOMINAL">Nominal Tetap (Rp)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Nilai Diskon
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        name="discountValue"
                        defaultValue={
                          editingTier?.discountValue ||
                          editingTier?.discountPercentage
                        }
                        placeholder="0"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Jika disetel, diskon ini otomatis memotong Harga Dasar untuk
                    semua barang khusus tier ini.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTierModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
                >
                  Save Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingClient ? "Edit Client" : "Add New Client"}
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
                    Coffee Shop Name
                  </label>
                  <input
                    required
                    type="text"
                    name="coffeeShop"
                    defaultValue={editingClient?.coffeeShop}
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
                      defaultValue={editingClient?.picName}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Role
                    </label>
                    <select
                      required
                      name="role"
                      defaultValue={editingClient?.role || "Manager"}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    >
                      <option value="Manager">Manager</option>
                      <option value="Purchasing">Purchasing</option>
                      <option value="Owner">Owner</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Pricing Tier
                    </label>
                    <select
                      name="tier"
                      defaultValue={editingClient?.tier || "REGULAR"}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    >
                      <option value="REGULAR">REGULAR (Default)</option>
                      {pricingTiers?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
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
                    defaultValue={editingClient?.contact}
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
                    defaultValue={editingClient?.notes}
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
                  {editingClient ? "Save Changes" : "Add Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedHistoryClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedHistoryClient.coffeeShop} - Order History
                </h3>
                <p className="text-sm text-slate-500">
                  {selectedHistoryClient.picName} (
                  {selectedHistoryClient.contact})
                </p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-white flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <p className="text-sm font-medium text-blue-800 mb-1">
                    Total Spent
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrency(
                      invoices
                        .filter((i) => i.clientId === selectedHistoryClient.id)
                        .reduce((sum, inv) => sum + inv.totalAmount, 0),
                    )}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <p className="text-sm font-medium text-blue-800 mb-1">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    {
                      invoices.filter(
                        (i) => i.clientId === selectedHistoryClient.id,
                      ).length
                    }{" "}
                    Invoices
                  </p>
                </div>
              </div>

              <h4 className="font-semibold text-slate-800 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-slate-500" /> Past
                Transactions
              </h4>

              {invoices.filter((i) => i.clientId === selectedHistoryClient.id)
                .length > 0 ? (
                <div className="space-y-4">
                  {invoices
                    .filter((i) => i.clientId === selectedHistoryClient.id)
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime(),
                    )
                    .map((invoice) => (
                      <div
                        key={invoice.id}
                        className="border border-slate-200 rounded-lg overflow-hidden"
                      >
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-slate-800">
                              {invoice.invoiceNumber}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(invoice.date).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600">
                              {formatCurrency(invoice.totalAmount)}
                            </p>
                            <span
                              className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${invoice.status === "PAID" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}`}
                            >
                              {invoice.status}
                            </span>
                          </div>
                        </div>
                        <div className="p-4 bg-white overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-slate-500 border-b border-slate-100">
                                <th className="pb-2 font-medium">Item</th>
                                <th className="pb-2 font-medium text-right">
                                  Qty
                                </th>
                                <th className="pb-2 font-medium text-right">
                                  Price
                                </th>
                                <th className="pb-2 font-medium text-right">
                                  Subtotal
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {invoice.items.map((item, idx) => {
                                const product = products.find(
                                  (p) => p.id === item.productId,
                                );
                                return (
                                  <tr key={idx}>
                                    <td className="py-2 text-slate-700">
                                      {product?.name || "Unknown Product"}
                                    </td>
                                    <td className="py-2 text-slate-700 text-right">
                                      {item.quantity}
                                    </td>
                                    <td className="py-2 text-slate-700 text-right">
                                      {formatCurrency(item.unitPrice)}
                                    </td>
                                    <td className="py-2 text-slate-900 font-medium text-right">
                                      {formatCurrency(item.subtotal)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                  <p className="text-slate-500 text-sm">
                    No transaction history yet for this client.
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end rounded-b-xl">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
