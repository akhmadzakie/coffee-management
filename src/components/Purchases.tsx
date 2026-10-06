import React, { useState } from "react";
import { formatCurrency } from "../utils/format";
import { useStore } from "../store/StoreContext";
import {
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Printer,
  Download,
  CheckCircle,
  PackageCheck,
  Search,
  Package,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { PurchaseOrderItem } from "../types";
import { exportToCSV } from "../utils/export";

export const Purchases = () => {
  const {
    ingredients,
    suppliers,
    purchaseOrders,
    addPurchaseOrder,
    updatePOStatus,
    markPOAsReceived,
    deletePurchaseOrder,
    settings,
    isReadOnly,
  } = useStore();

  const [activeTab, setActiveTab] = useState<"new_po" | "history">("new_po");

  // PO State
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [cart, setCart] = useState<PurchaseOrderItem[]>([]);
  const [deliveryOption, setDeliveryOption] = useState<"RECEIVED" | "PENDING">(
    "RECEIVED",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [currentInvoiceData, setCurrentInvoiceData] = useState<any>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);
  const [poToReceive, setPoToReceive] = useState<any>(null);

  const isIndo = settings.language === "id";

  // Categories
  const categories = [
    "ALL",
    ...Array.from(new Set(ingredients.map((p) => p.category).filter(Boolean))),
  ];

  const filteredProducts = ingredients.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false;
    const matchesCategory =
      selectedCategory === "ALL" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (productId: string) => {
    const product = ingredients.find((p) => p.id === productId);
    if (!product) return;

    const existingItem = cart.find((item) => item.productId === productId);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.productId === productId
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.unitPrice,
              }
            : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          productId,
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
        },
      ]);
    }
  };

  const updateCartItem = (
    productId: string,
    updates: Partial<PurchaseOrderItem>,
  ) => {
    setCart(
      cart.map((item) => {
        if (item.productId === productId) {
          const updated = { ...item, ...updates };
          updated.subtotal =
            Math.max(1, updated.quantity) * Math.max(0, updated.unitPrice);
          return updated;
        }
        return item;
      }),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const handleCheckout = (status: "PAID" | "UNPAID") => {
    if (!selectedSupplier || cart.length === 0) return;

    const newPO = {
      poNumber: `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`,
      supplierId: selectedSupplier,
      date: new Date().toISOString(),
      items: cart,
      totalAmount,
      status,
      deliveryStatus: deliveryOption,
    };

    addPurchaseOrder(newPO);
    setCurrentInvoiceData(newPO);
    setIsInvoiceModalOpen(true);
    setCart([]);
    setSelectedSupplier("");
  };

  const handleExportHistory = () => {
    const dataToExport = purchaseOrders.map((po) => {
      const supplier = suppliers.find((s) => s.id === po.supplierId);
      return {
        PONumber: po.poNumber,
        Date: new Date(po.date).toLocaleDateString(),
        Supplier: supplier?.name || "Unknown",
        TotalAmount: po.totalAmount,
        Status: po.status,
        DeliveryStatus: po.deliveryStatus,
        ItemsCount: po.items.reduce((sum, item) => sum + item.quantity, 0),
      };
    });
    exportToCSV("Node_Supply_Purchase_Orders", dataToExport);
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex space-x-6 border-b border-slate-200 pb-4">
        {!isReadOnly && (
          <button
            onClick={() => setActiveTab("new_po")}
            className={`font-medium pb-2 -mb-[18px] transition-colors text-sm ${
              activeTab === "new_po"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {isIndo
              ? "Pembelian Baru / Kulakan (Restock)"
              : "New Purchase (Restock)"}
          </button>
        )}
        <button
          onClick={() => setActiveTab("history")}
          className={`font-medium pb-2 -mb-[18px] transition-colors text-sm ${
            activeTab === "history"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {isIndo ? "Riwayat Pembelian & PO" : "Purchase Order History"}
        </button>
      </div>

      {!isReadOnly && activeTab === "new_po" ? (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
          {/* Products Catalog for Restock */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Search & Category Filter Header */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    isIndo
                      ? "Cari nama produk, ID item untuk restock..."
                      : "Search products for restock..."
                  }
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? "bg-slate-900 text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {cat === "ALL" ? (isIndo ? "Semua" : "All") : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards with Live Stock Badges */}
            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3.5 flex-1">
              {filteredProducts.map((product) => {
                const currentStock = product.currentStock;
                const inCartItem = cart.find(
                  (item) => item.productId === product.id,
                );

                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product.id)}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                          {product.category || "Ingredient"}
                        </span>

                        {/* Stock Badge */}
                        {currentStock <= 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
                            {isIndo ? "Stok: 0 (Habis)" : "Stock: 0"}
                          </span>
                        ) : currentStock <= 5 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                            {isIndo
                              ? `Stok: ${currentStock} (Menipis)`
                              : `Stock: ${currentStock}`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 whitespace-nowrap">
                            {isIndo
                              ? `Stok: ${currentStock}`
                              : `Stock: ${currentStock}`}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-800 text-sm leading-snug mb-1 group-hover:text-blue-600 line-clamp-2 min-h-[2.5rem]">
                        {product.name}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-slate-100 mt-2 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold text-blue-600">
                        {formatCurrency(0)}
                      </span>

                      {inCartItem && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                          {inCartItem.quantity}x
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart / Purchase Order Summary */}
          <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
                {isIndo ? "Daftar Restock (PO)" : "Purchase List"}
              </h3>
              <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {cart.length} items
              </span>
            </div>

            {/* Supplier Selector */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isIndo ? "Pilih Supplier" : "Select Supplier"}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 outline-none focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm bg-white"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                >
                  <option value="">
                    {isIndo ? "-- Pilih Supplier --" : "-- Choose Supplier --"}
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.picName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Delivery Option */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isIndo ? "Status Penerimaan Barang" : "Delivery Reception"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryOption("RECEIVED")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                      deliveryOption === "RECEIVED"
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-bold"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    {isIndo
                      ? "Langsung Diterima (Masuk Stok)"
                      : "Received (In Stock)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryOption("PENDING")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                      deliveryOption === "PENDING"
                        ? "bg-slate-100 border-slate-400 text-slate-800 font-bold"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {isIndo ? "Menunggu Pengiriman" : "Pending Delivery"}
                  </button>
                </div>
              </div>
            </div>

            {/* Cart Item Rows */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/30">
              {cart.length === 0 ? (
                <div className="text-center text-slate-400 py-10 flex flex-col items-center">
                  <ShoppingBag className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm font-medium">
                    {isIndo ? "Daftar pembelian kosong" : "List is empty"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isIndo
                      ? "Klik produk di samping untuk menambah restock."
                      : "Click products to add to restock."}
                  </p>
                </div>
              ) : (
                cart.map((item) => {
                  const product = ingredients.find(
                    (p) => p.id === item.productId,
                  );
                  const currentStock = product?.currentStock || 0;

                  return (
                    <div
                      key={item.productId}
                      className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs"
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm text-slate-800 line-clamp-1">
                            {product?.name}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {isIndo
                              ? `Stok saat ini: ${currentStock} unit`
                              : `Current stock: ${currentStock}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="text-rose-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs sm:text-sm gap-2 mt-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateCartItem(item.productId, {
                                quantity: Math.max(1, Number(e.target.value)),
                              })
                            }
                            className="w-14 border border-slate-300 rounded-lg px-2 py-1 text-center font-bold text-xs"
                          />
                          <span className="text-slate-400 text-xs">x</span>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateCartItem(item.productId, {
                                unitPrice: Math.max(0, Number(e.target.value)),
                              })
                            }
                            className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-right text-xs"
                          />
                        </div>
                        <span className="font-bold text-slate-800">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Checkout Controls */}
            <div className="p-4 bg-white border-t border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold text-slate-600">
                  {isIndo ? "Total Pembelian" : "Total"}
                </span>
                <span className="font-bold text-base text-blue-600">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!selectedSupplier || cart.length === 0}
                  onClick={() => handleCheckout("UNPAID")}
                  className="py-2 px-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs"
                >
                  {isIndo ? "Simpan Belum Lunas" : "Save as Unpaid"}
                </button>
                <button
                  type="button"
                  disabled={!selectedSupplier || cart.length === 0}
                  onClick={() => handleCheckout("PAID")}
                  className="py-2 px-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs shadow-sm"
                >
                  {isIndo ? "Bayar Sekarang (Lunas)" : "Pay Now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Purchase Orders History */
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 text-sm sm:text-base">
              {isIndo
                ? "Riwayat Purchase Order (PO)"
                : "Purchase Order History"}
            </h3>
            <button
              onClick={handleExportHistory}
              className="flex items-center px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-xs text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {isIndo ? "Ekspor CSV" : "Export CSV"}
            </button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {isIndo ? "No PO" : "PO Number"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {isIndo ? "Tanggal" : "Date"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {isIndo ? "Supplier" : "Supplier"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {isIndo ? "Status Bayar" : "Payment"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {isIndo ? "Penerimaan Stok" : "Delivery"}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {isIndo ? "Total" : "Total"}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {isIndo ? "Aksi" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {purchaseOrders
                  .slice()
                  .reverse()
                  .map((po) => {
                    const supplier = suppliers.find(
                      (s) => s.id === po.supplierId,
                    );
                    return (
                      <tr key={po.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                          {po.poNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {new Date(po.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                          {supplier?.name || "Unknown Supplier"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              po.status === "PAID"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {po.status}
                          </span>
                          {po.status === "UNPAID" && (
                            <button
                              onClick={() => updatePOStatus(po.id, "PAID")}
                              className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline font-semibold"
                            >
                              {isIndo ? "Lunasi" : "Pay"}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              po.deliveryStatus === "RECEIVED"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {po.deliveryStatus === "RECEIVED"
                              ? isIndo
                                ? "Diterima (Stok Masuk)"
                                : "Received"
                              : isIndo
                                ? "Pending"
                                : "Pending"}
                          </span>
                          {po.deliveryStatus !== "RECEIVED" && (
                            <button
                              onClick={() => setPoToReceive(po)}
                              className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 underline font-semibold"
                            >
                              {isIndo ? "Terima Barang" : "Receive"}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-slate-700">
                          {formatCurrency(po.totalAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={() => {
                              setCurrentInvoiceData(po);
                              setIsInvoiceModalOpen(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                            title="View PO"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setInvoiceToDelete(po)}
                            className="text-rose-600 hover:text-rose-900"
                            title="Delete PO"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {purchaseOrders.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-slate-400 text-sm"
                    >
                      {isIndo
                        ? "Belum ada data Purchase Order."
                        : "No purchase orders found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receive PO Modal */}
      {poToReceive && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 ">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {isIndo
                ? "Konfirmasi Penerimaan Barang?"
                : "Confirm Goods Reception?"}
            </h3>
            <p className="text-slate-600 text-sm mb-6">
              {isIndo ? (
                <>
                  Barang untuk PO <strong>{poToReceive.poNumber}</strong> sudah
                  sampai di gudang/lapangan?
                  <br />
                  <br />
                  Sistem akan secara otomatis menambahkan kuantitas barang ke
                  stok inventaris.
                </>
              ) : (
                <>
                  Have the goods for PO <strong>{poToReceive.poNumber}</strong>{" "}
                  arrived?
                  <br />
                  <br />
                  This will automatically increment product stock counts in your
                  inventory.
                </>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPoToReceive(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
              >
                {isIndo ? "Batal" : "Cancel"}
              </button>
              <button
                onClick={() => {
                  markPOAsReceived(poToReceive.id);
                  setPoToReceive(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold"
              >
                {isIndo
                  ? "Ya, Terima & Masukkan Stok"
                  : "Yes, Receive & Add Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View PO Modal */}
      {isInvoiceModalOpen && currentInvoiceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 ">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-start mb-8 border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">
                    PURCHASE ORDER
                  </h2>
                  <p className="text-slate-500 text-sm font-medium">
                    {currentInvoiceData.poNumber}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${currentInvoiceData.status === "PAID" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}
                    >
                      {currentInvoiceData.status}
                    </span>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${currentInvoiceData.deliveryStatus === "RECEIVED" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"}`}
                    >
                      {currentInvoiceData.deliveryStatus === "RECEIVED"
                        ? "RECEIVED"
                        : "PENDING DELIVERY"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex flex-col items-center sm:items-start mb-2">
                    {settings.logoDataUrl ? (
                      <img
                        src={settings.logoDataUrl}
                        alt={settings.brandName}
                        className="h-16 w-auto object-contain"
                      />
                    ) : (
                      <h3 className="font-bold text-slate-800 text-lg">
                        {settings.brandName}
                      </h3>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm max-w-xs ml-auto mt-1">
                    {settings.companyAddress}
                  </p>
                </div>
              </div>

              <div className="mb-8">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Order To
                </p>
                <h4 className="font-bold text-slate-800 text-lg">
                  {suppliers.find((s) => s.id === currentInvoiceData.supplierId)
                    ?.name || "Unknown Supplier"}
                </h4>
                <p className="text-slate-600 text-sm mt-1">
                  {
                    suppliers.find(
                      (s) => s.id === currentInvoiceData.supplierId,
                    )?.picName
                  }
                </p>
                <p className="text-slate-600 text-sm">
                  {
                    suppliers.find(
                      (s) => s.id === currentInvoiceData.supplierId,
                    )?.address
                  }
                </p>
              </div>

              <table className="w-full mb-8">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left text-xs font-bold text-slate-500 uppercase">
                      Item Description
                    </th>
                    <th className="py-2 text-center text-xs font-bold text-slate-500 uppercase">
                      Qty
                    </th>
                    <th className="py-2 text-right text-xs font-bold text-slate-500 uppercase">
                      Unit Price
                    </th>
                    <th className="py-2 text-right text-xs font-bold text-slate-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentInvoiceData.items.map((item: any, idx: number) => {
                    const product = ingredients.find(
                      (p) => p.id === item.productId,
                    );
                    return (
                      <tr key={idx}>
                        <td className="py-3 text-sm text-slate-800 font-medium">
                          {product?.name || "Unknown Product"}
                        </td>
                        <td className="py-3 text-sm text-slate-600 text-center">
                          {item.quantity}
                        </td>
                        <td className="py-3 text-sm text-slate-600 text-right">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-3 text-sm text-slate-800 font-bold text-right">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-end border-t border-slate-200 pt-4 mb-8">
                <div className="w-64">
                  <div className="flex justify-between items-center text-lg font-bold text-slate-900 border-t-2 border-slate-800 pt-2">
                    <span>Total Amount</span>
                    <span className="text-blue-600">
                      {formatCurrency(currentInvoiceData.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-slate-200 pt-6">
                <p className="text-xs text-slate-400">
                  Date: {new Date(currentInvoiceData.date).toLocaleString()}
                </p>
                <div className="space-x-3">
                  <button
                    onClick={() => {
                      setIsInvoiceModalOpen(false);
                      setCurrentInvoiceData(null);
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm"
                  >
                    Print PO
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 ">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {isIndo ? "Hapus Purchase Order?" : "Delete Purchase Order?"}
            </h3>
            <p className="text-slate-600 text-sm mb-6">
              {isIndo ? (
                <>
                  Apakah Anda yakin ingin menghapus PO{" "}
                  <strong>{invoiceToDelete.poNumber}</strong>?<br />
                  <br />
                  Catatan stok inventaris dan transaksi keuangan terkait PO ini
                  juga akan dihapus.
                </>
              ) : (
                <>
                  Are you sure you want to delete PO{" "}
                  <strong>{invoiceToDelete.poNumber}</strong>?<br />
                  <br />
                  This will also remove associated inventory and finance
                  records.
                </>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setInvoiceToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
              >
                {isIndo ? "Batal" : "Cancel"}
              </button>
              <button
                onClick={() => {
                  deletePurchaseOrder(invoiceToDelete.id);
                  setInvoiceToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium"
              >
                {isIndo ? "Hapus" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
