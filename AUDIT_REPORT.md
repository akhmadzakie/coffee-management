# AUDIT_REPORT — Coffee Management

> Tahap 1 (read-only). Spesifikasi: `mind_map_aplikasi_v2.md`. Tanggal: 2026-10-07.
> Tidak ada kode yang diubah.

## Ringkasan

| Status | Jumlah |
|---|---|
| ✅ Sesuai | 2 |
| ⚠️ Sebagian | 6 |
| ❌ Belum ada / salah | 10 |
| ❓ Belum diperiksa mendalam | 4 |

## 🚨 Temuan Kritis (di luar daftar, paling mendesak)

| # | Temuan | Bukti | Dampak |
|---|---|---|---|
| K1 | **Clock In/Out, Jadwal Kerja, dan Leader Checklist TIDAK PERNAH tersimpan ke database.** Client mengirim `dailyAttendances`, `employeeShifts`, `dailyChecklists`, tapi `POST /api/sync` tidak men-destructure dan tidak meng-insert ketiganya. `GET /api/sync` juga tidak mengembalikan `dailyAttendances`. | `server.ts:784-1033`, `server.ts:748-777`, `StoreContext.tsx:642-646` | Data hilang saat refresh/ganti perangkat. Kemungkinan besar ini penyebab keluhan "rekap absensi tidak terupdate". |
| K2 | `employee_shifts` dan `daily_checklists` dipakai di destructuring tanpa `let`. | `server.ts:629,631` vs deklarasi `589-613` | Di dev (`tsx`, ESM strict) → ReferenceError → API jatuh ke data fallback. Di produksi (esbuild CJS) jadi variabel global implisit — jalan, tapi rapuh. |
| K3 | **`POST /api/sync` tanpa autentikasi/role** dan menghapus lalu menulis ulang seluruh tabel (termasuk `users`, `payroll_records`, `audit_logs`). | `server.ts:784-889` | Siapa pun yang tahu URL bisa menghapus semua data atau menjadikan dirinya SUPER_ADMIN. Juga: dua perangkat menyimpan bersamaan → data salah satunya tertimpa. |
| K4 | **`GET /api/sync` tanpa autentikasi mengembalikan semua user beserta PIN plaintext.** Login dicek di browser. | `server.ts:428,752`, `StoreContext.tsx:702` | Semua PIN bisa dibaca dari tab Network. Default admin `admin/1234`. |
| K5 | Tanggal absensi memakai `toISOString()` (UTC). | `ClockIn.tsx:22` | Di WITA (UTC+8), Clock In sebelum jam 08:00 tercatat sebagai **hari kemarin**. |
| K6 | Audit log dikirim dari client dan ikut tertimpa oleh `/api/sync`. | `server.ts:836-838, 980-990` | Audit log bisa dihapus/diubah oleh client — tidak bisa dipercaya. |

## Tabel Poin Audit

