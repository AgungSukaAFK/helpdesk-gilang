# Dokumentasi Sistem — Helpdesk / Design Request Management

> Ringkasan sistem informasi dan struktur database untuk keperluan analisis.
> Dibuat: 2026-06-17. Sumber kebenaran: kode aplikasi + schema database Supabase.

---

## 1. Gambaran Umum

Sistem ini adalah **aplikasi manajemen permintaan desain (design request / helpdesk)** internal perusahaan. Karyawan dari berbagai departemen mengajukan permintaan pembuatan desain (mis. materi marketing, dokumen, dsb.), lalu tim desainer/admin mengerjakannya. Alur kerja meliputi pengajuan → pengerjaan → review → revisi → selesai, dilengkapi komentar, lampiran file, serta penilaian (rating & review).

Aplikasi memiliki **tiga peran terpisah** (`public.users.role`):
- **Requester (`requester`)** — staf pemohon: membuat permintaan, memantau progres, meminta revisi, menyetujui hasil, memberi rating.
- **Admin (`admin`)** — koordinator Divisi Desain Grafis: **monitoring read-only** seluruh tiket, kelola pengguna, akses Laporan KPI, eskalasi. **Admin tidak lagi mengeksekusi tiket** (agar KPI desainer tidak bias).
- **Desainer (`designer`)** — eksekutor: melihat antrean tiket terbuka (pool-based), **mengambil tugas mandiri (self-assignment)**, mengerjakan, mengunggah hasil, berkomunikasi via komentar, melihat KPI pribadi.

---

## 2. Tech Stack

| Lapisan | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Bahasa | TypeScript |
| Backend / DB | Supabase (PostgreSQL 17.6) |
| Auth | Supabase Auth (`@supabase/ssr`, session via cookie) |
| Storage | Supabase Storage (bucket file) |
| UI | Tailwind CSS v4, Radix UI, shadcn-style components, lucide-react |
| State | Zustand (UI state ringan: toggle menu) |
| Chart | Recharts |
| Util | date-fns, xlsx (export Excel), sonner (toast) |

