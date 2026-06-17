// src/app/(With Sidebar)/permintaan-desain/buat/page.tsx

"use client";

import { Combobox, ComboboxData } from "@/components/combobox";
import { Content } from "@/components/content";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { ROLES } from "@/lib/auth/roles";

// REVISI: Menambahkan 'project' ke interface
export interface PermintaanDesain {
  id: string;
  created_at: Date;
  due_date: Date;
  judul: string;
  deskripsi: string;
  project: string; // <-- Tambahan kolom baru
  status: string;
  departemen: string;
  rating: string;
  review: string;
  requester: string;
  assigned_designer: string;
  files: File[];
  rating_numeric?: number | null;
  completed_at?: string | null;
  skor_ketepatan_waktu?: number | null;
  skor_kualitas?: number | null;
  skor_kpi_akhir?: number | null;
}

interface File {
  url: string;
  name: string;
}

// Data Departemen (tidak berubah)
const dataDepartment: ComboboxData = [
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

// REVISI: Menambahkan data untuk dropdown project
const dataProject: ComboboxData = [
  { label: "Desain Poster", value: "Desain Poster" },
  { label: "Desain Logo", value: "Desain Logo" },
  { label: "Desain Flyer", value: "Desain Flyer" },
  { label: "Desain Kemasan", value: "Desain Kemasan" },
  { label: "Desain Event", value: "Desain Event" },
  { label: "Lainnya...", value: "Lainnya" },
];

export default function BuatPermintaanDesainPage() {
  useRoleGuard([ROLES.ADMIN]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [alertMessage, setAlertMessage] = useState<string>("");

  // REVISI: State baru untuk project
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [customProject, setCustomProject] = useState<string>("");

  const s = createClient();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const judul = formData.get("judul") as string;
    const deskripsi = formData.get("deskripsi") as string;
    const due_date = formData.get("due_date") as string;
    const departemen = selectedDepartment;

    // REVISI: Menentukan nilai 'project' yang akan disimpan
    const projectValue =
      selectedProject === "Lainnya" ? customProject : selectedProject;

    // REVISI: Validasi baru
    if (!departemen || !projectValue) {
      setAlertMessage("Departemen dan Jenis Proyek harus diisi.");
      return;
    }
    if (selectedProject === "Lainnya" && !customProject.trim()) {
      setAlertMessage("Harap sebutkan jenis proyek lainnya.");
      return;
    }
    if (!judul || !deskripsi || !due_date) {
      setAlertMessage("Judul, deskripsi, dan due date harus diisi.");
      return;
    }

    setAlertMessage("");
    try {
      setLoading(true);
      const { data: user } = await s.auth.getUser();
      if (!user.user) {
        toast.error("Anda harus login untuk membuat permintaan desain.");
        return;
      }

      // REVISI: Menambahkan 'project' ke data yang akan di-insert
      const data: Omit<PermintaanDesain, "id" | "created_at" | "assigned_designer"> = {
        departemen,
        deskripsi,
        judul,
        project: projectValue, // <-- Menggunakan nilai project yang sudah ditentukan
        due_date: new Date(due_date),
        files: [],
        rating: "",
        review: "",
        status: "TO DO",
        requester: user.user.id,
      };

      const { error: insertError } = await s.from("permintaan").insert([data]);
      if (insertError) {
        throw insertError;
      }

      // REVISI: Mereset state baru setelah submit berhasil
      form.reset();
      setSelectedDepartment("");
      setSelectedProject("");
      setCustomProject("");
      toast.success("Permintaan desain berhasil dibuat.");
      setAlertMessage("Berhasil membuat permintaan desain.");
    } catch (error: any) {
      console.log(error);
      toast.error("Terjadi kesalahan: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDepartmentChange(value: string) {
    setSelectedDepartment(value);
  }

  // REVISI: Handler baru untuk perubahan project
  function handleProjectChange(value: string) {
    setSelectedProject(value);
    // Jika user memilih opsi selain "Lainnya", kosongkan input kustom
    if (value !== "Lainnya") {
      setCustomProject("");
    }
  }

  return (
    <>
      <Content title="Permintaan Desain" size="sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="judul">Judul Permintaan</Label>
            <Input
              type="text"
              id="judul"
              name="judul"
              required
              disabled={loading}
              placeholder="Masukkan judul permintaan desain..."
            />
          </div>

          {/* REVISI: Form untuk Project */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="project">Jenis Proyek</Label>
            <Combobox
              data={dataProject}
              onChange={handleProjectChange}
              defaultValue={selectedProject}
            />
          </div>

          {/* REVISI: Input kondisional untuk "Lainnya" */}
          {selectedProject === "Lainnya" && (
            <div className="flex flex-col gap-2 animate-in fade-in">
              <Label htmlFor="custom_project">Sebutkan Proyek Lainnya</Label>
              <Input
                id="custom_project"
                name="custom_project"
                value={customProject}
                onChange={(e) => setCustomProject(e.target.value)}
                placeholder="Contoh: Desain Kalender"
                required={selectedProject === "Lainnya"} // Wajib diisi jika "Lainnya" dipilih
                disabled={loading}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="deskripsi">Deskripsi</Label>
            <Textarea
              rows={4}
              id="deskripsi"
              name="deskripsi"
              required
              disabled={loading}
              placeholder="Jelaskan detail desain yang Anda butuhkan..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="departemen">Departemen</Label>
            <Combobox
              data={dataDepartment}
              onChange={handleDepartmentChange}
              defaultValue={selectedDepartment}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              defaultValue={new Date().toISOString().split("T")[0]}
              id="due_date"
              name="due_date"
              required
              disabled={loading}
            />
          </div>
          {alertMessage && (
            <Alert
              variant={
                alertMessage.includes("Berhasil") ? "default" : "destructive"
              }
            >
              <AlertDescription>{alertMessage}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Mengirim..." : "Kirim Permintaan"}
          </Button>
        </form>
      </Content>
    </>
  );
}
