import { ComboboxData } from "@/components/combobox";

// Satu sumber kebenaran daftar departemen — dipakai di form permintaan desain
// (requester & admin) dan editor profil user. Harus SELALU sinkron dengan
// CHECK constraint `users_department_check` (lihat migration
// `..._user-department.sql`) dan skrip `scripts/seed-demo-users.mjs`.
export const DEPARTMENTS: ComboboxData = [
  { label: "General Affair", value: "General Affair" },
  { label: "Marketing", value: "Marketing" },
  { label: "Manufacture", value: "Manufacture" },
  { label: "HR", value: "HR" },
  { label: "K3", value: "K3" },
  { label: "IT", value: "IT" },
  { label: "Finance", value: "Finance" },
  { label: "Logistik", value: "Logistik" },
  { label: "Purchasing", value: "Purchasing" },
  { label: "Warehouse", value: "Warehouse" },
  { label: "Service", value: "Service" },
  { label: "General Manager", value: "General Manager" },
  { label: "Executive Manager", value: "Executive Manager" },
  { label: "Boards of Director", value: "Boards of Director" },
];