Akses Supabase dari klien hanya memakai **URL + anon key** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`). Tidak ada penggunaan service_role key di kode; keamanan data bergantung pada **Row Level Security (RLS)** di database.

---

## 3. Autentikasi & Peran

- Registrasi/login dikelola Supabase Auth (`auth.users`).
- Saat user baru mendaftar, **trigger `on_auth_user_created`** di `auth.users` memanggil fungsi `handle_new_user()` yang otomatis membuat baris di `public.users` dengan `role = 'requester'` (default) dan `name = null`.
- Kolom `role` dibatasi CHECK constraint `users_role_check` → hanya boleh `'requester' | 'admin' | 'designer'`.
- Untuk menjadikan seseorang admin/desainer, ubah `public.users.role` (via halaman User Management atau SQL manual).
- Pemeriksaan peran terpusat di **`lib/auth/roles.ts`** (`isRequester/isAdmin/isDesigner/canExecuteTickets/canMonitorAll`, `normalizeRole`). Hindari membandingkan string role manual.
- Guard akses antar-role bersifat **client-side** (hook `hooks/use-role-guard.ts` me-redirect role yang tidak berwenang ke `/dashboard`). RLS sengaja masih longgar (lihat §9), jadi guard ini lapisan pembatas utama.

Migrasi schema role/kolom ada di `supabase/migrations/20260617175117_role-separation.sql`.

Halaman auth: `login`, `sign-up`, `sign-up-success`, `forgot-password`, `update-password`, `auth/confirm` (verifikasi), `auth/error`.

---

## 4. Fitur & Halaman Utama

Layout utama berada di grup `(With Sidebar)`:

| Halaman | Peran | Fungsi |
|---|---|---|
| `dashboard` | Semua | Statistik ringkas + aktivitas terkini, di-scope per role (admin: global; designer: `assigned_designer = dirinya`, kartu "Baru" = antrean terbuka; requester: `requester = dirinya`). |
| `permintaan-desain` | Requester | Daftar permintaan miliknya + buat baru. |
| `permintaan-desain/buat` | Requester | Form pengajuan: judul, deskripsi, proyek, departemen, due date, lampiran. Status awal `TO DO`. |
| `permintaan-desain/[id]` | Requester | Detail: pantau status, komentar, minta revisi, setujui (DONE), beri rating. **Tanpa kontrol eksekusi.** |
| `permintaan-desain-admin` | Admin | **Monitoring read-only** seluruh tiket + filter status/penanganan/departemen/tanggal. |
| `permintaan-desain-admin/[id]` | Admin | Detail **read-only** (pengawasan/eskalasi) — tanpa ambil/ubah status/unggah. |
| `permintaan-desain-admin/buat` | Admin | Admin membuat permintaan atas nama user (dipertahankan). |
| `laporan-kpi` | Admin | Laporan KPI desainer — **stub**, akan di-wire ke RPC `get_designer_kpi_report`. |
| `user-management`, `user-management/[userid]` | Admin | Kelola pengguna; ubah role (requester/admin/designer). |
| `permintaan-desain-designer` | Desainer | **Antrean Tugas**: tiket `TO DO` belum di-assign; tombol "Ambil Tugas" (self-assignment atomik). |
| `permintaan-desain-designer/tugas-saya` | Desainer | Tiket yang ia tangani (`assigned_designer = dirinya`). |
| `permintaan-desain-designer/[id]` | Desainer | Eksekusi: ubah status, unggah hasil ke bucket `hasil-desain`, komentar. Guard: hanya desainer yang di-assign. |
| `riwayat` | Requester | Riwayat permintaan miliknya. |
| `riwayat-pengerjaan` | Desainer | Riwayat pekerjaan selesai miliknya + panel KPI pribadi (stub). |
| `profile` | Semua | Profil pengguna. |
| `feedback`, `dokumentasi`, `tentang-app` | Semua | Halaman pendukung. |

Menu sidebar dinamis per role via `getNavItemsByRole(role)` di `components/app-sidebar.tsx`.

Ekspor data ke Excel tersedia (library `xlsx`).

---

## 5. Siklus Status Permintaan (`permintaan.status`)

Nilai status disimpan sebagai **text** (bukan enum DB), dikendalikan di sisi aplikasi:

```
TO DO ──(desainer ambil)──▶ PROGRESS ──(desainer selesai)──▶ REVIEW
                              ▲                                  │
                              │                                  ├─(requester setuju)──▶ DONE ──▶ rating & review
                              └──────(requester minta revisi)───┘
                                            REVISION
```

| Status | Arti | Dipicu oleh |
|---|---|---|
| `TO DO` | Baru diajukan, belum diambil (ada di antrean) | Requester membuat permintaan |
| `PROGRESS` | Sedang dikerjakan; `assigned_designer` terisi | **Desainer** mengambil tugas (self-assignment) |
| `REVIEW` | Hasil selesai, menunggu review requester | Desainer menandai selesai |
| `REVISION` | Requester meminta perbaikan | Requester minta revisi |
| `DONE` | Disetujui & selesai | Requester menyetujui |

Setelah `DONE`, requester dapat mengisi `rating` dan `review`. **Admin tidak terlibat dalam transisi status** (hanya monitoring).

---

## 6. Struktur Database

### 6.1 Skema yang dipakai
- **`public`** — tabel & logika aplikasi (di bawah).
- **`auth`** — dikelola Supabase (`auth.users` sumber identitas).
- **`storage`** — bucket & objek file (Supabase Storage).

### 6.2 Tabel `public.users`
Profil aplikasi untuk tiap akun auth (1:1 dengan `auth.users`).

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` **PK** | = `auth.users.id` (FK) |
| `created_at` | `timestamptz` | default `now()` |
| `role` | `text` | default `'requester'`; CHECK `users_role_check` → `'requester' \| 'admin' \| 'designer'` |
| `name` | `text` | nama tampilan (nullable) |

- **FK**: `id → auth.users(id)`
- **RLS**: aktif. Policy `"Public"` — `ALL USING (true)` (akses penuh; pembatasan ada di sisi app).