| No | Poin | Status | Bukti | Temuan | Saran | Prioritas |
|---|---|---|---|---|---|---|
| 1 | Auth + role di server | ❌ | `server.ts:1211-1249` | `rbacMiddleware` hanya membaca header `x-user-role` yang bisa dipalsukan, dan hanya dipasang di `/api/:table`. `/api/sync`, `/api/payroll/calculate`, `/api/import/sales`, `/api/sessions/*` tanpa cek. | Login di server → token sesi; role diambil dari DB, bukan header. | Tinggi |
| 2 | Role rendah bisa panggil endpoint sensitif | ❌ | idem | Ya, lewat `/api/sync`. | Ikut #1. | Tinggi |
| 3 | Hash password, secret di env, rate limit | ❌ | `server.ts:25,428` | PIN plaintext, tidak ada rate limit. | Hash PIN (bcrypt/scrypt), rate limit login. | Tinggi |
| 4 | Matriks role sesuai | ❓ | `Layout.tsx`, `App.tsx` | Belum dibandingkan baris per baris. `rbacMiddleware` memuat role `ADMIN_OPERASIONAL` yang tidak ada di daftar role aplikasi. | Samakan daftar role di satu konstanta bersama. | Sedang |
| 4b | OWNER read-only | ⚠️ | `server.ts:1222` | Ditolak di `/api/:table`, tapi OWNER tetap bisa menulis lewat `/api/sync`. | Ikut #1. | Tinggi |
| 5 | Import penjualan tolak duplikat | ❌ | `server.ts:1285-1318` | Tidak ada pengecekan. | Unique key (tanggal + no. transaksi), tolak file dengan hash sama. | Tinggi |
| 6 | Resep/BOM + potong stok | ❌ | `schema.ts` | Tidak ada tabel resep. | Tabel `recipes`/`recipe_items`. | Tinggi |
| 7 | Pendapatan dari >1 sumber | ❓ | `CashFlow.tsx`, `ShiftManagement.tsx` | Perlu ditelusuri apakah tutup shift membuat `cash_transactions`. | Tetapkan satu sumber pendapatan. | Tinggi |
| 8 | Shift menghitung selisih kas | ✅ | `server.ts:562-582` | Ada `expectedEndingCash`, `actualEndingCash`, `difference`. | — | — |
| 9 | Status bayar pembelian | ❓ | `Purchases.tsx` | Belum ditelusuri. | — | Tinggi |
| 10 | Hutang Supplier | ❌ | `schema.ts` | Tidak ada tabel/modul. | — | Sedang |
| 11 | Durasi kerja, lupa Clock Out, lewat tengah malam | ❌ | `ClockIn.tsx:22-31` | Kunci per tanggal UTC; shift malam terpecah; data juga tidak tersimpan (K1). | Simpan timestamp penuh, tanggal = tanggal lokal saat Clock In. | Tinggi |
| 12 | Zona waktu konsisten | ❌ | `ClockIn.tsx:22`, `server.ts:1455` | Campuran UTC dan waktu lokal server. | Satu util tanggal dengan zona kafe. | Tinggi |
| 13 | Approval lembur | ❌ | `Payroll.tsx:92,389` | Lembur default 0, diedit manual tanpa approval. | Sesuai keputusan pemisahan tugas. | Sedang |
| 14 | Status Draft/Final/Dibayar + kunci | ⚠️ | `server.ts:156,1505-1509` | Status ada (DRAFT/APPROVED/PAID), tapi tidak ada penguncian edit di server. | Tolak update jika status PAID. | Tinggi |
| 15 | Rumus payroll | ⚠️ | `Payroll.tsx:82-95` vs `server.ts:1410-1415` | **Dua rumus berbeda.** Client: hari hadir × gaji harian (sesuai). Server `/api/payroll/calculate`: gaji bulanan − potongan alpha, dan membaca `k.year`/`k.quarter` yang tidak ada di `kpi_records` → bonus KPI selalu 0. | Hapus atau samakan endpoint server. | Tinggi |
| 16 | Checklist → KPI/bonus | ⚠️ | `Payroll.tsx:86` | Bonus SOP memakai `cleaningDone && equipmentChecked`, **bukan** `leaderTasks`. Datanya juga tidak tersimpan (K1). | Hitung dari `leaderTasks`. | Rendah |
| 17 | Rekonsiliasi pakai mutasi import | ⚠️ | `server.ts:64-74` | Tabel `bank_statement_lines` + `matched_transaction_id` ada; alur UI belum diverifikasi. | — | Sedang |
| 18 | Tutup Periode | ❌ | — | Tidak ada. | — | Sedang |
| 19 | Laporan = Cash Flow | ❓ | `FinanceReports.tsx` | Belum diverifikasi. | — | Sedang |
| 20 | Cakupan Audit Log | ⚠️ | `server.ts:1251-1283` | Hanya `/api:table`; aksi via `/api/sync` dicatat client (K6). | Tulis audit di server. | Sedang |
| 21 | FK & indeks | ⚠️ | `server.ts:95-162` | Sebagian FK ada; `payroll_records.employee_id` tanpa FK; tanggal disimpan TEXT; tidak ada unique `(employee_id, period)`. | Tambah constraint. | Sedang |
| 22 | Backup DB | ❓ | `railway.toml` | Tidak terlihat di repo. | Aktifkan backup Railway Postgres. | Sedang |
| — | Stock opname | ✅ | `server.ts:75-94` | Tabel ada dengan selisih otomatis. | — | — |

## Bug & Risiko Tambahan
- `start` menjalankan `drizzle-kit push --force` setiap deploy → perubahan skema bisa menghapus kolom tanpa konfirmasi (`package.json:10`).
- Body limit 50 MB + foto selfie base64 disimpan di state → payload `/api/sync` membengkak setiap simpan.
- Heartbeat sesi setiap 5 detik per perangkat (`StoreContext.tsx:603-606`).
- `setDailyChecklists`/`setEmployeeShifts` (fungsi) ikut dikirim di body sync (`StoreContext.tsx:644,646`) — tidak berbahaya, tapi tanda kode salah tempel.

## Urutan Perbaikan yang Disarankan
1. **K1 + K2** — simpan `dailyAttendances`, `employeeShifts`, `dailyChecklists` di server (perbaikan kecil, dampak besar).
2. **K5** — tanggal lokal untuk Clock In.
3. **Payroll** — satu rumus, kunci status PAID.
4. **K3/K4/#1** — login di server, sembunyikan PIN, lindungi `/api/sync` (perubahan lebih besar, perlu rencana).
5. Duplikat import, BOM, hutang supplier, tutup periode.
