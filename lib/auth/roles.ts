// Helper role terpusat — satu sumber kebenaran untuk pengecekan role.
// Hindari membandingkan string role secara manual di banyak tempat (rawan typo).

export const ROLES = {
  REQUESTER: "requester",
  ADMIN: "admin",
  DESIGNER: "designer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Normalisasi role lama 'user' -> 'requester' (jaga-jaga bila ada data lama). */
export function normalizeRole(role: string | null | undefined): Role {
  if (role === "user") return ROLES.REQUESTER;
  if (role === ROLES.ADMIN || role === ROLES.DESIGNER) return role;
  return ROLES.REQUESTER;
}

export function isAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.ADMIN;
}

export function isDesigner(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.DESIGNER;
}

export function isRequester(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.REQUESTER;
}

/** Hanya desainer yang boleh mengeksekusi tiket (ambil/ubah status/unggah hasil). */
export function canExecuteTickets(role: string | null | undefined): boolean {
  return isDesigner(role);
}

/** Hanya admin yang memonitor seluruh tiket & mengakses laporan KPI. */
export function canMonitorAll(role: string | null | undefined): boolean {
  return isAdmin(role);
}

/** Label tampilan untuk badge/teks. */
export const ROLE_LABELS: Record<Role, string> = {
  requester: "Requester",
  admin: "Admin",
  designer: "Desainer",
};

/** Route default (home) per role — dipakai untuk redirect setelah login / guard. */
export function homeRouteForRole(role: string | null | undefined): string {
  return "/dashboard";
}