### 6.3 Tabel `public.permintaan`
Entitas inti: satu permintaan desain.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `bigint` **PK** | identity (BY DEFAULT) |
| `created_at` | `timestamptz` | default `now()` |
| `due_date` | `date` | tenggat |
| `judul` | `text` | judul permintaan |
| `deskripsi` | `text` | deskripsi kebutuhan |
| `status` | `text` | lihat §5 |
| `departemen` | `text` | departemen pemohon |
| `rating` | `text` | rating lama (arsip; tidak dipakai logika baru) |
| `rating_numeric` | `numeric` | rating 1–5 (CHECK 1..5); sumber `skor_kualitas` |
| `review` | `text` | ulasan user |
| `files` | `json` | metadata/daftar lampiran (path di Storage) |
| `requester` | `uuid` | pemohon |
| `assigned_designer` | `uuid` | **desainer yang mengambil/mengerjakan tiket** (dulu bernama `admin`; jadi acuan KPI) |
| `project` | `text` | jenis proyek (ada opsi "Lainnya"/custom) |
| `catatan_revisi` | `text` | catatan saat status REVISION |
| `assigned_at` | `timestamptz` | waktu tiket diambil desainer (untuk durasi kerja) |
| `completed_at` | `timestamptz` | waktu tiket pertama kali DONE (snapshot, diisi trigger) |
| `skor_ketepatan_waktu` | `numeric` | 0–100 (lihat §7 KPI) |
| `skor_kualitas` | `numeric` | `rating_numeric * 20` |
| `skor_kpi_akhir` | `numeric` | `0.35·ketepatan + 0.65·kualitas` |

- **Constraint**: `permintaan_status_check` (status ∈ 5 nilai §5), `rating_numeric_check` (1..5).

- **FK**:
  - `requester → auth.users(id)`
  - `requester → public.users(id)` *(ada dua FK pada kolom `requester` — lihat §9 Catatan)*
  - `assigned_designer → public.users(id)` (constraint `permintaan_assigned_designer_fkey`)
- **RLS**: aktif. Policy `"public"` — `ALL USING (true)`.

### 6.4 Tabel `public.komentar`
Komentar/diskusi pada sebuah permintaan.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `bigint` **PK** | identity (ALWAYS) |
| `created_at` | `timestamptz` | default `now()` |
| `permintaan_id` | `bigint` | permintaan terkait |
| `user_id` | `uuid` | penulis komentar |
| `message` | `text` | isi komentar |

- **FK**:
  - `permintaan_id → permintaan(id)` **ON DELETE CASCADE**
  - `user_id → auth.users(id)`
- **RLS**: aktif, dua policy:
  - **SELECT** `"Users can view comments on their requests"` — boleh dilihat jika `auth.uid()` adalah `requester` atau `assigned_designer` dari permintaan terkait, **atau** user ber-`role = 'admin'`.
  - **INSERT** `"Users can insert comments on their requests"` — syarat sama (WITH CHECK).

### 6.5 View `public.user_profiles`
Gabungan identitas auth + profil aplikasi (dipakai untuk menampilkan nama/email pemohon).

```sql
SELECT au.id,
       au.email,
       au.raw_user_meta_data,
       au.created_at AS auth_created_at,
       u.role,
       u.name,
       u.created_at AS user_created_at
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id;
```

### 6.6 Relasi (ringkas)

```
auth.users (1) ──< public.users (1:1)
auth.users (1) ──< permintaan.requester
public.users (1) ──< permintaan.requester
public.users (1) ──< permintaan.assigned_designer
permintaan (1) ──< komentar (N)   [ON DELETE CASCADE]
auth.users (1) ──< komentar.user_id
```

---

## 7. Fungsi / Stored Procedures (RPC)

| Fungsi | Tipe kembalian | Fungsi |
|---|---|---|
| `get_dashboard_stats()` | `json` | `permintaanBaru` (7 hari), `sedangDikerjakan` (PROGRESS), `menungguRevisi` (REVISION), `selesaiBulanIni` (DONE bulan ini), `rataRataRating` (AVG `rating_numeric`), `rataRataWaktuPengerjaan` (AVG hari `completed_at−assigned_at`), `rataRataSkorKPI` (AVG `skor_kpi_akhir`). |
| `get_daily_request_trend(days_limit int)` | `TABLE(request_date text, total bigint)` | Jumlah permintaan per hari untuk `days_limit` hari terakhir. |
| `handle_new_user()` | `trigger` | SECURITY DEFINER. Sisipkan baris `public.users` (role `requester`) saat signup. |
| `calculate_kpi_score(p_id bigint)` | `void` | Hitung & simpan ketiga skor KPI untuk satu tiket (formula §KPI). |
| `get_designer_kpi_report(p_designer uuid, p_start date, p_end date)` | `json` | Laporan per desainer: `jumlah_selesai`, `avg_ketepatan/kualitas/kpi`, `tiket_perlu_perhatian` (skor `<60`). `p_designer` null = semua; periode opsional. |

