# Resep Komponen & Pola Layar Julia's

Kumpulan pola JSX siap pakai agar modul/fitur baru langsung selaras dengan standar anti-flat, light/dark mode, `motion/react`, dan komponen wajib Julia's.

---

## (a) Kartu KPI Soft-Tinted (Anti-Flat & Siap Dark Mode)

```tsx
<div className="bg-gradient-to-br from-emerald-50/60 via-white to-white dark:from-emerald-500/15 dark:via-slate-900 dark:to-slate-900 rounded-2xl border border-emerald-200/70 dark:border-emerald-500/30 p-4 sm:p-5 shadow-coffee-sm hover:shadow-coffee transition-all">
  <div className="flex items-start justify-between gap-3">
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Pemasukan Kas (IN)
      </p>
      <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
        {formatCurrency(totalIn)}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Total dana masuk tercatat
      </p>
    </div>
    <div className="w-10 h-10 rounded-xl bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
      <TrendingUp className="w-5 h-5" />
    </div>
  </div>
</div>
```

Varian sapuan KPI lainnya:
- Utama / Likuiditas: `from-brand-50/60 ... border-brand-200/70` (`dark:from-brand-500/15 dark:border-brand-500/30`)
- Pengeluaran / Bahaya: `from-rose-50/60 ... border-rose-200/70` (`dark:from-rose-500/15 dark:border-rose-500/30`)
- Peringatan / Pending: `from-amber-50/60 ... border-amber-200/70` (`dark:from-amber-500/15 dark:border-amber-500/30`)
- Informasi / Benchmark: `from-sky-50/60 ... border-sky-200/70` (`dark:from-sky-500/15 dark:border-sky-500/30`)

---

## (b) Kerangka Halaman Back-Office (Header + KPI + Filter Inset + Tabel)

```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
  className="space-y-5"
>
  {/* Lapisan 2: Header Kartu + CTA Utama Biru Brand */}
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-coffee-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30">
        <Wallet className="w-3.5 h-3.5" />
        Modul Keuangan
      </span>
      <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-2">
        Judul Halaman Modul
      </h1>
      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
        Ringkasan singkat fungsi halaman ini.
      </p>
    </div>

    <div className="flex items-center gap-2.5 shrink-0">
      <button
        type="button"
        onClick={onSecondary}
        className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
      >
        Ekspor Excel
      </button>
      <button
        type="button"
        onClick={onPrimary}
        className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm shadow-brand-600/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>Tambah Data</span>
      </button>
    </div>
  </div>

  {/* Baris KPI Soft-Tinted */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {/* Kartu KPI ... */}
  </div>

  {/* Lapisan 2 + Lapisan 3 Inset Toolbar Filter & Tabel */}
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-coffee-sm overflow-hidden">
    <div className="p-4 bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
      {/* Filter dengan CustomSelect / CustomMonthPicker / CustomDatePicker */}
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <th className="py-3 px-4">Item</th>
            <th className="py-3 px-4 text-right tabular-nums">Nominal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          {/* Baris data atau Empty State */}
        </tbody>
      </table>
    </div>
  </div>
</motion.div>
```

---

## (c) Modal `motion/react` Berbasis Portal (`AnimatePresence` di Dalam Portal)

```tsx
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

{createPortal(
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", damping: 28, stiffness: 360 }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header, Body scrollable, Footer */}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>,
  document.body
)}
```

> Catatan: Untuk modal terpisah yang dirender bersyarat oleh parent tanpa prop `isOpen`, bungkus mount di parent dengan `<AnimatePresence>{showModal && <MyModal onClose={...} />}</AnimatePresence>`.

---

## (d) Toast Notifikasi Ringan (`motion/react` Portal — Pengganti `alert()`)

```tsx
{createPortal(
  <AnimatePresence>
    {toast && (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={`fixed bottom-5 right-5 z-[9999] max-w-sm px-4 py-3 rounded-2xl border shadow-coffee-lg flex items-center gap-2.5 text-xs font-semibold ${
          toast.type === "error"
            ? "bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200"
            : "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
        }`}
      >
        {toast.type === "error" ? (
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <span>{toast.message}</span>
      </motion.div>
    )}
  </AnimatePresence>,
  document.body
)}
```

---

## (e) Panduan Singkat Komponen Bersama (`src/components/common/`)

### 1. `CustomSelect` (Pengganti `<select>`)
```tsx
import { CustomSelect } from "./common/CustomSelect";

<CustomSelect
  value={selectedId}
  onChange={(val) => setSelectedId(val)}
  placeholder="Pilih kategori..."
  searchable
  searchPlaceholder="Cari kategori..."
  options={[
    { value: "OPS", label: "Operasional", badge: "OPEX" },
    { value: "BAHAN", label: "Bahan Baku", badge: "COGS" },
  ]}
/>
```

### 2. `CustomDatePicker` (Pengganti `<input type="date">`)
```tsx
import { CustomDatePicker } from "./common/CustomDatePicker";

<CustomDatePicker
  value={dateStr} // format "YYYY-MM-DD"
  onChange={(nextDate) => setDateStr(nextDate)}
  placeholder="Pilih tanggal"
  allowClear
/>
```

### 3. `CustomMonthPicker` (Pengganti `<input type="month">`)
```tsx
import { CustomMonthPicker } from "./common/CustomMonthPicker";

// Mode string "YYYY-MM"
<CustomMonthPicker
  value={selectedPeriod}
  onChange={(nextPeriod) => setSelectedPeriod(nextPeriod)}
/>

// Atau Mode numerik bulan (0-11 atau -1 untuk "Semua Bulan") & tahun
<CustomMonthPicker
  month={filterMonth}
  year={filterYear}
  onMonthYearChange={(m, y) => {
    setFilterMonth(m);
    setFilterYear(y);
  }}
  allowAllMonths
/>
```

### 4. `ConfirmModal` (Pengganti `window.confirm()`)
```tsx
import { ConfirmModal } from "./common/ConfirmModal";

<ConfirmModal
  isOpen={Boolean(deleteTarget)}
  variant="danger"
  title="Hapus Transaksi?"
  message="Data yang dihapus akan dicatat di audit log."
  confirmLabel="Ya, Hapus"
  cancelLabel="Batal"
  verifyKeyword="HAPUS" // Opsional untuk aksi kritikal
  onConfirm={handleConfirmDelete}
  onCancel={() => setDeleteTarget(null)}
/>
```
