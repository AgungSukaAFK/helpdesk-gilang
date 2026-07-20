import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth/roles";
import { NextResponse } from "next/server";

const MIN_PASSWORD_LENGTH = 6;

/**
 * Reset password milik user lain. Hanya boleh dipanggil admin.
 *
 * Endpoint ini wajib berjalan di server: mengubah password akun lain
 * memakai Admin API Supabase yang menuntut service role key. Key tersebut
 * memberi akses penuh ke database (menembus seluruh RLS), jadi ia tidak
 * boleh pernah dikirim ke browser — karena itu tidak ber-prefix NEXT_PUBLIC.
 */
export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server." },
      { status: 500 }
    );
  }

  let body: { userId?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  const { userId, password } = body;
  if (typeof userId !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "userId dan password wajib diisi." },
      { status: 400 }
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` },
      { status: 400 }
    );
  }

  // 1. Pastikan pemanggil benar-benar sedang login.
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  // 2. Role dibaca dari database, bukan dari request. Nilai yang dikirim
  //    client tidak pernah dipercaya untuk keputusan otorisasi.
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !isAdmin(profile?.role)) {
    return NextResponse.json(
      { error: "Hanya admin yang boleh mereset password." },
      { status: 403 }
    );
  }

  // Mengganti password sebuah akun membuat Supabase mencabut seluruh refresh
  // token milik akun itu. Bila admin mereset akunnya sendiri, sesinya sendiri
  // ikut mati dan ia terlempar keluar — tidak bisa dihindari selama password
  // benar-benar diubah. Karena itu self-reset ditolak di sini.
  if (userId === user.id) {
    return NextResponse.json(
      {
        error:
          "Tidak bisa mereset password akun sendiri dari sini karena sesi Anda akan berakhir. Gunakan halaman Profil.",
      },
      { status: 400 }
    );
  }

  // 3. Eksekusi reset lewat Admin API.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
