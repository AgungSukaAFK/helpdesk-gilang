"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeRole, type Role } from "@/lib/auth/roles";

type GuardState = {
  role: Role | null;
  userId: string | null;
  loading: boolean;
  /** true bila role user termasuk yang diizinkan. */
  allowed: boolean;
};

/**
 * Guard role client-side. Mengambil user + role, dan (opsional) me-redirect
 * ke /dashboard bila role tidak termasuk `allow`. Karena RLS sengaja longgar
 * untuk task ini, guard inilah lapisan pembatas akses antar-role.
 */
export function useRoleGuard(allow?: Role[], redirectTo = "/dashboard"): GuardState {
  const router = useRouter();
  const [state, setState] = useState<GuardState>({
    role: null,
    userId: null,
    loading: true,
    allowed: false,
  });

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = normalizeRole(profile?.role);
      const allowed = !allow || allow.includes(role);

      if (!active) return;

      if (!allowed) {
        router.replace(redirectTo);
      }

      setState({ role, userId: user.id, loading: false, allowed });
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
