---
name: nextjs-app-conventions
description: Konvensi struktur dan kode Next.js (App Router, TypeScript, Server Actions, Zod, Prisma) untuk proyek ini. Gunakan skill ini setiap kali membuat halaman, komponen, server action, route handler, atau folder baru.
---

# Next.js Conventions

## Struktur
```
src/
├── app/            # routing saja: page.tsx, layout.tsx, route.ts
│   ├── (auth)/login
│   └── (dashboard)/pos, orders, inventory, reports, settings
├── features/       # logika per domain
│   ├── orders/     { actions.ts, queries.ts, schema.ts, components/ }
│   ├── inventory/
│   └── reports/
├── lib/            # db.ts, auth.ts, permissions.ts, money.ts, dates.ts
└── components/ui/  # komponen umum (shadcn/ui)
```

## Aturan
1. Default Server Component. Pakai "use client" hanya untuk state, event, atau browser API, di komponen sekecil mungkin.
2. Mutasi lewat Server Action di `features/<domain>/actions.ts`; baca data lewat `queries.ts`.
3. Validasi semua input dengan Zod di server.
4. Server Action mengembalikan `{ ok: true, data } | { ok: false, error }`, bukan melempar error mentah ke UI.
5. Setelah mutasi, panggil `revalidatePath` atau `revalidateTag`.
6. Jangan akses Prisma langsung dari komponen UI.
7. Format uang dan tanggal lewat `lib/money.ts` dan `lib/dates.ts`.
8. Halaman data wajib punya `loading.tsx` dan `error.tsx`.
9. Jangan menaruh secret di komponen client.

## Checklist
- [ ] Tanpa `any`
- [ ] Validasi Zod ada
- [ ] Cek otorisasi ada (skill role-access)
- [ ] Ada state loading dan error
