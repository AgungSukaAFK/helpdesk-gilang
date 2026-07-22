-- ============================================================================
-- Migration: Kolom departemen pada public.users
-- Tujuan:
--   * Tambah kolom `department` (departemen asal user, khususnya requester).
--   * Batasi nilai lewat CHECK constraint — daftar SAMA dengan combobox
--     departemen di form permintaan (lihat lib/constants/departments.ts).
--   * Perbarui view user_profiles agar ikut mengekspos department.
--
-- Dipakai untuk: form "Buat Permintaan Desain" (requester) — field departemen
-- tidak lagi dipilih manual, tapi otomatis diambil dari public.users.department
-- milik user yang login, lalu ditampilkan disabled.
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================================

begin;

alter table public.users add column if not exists department text;

alter table public.users drop constraint if exists users_department_check;
alter table public.users
  add constraint users_department_check
  check (department is null or department in (
    'General Affair', 'Marketing', 'Manufacture', 'HR', 'K3', 'IT',
    'Finance', 'Logistik', 'Purchasing', 'Warehouse', 'Service',
    'General Manager', 'Executive Manager', 'Boards of Director'
  ));

-- Kolom baru ditambahkan di AKHIR daftar select supaya CREATE OR REPLACE VIEW
-- valid (Postgres menolak reorder/insert kolom di tengah lewat REPLACE).
create or replace view public.user_profiles as
select au.id, au.email, au.raw_user_meta_data,
       au.created_at as auth_created_at,
       u.role, u.name, u.created_at as user_created_at,
       u.department
from auth.users au
left join public.users u on au.id = u.id;

commit;
