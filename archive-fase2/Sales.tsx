import React, { useState } from 'react';
import { formatCurrency } from '../utils/format';
import { useStore } from '../store/StoreContext';
import { 
  TrendingUp,
  DollarSign,
  Plus, 
  Minus,
  Trash2, 
  ShoppingCart, 
  Printer, 
  Download, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  PackageX,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react';
import { InvoiceItem } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { exportSalesToCSV, exportSalesToPDF } from '../utils/export';

export const Sales = () => {
  const { 
    products, 
    clients, 
    invoices, 
    salesAgents,
    addInvoice, 
    updateInvoiceStatus, 
    addInvoicePayment, 
    deleteInvoice, 
    settings, 
    pricingTiers,
    getProductStock,
    currentUser,
    users
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'dashboard'>('pos');
  const [dashboardAgentId, setDashboardAgentId] = useState<string>('');
  
  // Auto-link cashier to their sales profile
  const isCashier = currentUser?.role === 'CASHIER';
  const mySalesAgentId = currentUser?.linkedSalesAgentId;
  const activeSalesAgentId = mySalesAgentId || dashboardAgentId;
  
  // POS State
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedSalesAgentId, setSelectedSalesAgentId] = useState('');
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockWarning, setStockWarning] = useState<string | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [currentInvoiceData, setCurrentInvoiceData] = useState<any>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('TRANSFER');
  const [adminAuthPrompt, setAdminAuthPrompt] = useState<{ action: 'DELETE_INVOICE' | 'DISCOUNT', payload: any } | null>(null);
  const [adminPin, setAdminPin] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  const isIndo = settings.language === 'id';

  // Get unique categories
  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  // Filtered products for POS
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.itemId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.brand && product.brand.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'ALL' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const recalculateCart = (currentCart: InvoiceItem[], clientId: string) => {
    // Group quantities by category to support cross-variant mixing for wholesale prices
    const categoryQty: Record<string, number> = {};
    currentCart.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        categoryQty[p.category] = (categoryQty[p.category] || 0) + item.quantity;
      }
    });

    return currentCart.map(item => {
      const product = products.find(prod => prod.id === item.productId);
      if (!product) return item;

      // The quantity used for wholesale threshold is the TOTAL quantity in the same category
      const wholesaleQtyBasis = categoryQty[product.category] || item.quantity;

      let basePrice = product.sellingPrice;
      if (product.wholesaleMinQty && product.wholesalePrice && wholesaleQtyBasis >= product.wholesaleMinQty) {
        basePrice = product.wholesalePrice;
      }

      let targetPrice = basePrice;
      if (clientId) {
        const clientObj = clients.find(c => c.id === clientId);
        if (clientObj?.tier && clientObj.tier !== 'REGULAR') {
          const tierInfo = pricingTiers?.find(t => t.id === clientObj.tier);
          
          if (product.tierPrices?.[clientObj.tier]) {
            targetPrice = product.tierPrices[clientObj.tier];
          } else if (tierInfo) {
            const baseForTier = tierInfo.basePrice === 'NORMAL_PRICE' ? product.normalPrice : basePrice;
            
            if (tierInfo.discountType === 'PERCENTAGE' || tierInfo.discountPercentage) {
              const perc = tierInfo.discountValue || tierInfo.discountPercentage || 0;
              targetPrice = baseForTier * (1 - (perc / 100));
            } else if (tierInfo.discountType === 'NOMINAL' && tierInfo.discountValue) {
              targetPrice = Math.max(0, baseForTier - tierInfo.discountValue);
            } else {
              targetPrice = baseForTier;
            }
          }
        }
      }

      return {
        ...item,
        unitPrice: targetPrice,
        subtotal: (item.quantity * targetPrice) - item.discount
      };
    });
  };

  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const availableStock = getProductStock(productId);
    const existingItem = cart.find(item => item.productId === productId);
    const currentQtyInCart = existingItem ? existingItem.quantity : 0;
    const newQty = currentQtyInCart + 1;

    if (availableStock <= 0) {
      setStockWarning(
        isIndo
          ? `Gagal menambahkan! Stok "${product.name}" saat ini HABIS (0 unit) di lapangan.`
          : `Cannot add! "${product.name}" is currently OUT OF STOCK (0 units).`
      );
      setTimeout(() => setStockWarning(null), 4000);
      return;
    }

    if (newQty > availableStock) {
      setStockWarning(
        isIndo
          ? `Batas stok tercapai! "${product.name}" hanya tersedia ${availableStock} unit di lapangan.`
          : `Stock limit reached! Only ${availableStock} units of "${product.name}" available in stock.`
      );
      setTimeout(() => setStockWarning(null), 4000);
      return;
    }

    let nextCart = [...cart];
    if (existingItem) {
      nextCart = nextCart.map(item => 
        item.productId === productId ? { ...item, quantity: newQty } : item
      );
    } else {
      nextCart.push({
        productId,
        quantity: 1,
        unitPrice: product.sellingPrice,
        discount: 0,
        subtotal: product.sellingPrice
      });
    }

    setCart(recalculateCart(nextCart, selectedClient));
  };

  const updateCartItemQuantity = (productId: string, newQuantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const availableStock = getProductStock(productId);

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQuantity > availableStock) {
      setStockWarning(
        isIndo
          ? `Kuantitas "${product.name}" disesuaikan ke stok maksimal (${availableStock} unit).`
          : `Quantity for "${product.name}" capped at maximum available stock (${availableStock} units).`
      );
      setTimeout(() => setStockWarning(null), 4000);
      newQuantity = availableStock;
    }

    const nextCart = cart.map(item => 
      item.productId === productId ? { ...item, quantity: newQuantity } : item
    );
    setCart(recalculateCart(nextCart, selectedClient));
  };

  const updateCartItemDiscount = (productId: string, discount: number) => {
    if (currentUser?.role === 'CASHIER') {
      setAdminAuthPrompt({ action: 'DISCOUNT', payload: { productId, discount } });
      return;
    }
    const nextCart = cart.map(item => {
      if (item.productId === productId) {
        const safeDiscount = Math.max(0, discount);
        return { ...item, discount: safeDiscount };
      }
      return item;
    });
    setCart(recalculateCart(nextCart, selectedClient));
  };

  const removeFromCart = (productId: string) => {
    const nextCart = cart.filter(item => item.productId !== productId);
    setCart(recalculateCart(nextCart, selectedClient));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const totalAmount = Math.max(0, subtotal - totalDiscount);

  // Check if any cart item currently exceeds live stock
  const invalidCartItems = cart.filter(item => {
    const availableStock = getProductStock(item.productId);
    return item.quantity > availableStock || availableStock <= 0;
  });

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const adminUser = users.find((u: any) => (u.role === 'ADMIN' || u.role === 'MANAGER') && u.pin === adminPin);
    if (!adminUser) {
      setAdminAuthError(isIndo ? 'PIN Admin salah atau tidak memiliki akses!' : 'Invalid Admin PIN or unauthorized!');
      return;
    }

    // Authorized
    setAdminAuthError('');
    
    if (adminAuthPrompt?.action === 'DELETE_INVOICE') {
      deleteInvoice(adminAuthPrompt.payload);
      setInvoiceToDelete(null);
    } else if (adminAuthPrompt?.action === 'DISCOUNT') {
      const { productId, discount } = adminAuthPrompt.payload;
      const nextCart = cart.map(item => {
        if (item.productId === productId) {
          const safeDiscount = Math.max(0, discount);
          return { ...item, discount: safeDiscount };
        }
        return item;
      });
      setCart(recalculateCart(nextCart, selectedClient));
    }

    setAdminAuthPrompt(null);
    setAdminPin('');
  };

  const handleCheckout = (status: 'PAID' | 'UNPAID') => {
    if (!selectedClient || cart.length === 0) return;

    // Strict stock verification before saving invoice
    const outOfStockItems = cart.filter(item => {
      const availableStock = getProductStock(item.productId);
      return item.quantity > availableStock;
    });

    if (outOfStockItems.length > 0) {
      const errorNames = outOfStockItems.map(item => {
        const prod = products.find(p => p.id === item.productId);
        const avail = getProductStock(item.productId);
        return `${prod?.name || 'Produk'} (Pesan: ${item.quantity}, Stok: ${avail})`;
      }).join(', ');

      setStockWarning(
        isIndo
          ? `Gagal memproses transaksi! Item berikut melebihi stok yang tersedia di lapangan: ${errorNames}`
          : `Cannot complete checkout! The following items exceed available stock: ${errorNames}`
      );
      return;
    }

    const invoiceNumber = `INV-${new Date().getTime().toString().slice(-6)}`;
    const chosenAgent = salesAgents.find(a => a.id === dashboardAgentId);
    let commissionAmount = 0;
    let commissionStatus: 'PENDING' | 'ELIGIBLE' | 'NONE' = 'NONE';

    if (chosenAgent) {
      if (chosenAgent.commissionType === 'PERCENTAGE') {
        commissionAmount = Math.round((totalAmount * chosenAgent.commissionRate) / 100);
      } else {
        const totalItemsQty = cart.reduce((sum, item) => sum + item.quantity, 0);
        commissionAmount = Math.round(totalItemsQty * chosenAgent.commissionRate);
      }
      commissionStatus = status === 'PAID' ? 'ELIGIBLE' : 'PENDING';
    }

    const newInvoice = {
      invoiceNumber,
      clientId: selectedClient,
      date: new Date().toISOString(),
      items: cart,
      subtotal,
      discountTotal: totalDiscount,
      totalAmount,
      status,
      salesAgentId: chosenAgent?.id,
      salesAgentName: chosenAgent?.name,
      commissionType: chosenAgent?.commissionType,
      commissionRate: chosenAgent?.commissionRate,
      commissionAmount,
      commissionStatus
    };

    addInvoice(newInvoice);
    setCurrentInvoiceData(newInvoice);
    setIsInvoiceModalOpen(true);
    setCart([]);
    setSelectedClient('');
    setSelectedSalesAgentId('');
    setStockWarning(null);
  };


  const handlePrintPDF = () => {
    if (!currentInvoiceData) return;
    const client = clients.find(c => c.id === currentInvoiceData.clientId);
    const clientName = client ? client.coffeeShop : 'Client';
    const cleanClientName = clientName.replace(/[^a-zA-Z0-9]/g, '-');
    const fileName = `Invoice_${currentInvoiceData.invoiceNumber}_${cleanClientName}`;
    
    const originalTitle = document.title;
    document.title = fileName;
    window.print();
    document.title = originalTitle;
  };

  const handleDownloadPDF = async () => {
    if (!currentInvoiceData) return;
    
    const element = document.getElementById('invoice-print-area');
    if (!element) return;
    
    try {
      const client = clients.find(c => c.id === currentInvoiceData.clientId);
      const clientName = client ? client.coffeeShop : 'Client';
      const cleanClientName = clientName.replace(/[^a-zA-Z0-9]/g, '-');
      const fileName = `Invoice_${currentInvoiceData.invoiceNumber}_${cleanClientName}.pdf`;
      
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(fileName);
    } catch (err) {
      console.error('Failed to generate PDF', err);
    }
  };

  const handleExportPDF = () => {
    exportSalesToPDF({
      invoices,
      products,
      clients,
      settings,
      periodLabel: isIndo ? 'Keseluruhan Data' : 'All Time Records'
    });
  };

  const handleExportCSVSummary = () => {
    exportSalesToCSV({
      invoices,
      products,
      clients,
      settings,
      mode: 'summary'
    });
  };

  const handleExportCSVDetailed = () => {
    exportSalesToCSV({
      invoices,
      products,
      clients,
      settings,
      mode: 'detailed'
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex space-x-6 border-b border-slate-200 pb-4">
        <button
          onClick={() => setActiveTab('pos')}
          className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          } -mb-[17px]`}
        >
          {isIndo ? 'Kasir Penjualan (POS)' : 'Point of Sale (POS)'}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          } -mb-[17px]`}
        >
          {isIndo ? 'Riwayat Faktur / Invoice' : 'Invoice History'}
        </button>
      </div>

      {/* Stock Warning Toast / Alert */}
      {stockWarning && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-sm animate-shake">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="font-medium">{stockWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setStockWarning(null)}
            className="text-rose-500 hover:text-rose-800 font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {activeTab === 'pos' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Grid & Selection */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search & Filter Header */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isIndo ? 'Cari nama produk, ID item, atau brand...' : 'Search products by name, ID, or brand...'}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? (isIndo ? 'Semua' : 'All') : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
                  <PackageX className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">{isIndo ? 'Tidak ada produk ditemukan' : 'No products found'}</p>
                </div>
              ) : (
                filteredProducts.map(product => {
                  const availableStock = getProductStock(product.id);
                  const inCartItem = cart.find(item => item.productId === product.id);
                  const inCartQty = inCartItem ? inCartItem.quantity : 0;
                  const isOutOfStock = availableStock <= 0;
                  const isMaxInCart = inCartQty >= availableStock && !isOutOfStock;

                  return (
                    <div 
                      key={product.id} 
                      onClick={() => addToCart(product.id)}
                      className={`relative bg-white rounded-xl border p-3.5 flex flex-col justify-between transition-all select-none ${
                        isOutOfStock 
                          ? 'border-slate-200 opacity-60 bg-slate-50 cursor-not-allowed'
                          : isMaxInCart
                          ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400 cursor-pointer'
                          : 'border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer'
                      }`}
                    >
                      <div>
                        {/* Top ID & Stock Badge */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                            {product.itemId || product.category}
                          </span>

                          {/* Live Stock Badge */}
                          {availableStock <= 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">
                              {isIndo ? 'Habis (0)' : 'Out (0)'}
                            </span>
                          ) : availableStock <= 5 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                              {isIndo ? `Stok: ${availableStock}` : `Stock: ${availableStock}`}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">
                              {isIndo ? `Stok: ${availableStock}` : `Stock: ${availableStock}`}
                            </span>
                          )}
                        </div>

                        {/* Product Title */}
                        <h4 className="font-bold text-slate-800 text-sm leading-snug mb-1 line-clamp-2 min-h-[2.5rem]">
                          {product.name}
                        </h4>
                      </div>

                      <div className="pt-2 border-t border-slate-100 mt-2 flex items-center justify-between">
                        <span className="text-sm font-bold text-blue-600">
                          {formatCurrency(product.sellingPrice)}
                        </span>

                        {inCartQty > 0 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                            {inCartQty}x
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cart / Invoice Summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-12rem)]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                {isIndo ? 'Daftar Pesanan' : 'Current Order'}
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                >
                  {isIndo ? 'Kosongkan' : 'Clear'}
                </button>
              )}
            </div>
            
            {/* Client & Sales Agent Selector */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isIndo ? 'Pilih Pelanggan / Coffee Shop' : 'Select Client / Coffee Shop'} <span className="text-rose-500">*</span>
                </label>
                <select 
                  value={selectedClient}
                  onChange={(e) => {
                    const newClientId = e.target.value;
                    setSelectedClient(newClientId);
                    
                    // Recalculate cart prices based on new client tier and wholesale thresholds
                    setCart(recalculateCart(cart, newClientId));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs sm:text-sm bg-white"
                >
                  <option value="">{isIndo ? '-- Pilih Pelanggan --' : '-- Choose Client --'}</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.coffeeShop} ({c.picName})</option>
                  ))}
                </select>
              </div>

              {/* Sales Agent Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isIndo ? 'Sales Bertugas' : 'Assigned Sales Agent'}
                </label>
                {isCashier && mySalesAgentId ? (
                   <div className="w-full bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold flex items-center">
                     <CheckCircle2 className="w-4 h-4 mr-2 text-blue-600" />
                     {salesAgents.find(a => a.id === mySalesAgentId)?.name || 'Profil Tidak Ditemukan'}
                   </div>
                ) : (
                  <select
                    value={dashboardAgentId}
                    onChange={(e) => setDashboardAgentId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs sm:text-sm bg-white"
                  >
                    <option value="">{isIndo ? '-- Tanpa Sales Agent (Direct) --' : '-- No Sales Agent (Direct) --'}</option>
                    {salesAgents.filter(a => a.isActive).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.commissionType === 'PERCENTAGE' ? `Komisi ${a.commissionRate}%` : `Komisi ${formatCurrency(a.commissionRate)}/item`})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <ShoppingCart className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm font-medium">{isIndo ? 'Keranjang masih kosong' : 'Cart is empty'}</p>
                  <p className="text-xs text-slate-400 mt-1 text-center">
                    {isIndo ? 'Klik produk di samping untuk menambahkan item sesuai stok.' : 'Click products to add to current order.'}
                  </p>
                </div>
              ) : (
                cart.map(item => {
                  const product = products.find(p => p.id === item.productId);
                  const availableStock = getProductStock(item.productId);
                  const isExceedingStock = item.quantity > availableStock;

                  return (
                    <div 
                      key={item.productId} 
                      className={`p-3 rounded-xl border transition-all ${
                        isExceedingStock 
                          ? 'bg-rose-50 border-rose-300' 
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex-1 pr-2">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">
                            {product?.name}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-500">
                              {formatCurrency(item.unitPrice)}
                            </span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className={`text-[11px] font-medium ${isExceedingStock ? 'text-rose-600 font-bold' : 'text-blue-700'}`}>
                              {isIndo ? `Maks Stok: ${availableStock}` : `Max Stock: ${availableStock}`}
                            </span>
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={() => removeFromCart(item.productId)} 
                          className="text-rose-400 hover:text-rose-700 p-1 rounded transition-colors"
                          title={isIndo ? 'Hapus item' : 'Remove item'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quantity Stepper & Subtotal */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200/60">
                        <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateCartItemQuantity(item.productId, item.quantity - 1)}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input 
                            type="number" 
                            min="1" 
                            max={availableStock}
                            value={item.quantity}
                            onChange={(e) => updateCartItemQuantity(item.productId, parseInt(e.target.value) || 1)}
                            className="w-12 text-center text-xs font-bold py-1 border-x border-slate-200 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartItemQuantity(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= availableStock}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="font-bold text-xs sm:text-sm text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>

                      {/* Stock Exceeded Alert Indicator */}
                      {isExceedingStock && (
                        <div className="mt-2 text-[11px] text-rose-700 font-medium flex items-center gap-1 bg-rose-100/80 p-1.5 rounded">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{isIndo ? `Jumlah melebihi stok fisik (${availableStock} unit)!` : `Exceeds available stock (${availableStock})!`}</span>
                        </div>
                      )}

                      {/* Optional Item Discount */}
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">{isIndo ? 'Diskon item (Rp):' : 'Discount:'}</span>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="0"
                          value={item.discount || ''}
                          onChange={(e) => updateCartItemDiscount(item.productId, Number(e.target.value))}
                          className="w-24 border border-slate-300 rounded px-2 py-0.5 text-right text-rose-600 text-xs bg-white"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="space-y-1.5 mb-3 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>{isIndo ? 'Total Diskon' : 'Total Discount'}</span>
                    <span>- {formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                {selectedSalesAgentId && (
                  <div className="flex justify-between text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs font-semibold">
                    <span>
                      {isIndo ? 'Komisi Sales' : 'Sales Commission'} (
                      {salesAgents.find(a => a.id === activeSalesAgentId)?.name}
                      ):
                    </span>
                    <span>
                      {(() => {
                        const agent = salesAgents.find(a => a.id === dashboardAgentId);
                        if (!agent) return 'Rp 0';
                        if (agent.commissionType === 'PERCENTAGE') {
                          return `${formatCurrency(Math.round((totalAmount * agent.commissionRate) / 100))} (${agent.commissionRate}%)`;
                        } else {
                          const totalQty = cart.reduce((sum, i) => sum + i.quantity, 0);
                          return `${formatCurrency(Math.round(totalQty * agent.commissionRate))} (${totalQty} item)`;
                        }
                      })()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span className="text-blue-700">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              {invalidCartItems.length > 0 && (
                <p className="text-xs text-rose-600 font-medium mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {isIndo ? 'Harap sesuaikan kuantitas dengan stok tersedia!' : 'Adjust quantities to match stock!'}
                </p>
              )}

              <div className="flex space-x-2">
                <button 
                  type="button"
                  onClick={() => handleCheckout('UNPAID')}
                  disabled={!selectedClient || cart.length === 0 || invalidCartItems.length > 0}
                  className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  {isIndo ? 'Simpan Belum Lunas' : 'Save as Unpaid'}
                </button>
                <button 
                  type="button"
                  onClick={() => handleCheckout('PAID')}
                  disabled={!selectedClient || cart.length === 0 || invalidCartItems.length > 0}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  {isIndo ? 'Bayar Sekarang (Lunas)' : 'Pay Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-semibold text-slate-800 text-sm sm:text-base">
              {isIndo ? 'Riwayat Transaksi Penjualan' : 'Sales Transaction History'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={handleExportCSVSummary}
                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs text-xs font-medium rounded-lg"
                title="Unduh Rekap Penjualan per Faktur"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                {isIndo ? 'CSV Rekap' : 'CSV Summary'}
              </button>
              <button 
                onClick={handleExportCSVDetailed}
                className="flex items-center px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs text-xs font-medium rounded-lg"
                title="Unduh Rincian Penjualan per Baris Item"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                {isIndo ? 'CSV Detail' : 'CSV Items'}
              </button>
              <button 
                onClick={handleExportPDF}
                className="flex items-center px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs text-xs font-bold rounded-lg"
                title="Unduh Laporan Penjualan Resmi PDF"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                {isIndo ? 'Unduh PDF' : 'Download PDF'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Tanggal' : 'Date'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'No Faktur' : 'Invoice No'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Pelanggan' : 'Client'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Sales & Komisi' : 'Sales & Commission'}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Total Tagihan' : 'Total Amount'}</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Status' : 'Status'}</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Aksi' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {invoices.slice().reverse().map((inv) => {
                  const client = clients.find(c => c.id === inv.clientId);
                  const agent = salesAgents.find(a => a.id === inv.salesAgentId);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{inv.invoiceNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{client?.coffeeShop || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {inv.salesAgentName || agent?.name ? (
                          <div>
                            <span className="font-semibold text-slate-900">{inv.salesAgentName || agent?.name}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-blue-700 font-bold">{formatCurrency(inv.commissionAmount || 0)}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                inv.commissionStatus === 'PAID' ? 'bg-blue-100 text-blue-800' :
                                inv.commissionStatus === 'ELIGIBLE' ? 'bg-blue-100 text-blue-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {inv.commissionStatus === 'PAID' ? 'Cair' :
                                 inv.commissionStatus === 'ELIGIBLE' ? 'Siap Cair' : 'Tertunda'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-slate-900">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          inv.status === 'PAID' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-3">
                          {inv.status === 'UNPAID' && (
                            <button onClick={() => updateInvoiceStatus(inv.id, 'PAID')} className="text-blue-600 hover:text-blue-900 text-xs font-semibold">
                              {isIndo ? 'Tandai Lunas' : 'Mark Paid'}
                            </button>
                          )}
                          <button onClick={() => {
                            setCurrentInvoiceData(inv);
                            setIsInvoiceModalOpen(true);
                          }} className="text-blue-600 hover:text-blue-900" title="Print Invoice">
                            <Printer className="w-4 h-4" />
                          </button>
                          <button onClick={() => setInvoiceToDelete(inv)} className="text-rose-600 hover:text-rose-900" title="Void Invoice">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {isIndo ? 'Batalkan / Hapus Faktur?' : 'Void Invoice?'}
            </h3>
            <p className="text-slate-600 text-sm mb-6">
              {isIndo ? (
                <>
                  Apakah Anda yakin ingin membatalkan Faktur <strong>{invoiceToDelete.invoiceNumber}</strong>?<br/><br/>
                  Tindakan ini akan mengembalikan stok produk yang telah terpotong ke inventaris gudang.
                </>
              ) : (
                <>
                  Are you sure you want to void/delete Invoice <strong>{invoiceToDelete.invoiceNumber}</strong>?<br/><br/>
                  This will reverse the stock deduction and replenish warehouse inventory.
                </>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setInvoiceToDelete(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">
                {isIndo ? 'Batal' : 'Cancel'}
              </button>
              <button onClick={() => {
                if (currentUser?.role === 'CASHIER') {
                  setAdminAuthPrompt({ action: 'DELETE_INVOICE', payload: invoiceToDelete.id });
                } else {
                  deleteInvoice(invoiceToDelete.id);
                  setInvoiceToDelete(null);
                }
              }} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium">
                {isIndo ? 'Ya, Batalkan' : 'Void Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">{isIndo ? 'Pembayaran Termin / Cicilan' : 'Installment Payment'}</h3>
              <p className="text-sm text-slate-500">Invoice: {paymentInvoice.invoiceNumber}</p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">{isIndo ? 'Total Tagihan:' : 'Total Invoice:'}</span>
                  <span className="font-semibold">{formatCurrency(paymentInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">{isIndo ? 'Sudah Dibayar:' : 'Paid Amount:'}</span>
                  <span className="font-semibold text-blue-600">{formatCurrency((paymentInvoice.payments || []).reduce((sum, p) => sum + p.amount, 0))}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-100 mt-2">
                  <span className="text-slate-700 font-medium">{isIndo ? 'Sisa Tagihan:' : 'Remaining:'}</span>
                  <span className="font-bold text-rose-600">
                    {formatCurrency(paymentInvoice.totalAmount - (paymentInvoice.payments || []).reduce((sum, p) => sum + p.amount, 0))}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isIndo ? 'Nominal Pembayaran (Rp)' : 'Payment Amount (Rp)'}</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Contoh: 500000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isIndo ? 'Metode Pembayaran' : 'Payment Method'}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="TRANSFER">Transfer Bank</option>
                    <option value="CASH">{isIndo ? 'Tunai / Cash' : 'Cash'}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
              <button
                onClick={() => { setPaymentInvoice(null); setPaymentAmount(''); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
              >
                {isIndo ? 'Batal' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (paymentAmount && Number(paymentAmount) > 0) {
                    addInvoicePayment(paymentInvoice.id, Number(paymentAmount), paymentMethod);
                    setPaymentInvoice(null);
                    setPaymentAmount('');
                  }
                }}
                disabled={!paymentAmount || Number(paymentAmount) <= 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isIndo ? 'Simpan Pembayaran' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Print Modal */}
      {isInvoiceModalOpen && currentInvoiceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="text-lg font-semibold text-slate-800">Invoice {currentInvoiceData.invoiceNumber}</h3>
              <div className="flex space-x-2">
                <button onClick={handlePrintPDF} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded flex items-center text-sm font-medium hover:bg-blue-100">
                  <Printer className="w-4 h-4 mr-1" /> {isIndo ? 'Cetak' : 'Print'}
                </button>
                <button onClick={handleDownloadPDF} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded flex items-center text-sm font-medium hover:bg-blue-100">
                  <Download className="w-4 h-4 mr-1" /> {isIndo ? 'Download PDF' : 'Download PDF'}
                </button>
                <button onClick={() => setIsInvoiceModalOpen(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded text-sm font-medium">
                  {isIndo ? 'Tutup' : 'Close'}
                </button>
              </div>
            </div>
            
            {/* Printable Area */}
            <div className="p-8 overflow-y-auto bg-white print:p-0 print:m-0 print:shadow-none" id="invoice-print-area">
              <div className="flex justify-between items-end mb-4">
                <h1 className="text-4xl font-bold text-sky-800 tracking-wider uppercase">INVOICE</h1>
                <div className="text-right">
                  {settings.logoDataUrl ? (
                    <img src={settings.logoDataUrl} alt={settings.brandName} className="h-16 w-auto ml-auto object-contain" />
                  ) : (
                    <h2 className="text-2xl font-bold text-sky-800 uppercase">{settings.brandName}</h2>
                  )}
                </div>
              </div>

              <div className="h-1 w-full bg-sky-800 mb-6"></div>

              <div className="flex justify-between mb-6 text-sm">
                <div>
                  <h3 className="font-bold text-sky-800 text-base mb-1 uppercase">{settings.brandName}</h3>
                  <p className="text-slate-800 max-w-[250px] leading-relaxed">{settings.companyAddress}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-800"><span className="text-slate-500 mr-2">To:</span> <span className="font-semibold uppercase">{clients.find(c => c.id === currentInvoiceData.clientId)?.coffeeShop}</span></p>
                  <p className="text-slate-800 mt-1"><span className="text-slate-500 mr-2">Invoice Number:</span> <span className="font-semibold">{currentInvoiceData.invoiceNumber}</span></p>
                </div>
              </div>

              <div className="w-full border-t-2 border-b-2 border-sky-800 py-1.5 mb-6">
                <table className="w-full text-center text-xs">
                  <thead>
                    <tr className="text-sky-800">
                      <th className="font-medium pb-1">Sales Person</th>
                      <th className="font-medium pb-1">Job</th>
                      <th className="font-medium pb-1">shipping method</th>
                      <th className="font-medium pb-1">Date</th>
                      <th className="font-medium pb-1">Payment</th>
                      <th className="font-medium pb-1">Due date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-slate-800">
                      <td>{currentInvoiceData.salesAgentName || settings.salesPerson}</td>
                      <td>Sales</td>
                      <td>Sent by Shipping</td>
                      <td>{new Date(currentInvoiceData.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '/')}</td>
                      <td>Invoice</td>
                      <td>{new Date(new Date(currentInvoiceData.date).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '/')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <table className="w-full text-[11px] border-collapse border border-sky-300 mb-6">
                <thead>
                  <tr className="bg-sky-100 text-sky-900 text-center">
                    <th className="border border-sky-300 py-2 px-1 font-semibold w-8">No</th>
                    <th className="border border-sky-300 py-2 px-2 font-semibold">Product</th>
                    <th className="border border-sky-300 py-2 px-2 font-semibold">ID ITEM</th>
                    <th className="border border-sky-300 py-2 px-2 font-semibold">BRAND</th>
                    <th className="border border-sky-300 py-2 px-2 font-semibold">JENIS BARANG</th>
                    <th className="border border-sky-300 py-2 px-2 font-semibold">Quantity</th>
                    <th className="border border-sky-300 py-2 px-2 font-semibold">Unit Price</th>
                    <th className="border border-sky-300 py-2 px-2 font-semibold">Discount Per Item</th>
                    <th className="border border-sky-300 py-2 px-2 font-semibold">Total In Line</th>
                  </tr>
                </thead>
                <tbody className="text-slate-800">
                  {currentInvoiceData.items.map((item: any, i: number) => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <tr key={i}>
                        <td className="border border-sky-300 py-1.5 px-1 text-center">{i + 1}</td>
                        <td className="border border-sky-300 py-1.5 px-2">{product?.name || product?.itemName}</td>
                        <td className="border border-sky-300 py-1.5 px-2 text-center">{product?.itemId}</td>
                        <td className="border border-sky-300 py-1.5 px-2 text-center uppercase">{product?.brand}</td>
                        <td className="border border-sky-300 py-1.5 px-2 text-center uppercase">{product?.category}</td>
                        <td className="border border-sky-300 py-1.5 px-2 text-center">{item.quantity}</td>
                        <td className="border border-sky-300 py-1.5 px-2 text-right">Rp{item.unitPrice.toLocaleString('id-ID')}</td>
                        <td className="border border-sky-300 py-1.5 px-2 text-right">{item.discount > 0 ? `Rp${item.discount.toLocaleString('id-ID')}` : ''}</td>
                        <td className="border border-sky-300 py-1.5 px-2 text-right">Rp{item.subtotal.toLocaleString('id-ID')}</td>
                      </tr>
                    );
                  })}
                  {/* Fill empty rows up to 10 for visual match */}
                  {Array.from({ length: Math.max(0, 10 - currentInvoiceData.items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td className="border border-sky-300 py-1.5 px-1 h-7 text-center">{currentInvoiceData.items.length + i + 1}</td>
                      <td className="border border-sky-300 py-1.5 px-2 h-7"></td>
                      <td className="border border-sky-300 py-1.5 px-2 h-7"></td>
                      <td className="border border-sky-300 py-1.5 px-2 h-7"></td>
                      <td className="border border-sky-300 py-1.5 px-2 h-7"></td>
                      <td className="border border-sky-300 py-1.5 px-2 h-7"></td>
                      <td className="border border-sky-300 py-1.5 px-2 h-7"></td>
                      <td className="border border-sky-300 py-1.5 px-2 h-7"></td>
                      <td className="border border-sky-300 py-1.5 px-2 h-7"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center text-sm font-bold text-sky-900 mb-12 px-2">
                <div className="w-1/2 text-center">
                  Total Quantity <span className="ml-8">{currentInvoiceData.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}</span>
                </div>
                <div className="w-1/2 flex justify-end gap-16 pr-2">
                  <span>Total</span>
                  <span>Rp{currentInvoiceData.totalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>
              
              <div className="text-center text-xs text-sky-800 space-y-1">
                <p>Payments can be made via bank transfer to the following account</p>
                <p className="font-semibold">{settings.bankDetails}</p>
                <p className="mt-2 text-sky-700/80">{settings.footerMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Auth Modal */}
      {adminAuthPrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Otorisasi Admin</h3>
                  <p className="text-xs text-slate-500">
                    Tindakan ini membutuhkan persetujuan Admin/Manager.
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handleAdminAuth} className="p-6">
              {adminAuthError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium rounded-lg text-center">
                  {adminAuthError}
                </div>
              )}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Masukkan PIN Admin</label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="****"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-center tracking-widest text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAdminAuthPrompt(null);
                    setAdminPin('');
                    setAdminAuthError('');
                  }}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Setujui
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