**Triggers**:
- `on_auth_user_created` — `AFTER INSERT ON auth.users` → `handle_new_user()`.
- `trg_permintaan_done` — `BEFORE UPDATE ON permintaan` → `handle_permintaan_done()`: set `completed_at` (sekali, saat pertama DONE) & `assigned_at` (fallback saat assign).
- `trg_kpi_recalc` — `AFTER UPDATE ON permintaan WHEN (completed_at|rating_numeric berubah)` → `calculate_kpi_score()` (WHEN-clause = anti-rekursi).

**Formula KPI**: ketepatan = on-time 100, telat `100 − 10·(hari telat)` floor 0; kualitas = `rating_numeric·20`; akhir = `0.35·ketepatan + 0.65·kualitas` (null bila salah satu komponen null). Skor di-snapshot saat DONE, dibaca dari kolom (bukan dihitung ulang tiap render).

---

## 8. Storage (Supabase Storage)

Dua bucket (keduanya **public**):

| Bucket | Fungsi |
|---|---|
| `permintaan` | Lampiran yang diunggah user saat membuat permintaan |
| `hasil-desain` | File hasil desain yang diunggah desainer |

**Policy** pada `storage.objects` (total 8, masing-masing 4 per bucket) memberi izin `SELECT/INSERT/UPDATE/DELETE` untuk role `public`, difilter per `bucket_id`. Path file disimpan pada kolom `permintaan.files` (JSON) dan dirujuk via URL publik.

---

## 9. Catatan & Anomali (untuk analisis)

1. **Kolom `requester` punya dua FK** sekaligus (`→ auth.users` dan `→ public.users`). Karena setiap `public.users.id` = `auth.users.id`, keduanya konsisten, tetapi redundan dan bisa disederhanakan.
2. **`status` berupa `text` bebas** (bukan enum DB) — validasi hanya di aplikasi, rawan typo (mis. `"TO DO"` dengan spasi). **`role` kini dibatasi CHECK constraint** (`requester/admin/designer`).
3. ~~`rating` text~~ → sudah ada `rating_numeric` (numeric, CHECK 1..5); kolom `rating` text lama tetap ada sebagai arsip.
4. **RLS sangat longgar** pada `users` dan `permintaan` (`USING (true)`), siapa pun dengan anon key bisa baca/tulis — pembatasan nyata di frontend (guard client-side `hooks/use-role-guard.ts`). Hanya `komentar` yang RLS-nya berbasis kepemilikan. Pengetatan RLS = pekerjaan terpisah (belum dilakukan).
5. **Self-assignment anti-race**: pengambilan tugas memakai `UPDATE ... WHERE assigned_designer IS NULL AND status='TO DO'` lalu cek jumlah baris terupdate (atomik per-baris) untuk mencegah dua desainer mengambil tiket yang sama.
6. Tabel `user_profiles` adalah **VIEW**, bukan tabel; ada referensi kode ke `notes` yang **tidak ada** di database (kemungkinan sisa kode/template yang tidak terpakai).
7. **Modul KPI sudah diimplementasi** (kolom skor, trigger, RPC, halaman Laporan KPI & panel KPI desainer real). `get_dashboard_stats.rataRataWaktuPengerjaan` kini terisi.

---

## 10. Konfigurasi Lingkungan

`.env` (tidak di-commit, ada di `.gitignore`):

```
NEXT_PUBLIC_SUPABASE_URL=<url-project-supabase>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=<anon-key>
```

Klien Supabase dibuat di `lib/supabase/client.ts` (browser) dan `lib/supabase/server.ts` (server, cookie-based). Middleware refresh sesi di `lib/supabase/middleware.ts` + `middleware.ts`.
