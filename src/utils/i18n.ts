export const translations = {
  en: {
    dashboard: "Dashboard",
    products: "Products (Master)",
    clients: "Clients (Cafes)",
    suppliers: "Suppliers",
    inventory: "Inventory",
    sales: "Sales & Invoicing",
    purchases: "Purchases (Restock)",
    finance: "Finance",
    commissions: "Sales & Commissions",
    settings: "Settings",
    // general
    save: "Save",
    cancel: "Cancel",
    add: "Add",
    edit: "Edit",
    delete: "Delete",
    exportCsv: "Export CSV",
    // dashboard
    netProfit: "Net Profit",
    assetModal: "Asset Modal",
    assetJual: "Asset Jual",
    receivables: "Receivables (Piutang)",
    cashFlow: "Cash Flow (Last 7 Days)",
    bestSelling: "Best Selling Products",
    topSpenders: "Top Spenders (Clients)",
    stockAlerts: "Stock Alerts",
    welcome: "Welcome back, here's your business overview.",
    cash_flow: "Cash Flow",
    import_sales: "Import Sales",
    users: "Users",
    audit_log: "Audit Log",
    shifts: "Shift & Cashier",
    hr: "HR & Payroll",
  },
  id: {
    dashboard: "Dasbor",
    products: "Produk (Master)",
    clients: "Klien (Kafe)",
    suppliers: "Pemasok",
    inventory: "Inventaris (Gudang)",
    sales: "Penjualan (Kasir)",
    purchases: "Pembelian (Restok)",
    finance: "Keuangan",
    commissions: "Komisi Sales",
    settings: "Pengaturan",
    // general
    save: "Simpan",
    cancel: "Batal",
    add: "Tambah",
    edit: "Ubah",
    delete: "Hapus",
    exportCsv: "Ekspor CSV",
    // dashboard
    netProfit: "Laba Bersih",
    assetModal: "Aset Modal",
    assetJual: "Aset Jual",
    receivables: "Piutang Usaha",
    cashFlow: "Arus Kas (7 Hari Terakhir)",
    bestSelling: "Produk Terlaris",
    topSpenders: "Pelanggan Terbesar",
    stockAlerts: "Peringatan Stok",
    welcome: "Selamat datang kembali, ini adalah ringkasan bisnis Anda.",
    cash_flow: "Arus Kas",
    import_sales: "Impor Penjualan",
    users: "Pengguna",
    audit_log: "Audit Log",
    shifts: "Shift & Kasir",
    hr: "SDM & Payroll",
  },
};

export type Language = "en" | "id";
export type TranslationKey = keyof typeof translations.en;

export const useTranslation = (lang: Language) => {
  return {
    t: (key: TranslationKey): string => {
      return translations[lang][key] || translations.en[key] || key;
    },
  };
};
