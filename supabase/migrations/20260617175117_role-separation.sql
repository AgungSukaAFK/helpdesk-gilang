-- ============================================================================
-- Migration: Pemisahan role Desainer dari Admin (requester / admin / designer)
-- Tujuan:
--   * Ubah role lama 'user' -> 'requester'
--   * Tambah role baru 'designer'
--   * Batasi nilai role lewat CHECK constraint
--   * Rename kolom permintaan.admin -> permintaan.assigned_designer
--     (kolom ini = "desainer yang mengerjakan tiket", dipakai juga oleh task KPI)
--   * Update trigger handle_new_user() agar default role = 'requester'
--   * Sesuaikan RLS policy komentar agar memakai assigned_designer
--
-- Ditulis idempotent: aman dijalankan ulang.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Role: rename 'user' -> 'requester', set default, batasi dengan CHECK
-- ----------------------------------------------------------------------------

-- Hapus constraint lama (kalau sudah pernah dibuat) supaya bisa dibuat ulang.
alter table public.users drop constraint if exists users_role_check;

-- Migrasi data role lama. Pada DB kosong ini 0 baris, tapi tetap aman dijalankan.
update public.users set role = 'requester' where role = 'user';

-- Default role untuk baris baru.
alter table public.users alter column role set default 'requester';

-- Batasi nilai role yang diperbolehkan. NULL tetap lolos (CHECK mengabaikan NULL).
alter table public.users
  add constraint users_role_check
  check (role in ('requester', 'admin', 'designer'));

-- ----------------------------------------------------------------------------
-- 2. Rename kolom permintaan.admin -> permintaan.assigned_designer
--    FK 'permintaan_admin_fkey' ikut menempel ke kolom baru secara otomatis.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'permintaan' and column_name = 'admin'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'permintaan' and column_name = 'assigned_designer'
  ) then
    alter table public.permintaan rename column admin to assigned_designer;
  end if;
end $$;

-- Rename constraint FK agar namanya konsisten (abaikan bila tidak ada / sudah berganti).
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'permintaan_admin_fkey'
  ) then
    alter table public.permintaan rename constraint permintaan_admin_fkey to permintaan_assigned_designer_fkey;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Trigger handle_new_user(): default role 'requester'
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.users (id, role, name)
  values (
    new.id,
    'requester',  -- default role baru
    null
  );
  return new;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 4. RLS policy komentar: pakai assigned_designer (sebelumnya kolom admin)
--    Akses jika: auth.uid() = requester tiket, ATAU = assigned_designer tiket,
--    ATAU user ber-role 'admin' (untuk monitoring/eskalasi).
-- ----------------------------------------------------------------------------
drop policy if exists "Users can view comments on their requests" on public.komentar;
create policy "Users can view comments on their requests"
on public.komentar
for select
using (
  (auth.uid() in (
      select permintaan.requester from public.permintaan
        where permintaan.id = komentar.permintaan_id
      union
      select permintaan.assigned_designer from public.permintaan
        where permintaan.id = komentar.permintaan_id
  ))
  or exists (
    select 1 from public.users
      where users.id = auth.uid() and users.role = 'admin'
  )
);

drop policy if exists "Users can insert comments on their requests" on public.komentar;
create policy "Users can insert comments on their requests"
on public.komentar
for insert
with check (
  (auth.uid() in (
      select permintaan.requester from public.permintaan
        where permintaan.id = komentar.permintaan_id
      union
      select permintaan.assigned_designer from public.permintaan
        where permintaan.id = komentar.permintaan_id
  ))
  or exists (
    select 1 from public.users
      where users.id = auth.uid() and users.role = 'admin'
  )
);

commit;

-- ----------------------------------------------------------------------------
-- 5. (MANUAL, tidak dieksekusi otomatis) Promosi akun uji.
--    Jalankan setelah mendaftar akun lewat aplikasi:
--    UPDATE public.users SET role = 'designer' WHERE id = '<uuid-akun>';
--    UPDATE public.users SET role = 'admin'    WHERE id = '<uuid-akun>';
-- ----------------------------------------------------------------------------
