# PROGRESS TRACKER — DesignDesk

> Catatan kontinuitas antar-sesi/model. Update file ini setiap kali menyelesaikan langkah.
> Terakhir diperbarui: 2026-06-17.

## Konteks singkat
DesignDesk = app manajemen permintaan desain (Next.js 16 / TS / Supabase PG17). Dokumentasi sistem lengkap ada di [sistem.md](sistem.md). Rencana detail task aktif ada di `/Users/user/.claude/plans/cozy-knitting-prism.md`.

**DB**: app menunjuk ke Supabase **baru** (project `lzigxaimvgxerbzwzpbb`) via `.env` (gitignored). DB lama (kantor `qwyvtnclfaeskczlhsfw`) **TIDAK BOLEH disentuh**.
**Connection string DB baru** (untuk apply migration via psql) diberikan user di chat — minta lagi bila perlu, jangan simpan ke file. Apply pakai: `psql "$NEW_DB" -v ON_ERROR_STOP=1 -f <file.sql>`.

## Gotchas penting
- `head` di shell ini ter-shadow binary lain → JANGAN pipe ke `head`. Pakai `sed -n '1,40p'` atau `grep` saja.
- eslint `@typescript-eslint/no-unused-vars` = **off** & tsconfig tanpa `noUnusedLocals` → import/var tak terpakai TIDAK menggagalkan build. Tak perlu kejar-kejar unused import.
- Verifikasi build: `npx tsc --noEmit` lalu `npm run build`.
- Tidak ada service_role key di kode (hanya anon key). Logika berat → DB function/trigger.
- RLS `permintaan`/`users` sengaja `USING(true)` (longgar) — guard akses = client-side via `hooks/use-role-guard.ts`. JANGAN perketat RLS (di luar scope).

---

## TASK 1 — Pemisahan Role (requester/admin/designer) — ✅ SELESAI & TER-APPLY
- Migration `supabase/migrations/20260617175117_role-separation.sql` — applied ke DB baru, verified.
- Role: `user`→`requester`, tambah `designer`, CHECK constraint, default `requester`. Kolom `permintaan.admin` → **`assigned_designer`** (FK `permintaan_assigned_designer_fkey`). `handle_new_user` default `requester`. Policy `komentar` pakai `assigned_designer`.
- Helper `lib/auth/roles.ts`, guard `hooks/use-role-guard.ts`, `components/status-badge.tsx`.
- Sidebar dinamis `getNavItemsByRole` di `components/app-sidebar.tsx`.
- Requester: `permintaan-desain` (list + `[id]` tanpa kontrol admin) + `buat` (guard requester).
- Admin monitoring-only: `permintaan-desain-admin` (list + filter departemen/penanganan, `[id]` read-only) + `buat`.
- Designer (BARU): `permintaan-desain-designer/{page (antrean+self-assign atomik), tugas-saya, [id] (eksekusi)}`.
- `riwayat-pengerjaan` → milik designer (filter `assigned_designer`).
- `laporan-kpi/page.tsx` (stub saat itu — sekarang akan diisi di Task 2).
- user-management 3 opsi role; dashboard role-aware.
- `sistem.md` diperbarui. Build & tsc LULUS.

## TASK 2 — Kalkulasi KPI — ✅ SELESAI (backend applied + frontend, build LULUS)
Plan: `/Users/user/.claude/plans/cozy-knitting-prism.md` (versi KPI).

### ✅ Backend (applied ke DB & terverifikasi)
- [x] Migration `supabase/migrations/20260617182445_kpi-scoring.sql` — **applied ke DB baru & terverifikasi**.
  - Kolom baru di `permintaan`: `completed_at`, `assigned_at`, `rating_numeric`, `skor_ketepatan_waktu`, `skor_kualitas`, `skor_kpi_akhir`.
  - Constraint: `rating_numeric_check (1..5)`, `permintaan_status_check`.
  - Function `calculate_kpi_score(bigint)`; trigger `trg_permintaan_done` (BEFORE UPDATE, isi completed_at snapshot + assigned_at); trigger `trg_kpi_recalc` (AFTER UPDATE WHEN completed_at/rating_numeric berubah — anti-rekursi).
  - `get_dashboard_stats()` diperbarui: pakai `rating_numeric`, isi `rataRataWaktuPengerjaan` (hari, dari assigned_at→completed_at), tambah `rataRataSkorKPI`.
  - RPC baru `get_designer_kpi_report(p_designer uuid, p_start date, p_end date)` → json array per desainer {designer_id, designer_name, jumlah_selesai, avg_ketepatan, avg_kualitas, avg_kpi, tiket_perlu_perhatian[<60]}.
  - Formula: ketepatan on-time=100, telat=100-10*(hari telat) floor 0; kualitas=rating*20; akhir=0.35*ketepatan+0.65*kualitas (null bila salah satu null). Uji manual: ON-TIME→100, LATE 3hari+rating4→76.5. ✓

### ✅ Frontend (selesai, build LULUS)
- [x] `permintaan-desain/[id]` (requester): tulis `rating_numeric`, done-card pakai `rating_numeric`.
- [x] `permintaan-desain-designer/page.tsx`: set `assigned_at` saat Ambil Tugas.
- [x] Komponen baru `components/kpi-scores.tsx` (skor read-only) dipakai di detail designer & admin.
- [x] `riwayat-pengerjaan/ClientComponent.tsx`: panel KPI pribadi real via `get_designer_kpi_report`.
- [x] `dashboard/page.tsx`: kartu `rataRataSkorKPI` & `rataRataWaktuPengerjaan` (admin).
- [x] `laporan-kpi/page.tsx`: tabel real + filter periode & dropdown desainer.
- [x] `sistem.md` diperbarui (kolom/trigger/RPC KPI).
- [x] `npx tsc --noEmit` + `npm run build` LULUS.

### Catatan uji manual KPI (belum dilakukan via UI — perlu akun nyata)
DB-level sudah diuji (ON-TIME→100, LATE 3hari+rating4→76.5). Uji UI end-to-end menunggu user membuat akun requester+designer & promosi role (lihat instruksi di bawah).

## Addendum (perbaikan & tambahan kecil)
- **Bugfix**: `permintaan-desain/buat/page.tsx` dulu import `next/router` (Pages Router) → ganti `useRouter` dari `next/navigation`. (Error "No router instance found" saat buat desain.)
- **Akun demo** (DB baru): `requester@demo.com` / `designer@demo.com` / `admin@demo.com`, password **demo1234** (diset via SQL `crypt(... gen_salt('bf'))`; diverifikasi via endpoint `/auth/v1/token` → HTTP 200, login OK di layer auth).
- **Laporan KPI export**: tambah tombol **Excel** (lib `xlsx`, 2 sheet: Ringkasan + Tiket Perlu Perhatian) & **Cetak PDF** (`jspdf` + `jspdf-autotable` v5, API fungsional `autoTable(doc,{})`). Dep baru: `jspdf`, `jspdf-autotable`.

## TASK 3+ — Belum dimulai
- Pengetatan RLS (`permintaan`/`users` masih `USING(true)`) — task terpisah, BELUM dikerjakan.
- (Opsional) chart Recharts tren KPI di dashboard — belum, hanya kartu angka.
