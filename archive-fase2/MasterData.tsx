import React, { useRef, useState } from "react";
import { useStore } from "../store/StoreContext";
import { Plus, Search, Edit2, Trash2, Upload, Download } from "lucide-react";
import { Product } from "../types";
import Papa from "papaparse";

export const MasterData = () => {
  const { products, addProduct, updateProduct, deleteProduct, pricingTiers } =
    useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.itemId.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
    } else {
      setEditingProduct(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleDownloadTemplate = () => {
    let csvContent = "";

    if (products && products.length > 0) {
      const dataToExport = products.map((p) => ({
        "ID Item": p.itemId,
        Name: p.name,
        "Full Item Name": p.itemName,
        Brand: p.brand,
        Category: p.category,
        "Cost Price": p.costPrice,
        "Normal Price": p.normalPrice || 0,
        "Operational Cost": p.operationalCost,
        "Selling Price": p.sellingPrice,
        "Min Qty Grosir": p.wholesaleMinQty || "",
        "Harga Grosir": p.wholesalePrice || "",
      }));
      csvContent = Papa.unparse(dataToExport);
    } else {
      csvContent =
        "ID Item,Name,Full Item Name,Brand,Category,Cost Price,Normal Price,Operational Cost,Selling Price,Min Qty Grosir,Harga Grosir\nPRD-001,Espresso Blend,Espresso House Blend 1kg,Otten,Kopi,100000,160000,5000,150000,6,120000";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      products && products.length > 0
        ? "data_produk.csv"
        : "template_import_produk.csv",
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
          // Required basic fields validation mapping
          if (row["ID Item"] || row.itemId) {
            const productData = {
              brand: row["Brand"] || row.brand || "-",
              category: row["Category"] || row.category || "Other",
              itemId: row["ID Item"] || row.itemId,
              name: row["Name"] || row.name || "-",
              itemName: row["Full Item Name"] || row.itemName || "-",
              costPrice: Number(row["Cost Price"] || row.costPrice || 0),
              normalPrice: Number(row["Normal Price"] || row.normalPrice || 0),
              operationalCost: Number(
                row["Operational Cost"] || row.operationalCost || 0,
              ),
              sellingPrice: Number(
                row["Selling Price"] || row.sellingPrice || 0,
              ),
              wholesaleMinQty:
                row["Min Qty Grosir"] || row.wholesaleMinQty
                  ? Number(row["Min Qty Grosir"] || row.wholesaleMinQty)
                  : undefined,
              wholesalePrice:
                row["Harga Grosir"] || row.wholesalePrice
                  ? Number(row["Harga Grosir"] || row.wholesalePrice)
                  : undefined,
              tierPrices: {}, // Can be extended if needed
            };
            addProduct(productData);
            importedCount++;
          }
        });

        alert(`Berhasil mengimpor ${importedCount} produk!`);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        alert(`Gagal mengimpor CSV: ${error.message}`);
      },
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tierPrices: Record<string, number> = {};
    pricingTiers?.forEach((t) => {
      const val = formData.get(`tierPrice_${t.id}`);
      if (val) tierPrices[t.id] = Number(val);
    });

    const productData = {
      brand: formData.get("brand") as string,
      category: formData.get("category") as string,
      itemId: formData.get("itemId") as string,
      name: formData.get("name") as string,
      itemName: formData.get("itemName") as string,
      costPrice: Number(formData.get("costPrice")),
      normalPrice: Number(formData.get("normalPrice")),
      operationalCost: Number(formData.get("operationalCost")),
      sellingPrice: Number(formData.get("sellingPrice")),
      wholesaleMinQty: formData.get("wholesaleMinQty")
        ? Number(formData.get("wholesaleMinQty"))
        : undefined,
      wholesalePrice: formData.get("wholesalePrice")
        ? Number(formData.get("wholesalePrice"))
        : undefined,
      tierPrices,
    };

    if (editingProduct) {
      updateProduct({ ...productData, id: editingProduct.id, profit: 0 }); // profit auto-calculated in store
    } else {
      addProduct(productData);
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
            placeholder="Search products by name or ID..."
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
            className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm text-sm font-medium justify-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  ID Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Product Info
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Harga Modal
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Operasional
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Harga Jual
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Keuntungan
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-10 text-center text-slate-500 text-sm"
                  >
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product, index) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {product.itemId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {product.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {product.brand} • {product.category}
                      </div>
                      {product.wholesaleMinQty && product.wholesalePrice && (
                        <div className="text-[10px] text-blue-600 font-medium mt-1 bg-blue-50 inline-block px-2 py-0.5 rounded-full border border-blue-100">
                          Grosir: Rp {product.wholesalePrice.toLocaleString()}{" "}
                          (Min. {product.wholesaleMinQty})
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-600">
                      Rp {product.costPrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-rose-600">
                      Rp {product.operationalCost.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-slate-900">
                      Rp {product.sellingPrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600">
                      Rp {product.profit.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleOpenModal(product)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteProduct(product.id)}
                          className="text-rose-600 hover:text-rose-900 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Brand
                  </label>
                  <input
                    required
                    type="text"
                    name="brand"
                    defaultValue={editingProduct?.brand}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category (Jenis)
                  </label>
                  <select
                    required
                    name="category"
                    defaultValue={editingProduct?.category || "Powder"}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  >
                    <option value="Powder">Powder</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ID Item
                  </label>
                  <input
                    required
                    type="text"
                    name="itemId"
                    defaultValue={editingProduct?.itemId}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name (Short)
                  </label>
                  <input
                    required
                    type="text"
                    name="name"
                    defaultValue={editingProduct?.name}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full Item Name
                  </label>
                  <input
                    required
                    type="text"
                    name="itemName"
                    defaultValue={editingProduct?.itemName}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Cost Price (Harga Modal)
                  </label>
                  <input
                    required
                    type="number"
                    name="costPrice"
                    defaultValue={editingProduct?.costPrice}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Normal Price
                  </label>
                  <input
                    required
                    type="number"
                    name="normalPrice"
                    defaultValue={editingProduct?.normalPrice}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Operational Cost
                  </label>
                  <input
                    required
                    type="number"
                    name="operationalCost"
                    defaultValue={editingProduct?.operationalCost}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Selling Price (Harga Jual)
                  </label>
                  <input
                    required
                    type="number"
                    name="sellingPrice"
                    defaultValue={editingProduct?.sellingPrice}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-blue-800 mb-1">
                    Min. Qty Grosir (Opsional)
                  </label>
                  <input
                    type="number"
                    min="2"
                    name="wholesaleMinQty"
                    defaultValue={editingProduct?.wholesaleMinQty}
                    placeholder="Contoh: 6"
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-blue-800 mb-1">
                    Harga Grosir/Item (Opsional)
                  </label>
                  <input
                    type="number"
                    name="wholesalePrice"
                    defaultValue={editingProduct?.wholesalePrice}
                    placeholder="Contoh: 120000"
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
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
                  {editingProduct ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
