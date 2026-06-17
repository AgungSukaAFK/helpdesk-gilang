-- ============================================================================
-- Migration: Kalkulasi KPI (Weighted Performance Scoring)
-- Komponen: ketepatan waktu (completed vs due_date) + kualitas (rating 1-5).
--   skor_ketepatan_waktu: on-time = 100; telat = 100 - 10*(hari telat), floor 0.
--   skor_kualitas        = rating_numeric * 20.
--   skor_kpi_akhir       = 0.35*ketepatan + 0.65*kualitas (null bila salah satu null).
-- Skor di-snapshot per tiket saat DONE; rating boleh menyusul (memicu hitung ulang).
--
-- Catatan interpretasi: due_date bertipe `date`, keterlambatan dihitung
-- per-hari kalender (completed_at::date - due_date) — lebih intuitif & adil
-- dibanding selisih epoch detik.
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Kolom baru pada public.permintaan
-- ----------------------------------------------------------------------------
alter table public.permintaan add column if not exists completed_at timestamptz;
alter table public.permintaan add column if not exists assigned_at timestamptz;
alter table public.permintaan add column if not exists rating_numeric numeric;
alter table public.permintaan add column if not exists skor_ketepatan_waktu numeric;
alter table public.permintaan add column if not exists skor_kualitas numeric;
alter table public.permintaan add column if not exists skor_kpi_akhir numeric;

-- ----------------------------------------------------------------------------
-- 2. Constraint validasi
-- ----------------------------------------------------------------------------
alter table public.permintaan drop constraint if exists rating_numeric_check;
alter table public.permintaan
  add constraint rating_numeric_check check (rating_numeric between 1 and 5);

-- Langkah minimal anti-typo pada status (tanpa migrasi ke enum penuh).
alter table public.permintaan drop constraint if exists permintaan_status_check;
alter table public.permintaan
  add constraint permintaan_status_check
  check (status in ('TO DO','PROGRESS','REVIEW','REVISION','DONE'));

-- ----------------------------------------------------------------------------
-- 3. Backfill data lama (DB saat ini kosong -> 0 baris, tetap aman).
--    Asumsi: tiket DONE lama tidak punya completed_at -> pakai created_at
--    sebagai proxy agar data historis tidak kosong total.
-- ----------------------------------------------------------------------------
update public.permintaan
   set rating_numeric = nullif(trim(rating), '')::numeric
 where rating ~ '^[0-9]+(\.[0-9]+)?$'
   and rating_numeric is null;

update public.permintaan
   set completed_at = created_at
 where status = 'DONE' and completed_at is null;

update public.permintaan
   set assigned_at = created_at
 where assigned_designer is not null and assigned_at is null;

