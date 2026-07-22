// Seed akun demo untuk setiap departemen (role requester), password sama
// untuk semua: "demo1234". Idempotent — aman dijalankan ulang; user yang
// sudah ada di-skip pembuatannya tapi tetap di-sync nama/role/department-nya.
//
// Wajib pakai SUPABASE_SERVICE_ROLE_KEY (server-side only, jangan pernah
// dipakai di kode frontend). Jalankan:
//   node --env-file=.env scripts/seed-demo-users.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "demo1234";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diset (lihat .env)."
  );
  process.exit(1);
}

// Harus sinkron dengan lib/constants/departments.ts dan CHECK constraint
// `users_department_check` pada migration 20260723090000_user-department.sql.
const DEPARTMENTS = [
  { slug: "general-affair", label: "General Affair" },
  { slug: "marketing", label: "Marketing" },
  { slug: "manufacture", label: "Manufacture" },
  { slug: "hr", label: "HR" },
  { slug: "k3", label: "K3" },
  { slug: "it", label: "IT" },
  { slug: "finance", label: "Finance" },
  { slug: "logistik", label: "Logistik" },
  { slug: "purchasing", label: "Purchasing" },
  { slug: "warehouse", label: "Warehouse" },
  { slug: "service", label: "Service" },
  { slug: "general-manager", label: "General Manager" },
  { slug: "executive-manager", label: "Executive Manager" },
  { slug: "boards-of-director", label: "Boards of Director" },
];

// Akun non-departemen yang sudah ada dari task sebelumnya (lihat sistem.md
// §11). Tidak dibuat ulang di sini, hanya requester@demo.com yang di-backfill
// department-nya supaya langsung bisa dipakai mendemokan fitur auto-isi.
const EXISTING_DEMO_DEPARTMENT_BACKFILL = {
  "requester@demo.com": "IT",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(email) {
  // Admin API tidak punya getUserByEmail; list per halaman lalu cari manual.
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (found) return found.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function upsertProfile(userId, { name, department }) {
  const { error } = await admin
    .from("users")
    .update({ role: "requester", name, department })
    .eq("id", userId);
  if (error) throw error;
}

async function seedDepartmentUser({ slug, label }) {
  const email = `${slug}@demo.com`;
  const name = `Requester ${label}`;

  let userId = await findUserIdByEmail(email);

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`+ dibuat: ${email}`);
  } else {
    console.log(`= sudah ada: ${email} (sync profil)`);
  }

  // handle_new_user trigger sudah membuat baris public.users saat createUser;
  // di sini kita isi/perbarui name, role, dan department-nya.
  await upsertProfile(userId, { name, department: label });
}

async function backfillExistingDemoAccounts() {
  for (const [email, department] of Object.entries(
    EXISTING_DEMO_DEPARTMENT_BACKFILL
  )) {
    const userId = await findUserIdByEmail(email);
    if (!userId) {
      console.log(`~ dilewati (belum ada): ${email}`);
      continue;
    }
    const { error } = await admin
      .from("users")
      .update({ department })
      .eq("id", userId);
    if (error) throw error;
    console.log(`~ department di-set: ${email} -> ${department}`);
  }
}

async function main() {
  for (const dept of DEPARTMENTS) {
    await seedDepartmentUser(dept);
  }
  await backfillExistingDemoAccounts();
  console.log(
    `\nSelesai. ${DEPARTMENTS.length} akun departemen siap, password: ${PASSWORD}`
  );
}

main().catch((err) => {
  console.error("Seed gagal:", err);
  process.exit(1);
});