-- ----------------------------------------------------------------------------
-- 4. Fungsi kalkulasi skor KPI untuk satu tiket
-- ----------------------------------------------------------------------------
create or replace function public.calculate_kpi_score(p_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_due        date;
  v_completed  timestamptz;
  v_rating     numeric;
  v_late_days  integer;
  v_ketepatan  numeric;
  v_kualitas   numeric;
  v_akhir      numeric;
begin
  select due_date, completed_at, rating_numeric
    into v_due, v_completed, v_rating
    from public.permintaan
   where id = p_id;

  -- Ketepatan waktu (hanya bila sudah selesai/ada completed_at)
  if v_completed is null then
    v_ketepatan := null;
  elsif v_due is null then
    v_ketepatan := 100; -- tanpa due_date, anggap on-time
  else
    v_late_days := (v_completed::date - v_due);
    if v_late_days <= 0 then
      v_ketepatan := 100;
    else
      v_ketepatan := greatest(0, 100 - (10 * v_late_days));
    end if;
  end if;

  -- Kualitas (dari rating 1-5)
  if v_rating is null then
    v_kualitas := null;
  else
    v_kualitas := v_rating * 20;
  end if;

  -- Skor akhir hanya bila kedua komponen tersedia
  if v_ketepatan is not null and v_kualitas is not null then
    v_akhir := (0.35 * v_ketepatan) + (0.65 * v_kualitas);
  else
    v_akhir := null;
  end if;

  update public.permintaan
     set skor_ketepatan_waktu = v_ketepatan,
         skor_kualitas        = v_kualitas,
         skor_kpi_akhir       = v_akhir
   where id = p_id;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 5. Trigger BEFORE UPDATE: isi completed_at (snapshot pertama) & assigned_at
-- ----------------------------------------------------------------------------
create or replace function public.handle_permintaan_done()
returns trigger
language plpgsql
as $function$
begin
  -- Snapshot waktu selesai saat pertama kali DONE; tidak menimpa bila sudah ada.
  if new.status = 'DONE' and (old.status is distinct from 'DONE')
     and new.completed_at is null then
    new.completed_at := now();
  end if;

  -- Catat waktu tugas diambil (fallback bila frontend tidak mengisinya).
  if new.assigned_designer is not null and old.assigned_designer is null
     and new.assigned_at is null then
    new.assigned_at := now();
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_permintaan_done on public.permintaan;
create trigger trg_permintaan_done
  before update on public.permintaan
  for each row execute function public.handle_permintaan_done();

-- ----------------------------------------------------------------------------
-- 6. Trigger AFTER UPDATE: hitung ulang skor saat completed_at / rating berubah.
--    WHEN-clause mencegah rekursi (kolom skor tidak memicu trigger).
-- ----------------------------------------------------------------------------
create or replace function public.trg_kpi_recalc()
returns trigger
language plpgsql
as $function$
begin
  perform public.calculate_kpi_score(new.id);
  return null;
end;
$function$;

drop trigger if exists trg_kpi_recalc on public.permintaan;
create trigger trg_kpi_recalc
  after update on public.permintaan
  for each row
  when (
    new.completed_at is distinct from old.completed_at
    or new.rating_numeric is distinct from old.rating_numeric
  )
  execute function public.trg_kpi_recalc();

-- ----------------------------------------------------------------------------
-- 7. Update get_dashboard_stats(): rating_numeric + waktu pengerjaan + KPI
-- ----------------------------------------------------------------------------
create or replace function public.get_dashboard_stats()
returns json
language plpgsql
as $function$
declare
  stats json;
begin
  select json_build_object(
    'permintaanBaru', (
      select count(*) from permintaan
       where created_at >= now() - interval '7 days'
    ),
    'sedangDikerjakan', (
      select count(*) from permintaan where status = 'PROGRESS'
    ),
    'menungguRevisi', (
      select count(*) from permintaan where status = 'REVISION'
    ),
    'selesaiBulanIni', (
      select count(*) from permintaan
       where status = 'DONE'
         and date_trunc('month', created_at) = date_trunc('month', now())
    ),
    'rataRataRating', (
      select avg(rating_numeric) from permintaan where rating_numeric is not null
    ),
    -- Rata-rata durasi pengerjaan (hari) dari assigned_at -> completed_at
    'rataRataWaktuPengerjaan', (
      select avg(extract(epoch from (completed_at - assigned_at)) / 86400.0)
        from permintaan
       where status = 'DONE' and completed_at is not null and assigned_at is not null
    ),
    -- Rata-rata skor KPI akhir
    'rataRataSkorKPI', (
      select avg(skor_kpi_akhir) from permintaan where skor_kpi_akhir is not null
    )
  ) into stats;
  return stats;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 8. RPC laporan KPI per desainer (untuk halaman Laporan KPI admin)
--    p_designer null  -> semua desainer (group by)
--    p_start/p_end null -> tanpa batas periode
-- ----------------------------------------------------------------------------
create or replace function public.get_designer_kpi_report(
  p_designer uuid default null,
  p_start date default null,
  p_end date default null
)
returns json
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(json_agg(row_to_json(t) order by t.designer_name), '[]'::json)
  from (
    select
      u.id as designer_id,
      coalesce(up.name, '(Tanpa Nama)') as designer_name,
      count(p.id) as jumlah_selesai,
      round(avg(p.skor_ketepatan_waktu), 1) as avg_ketepatan,
      round(avg(p.skor_kualitas), 1) as avg_kualitas,
      round(avg(p.skor_kpi_akhir), 1) as avg_kpi,
      coalesce(
        (
          select json_agg(json_build_object(
                   'id', q.id, 'judul', q.judul, 'skor_kpi_akhir', q.skor_kpi_akhir))
            from public.permintaan q
           where q.assigned_designer = u.id
             and q.status = 'DONE'
             and q.skor_kpi_akhir is not null
             and q.skor_kpi_akhir < 60
             and (p_start is null or q.completed_at::date >= p_start)
             and (p_end is null or q.completed_at::date <= p_end)
        ), '[]'::json
      ) as tiket_perlu_perhatian
    from public.users u
    left join public.user_profiles up on up.id = u.id
    left join public.permintaan p
      on p.assigned_designer = u.id
     and p.status = 'DONE'
     and (p_start is null or p.completed_at::date >= p_start)
     and (p_end is null or p.completed_at::date <= p_end)
    where u.role = 'designer'
      and (p_designer is null or u.id = p_designer)
    group by u.id, up.name
  ) t;
$function$;

grant execute on function public.get_designer_kpi_report(uuid, date, date)
  to anon, authenticated, service_role;
grant execute on function public.calculate_kpi_score(bigint)
  to anon, authenticated, service_role;

commit;
