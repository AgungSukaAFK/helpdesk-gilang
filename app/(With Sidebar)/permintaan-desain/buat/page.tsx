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
import { DEPARTMENTS } from "@/lib/constants/departments";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { ROLES } from "@/lib/auth/roles";

export interface PermintaanDesain {
  id: string;
  created_at: Date;
  due_date: Date;
  judul: string;
  deskripsi: string;
  project: string;
  status: string;
  departemen: string;
  rating: string;
  review: string;
  requester: string;
  assigned_designer: string;
  files: File[];
}

interface File {
  url: string;
  name: string;
}

const dataProject: ComboboxData = [
  { label: "Desain Poster", value: "Desain Poster" },
  { label: "Desain Logo", value: "Desain Logo" },
  { label: "Desain Flyer", value: "Desain Flyer" },
  { label: "Desain Kemasan", value: "Desain Kemasan" },
  { label: "Desain Event", value: "Desain Event" },
  { label: "Lainnya...", value: "Lainnya" },
];

export default function BuatPermintaanDesainPage() {
  useRoleGuard([ROLES.REQUESTER]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [departmentLoading, setDepartmentLoading] = useState<boolean>(true);
  const [alertMessage, setAlertMessage] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [customProject, setCustomProject] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]); // State untuk lampiran

  const s = createClient();

  const { push } = useRouter();

  // Departemen tidak lagi dipilih manual — diambil dari profil user yang
  // login lalu ditampilkan disabled, supaya selalu konsisten dengan data
  // departemen pemohon di public.users.
  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) return;

      const { data } = await s
        .from("users")
        .select("department")
        .eq("id", user.id)
        .single();

      if (!active) return;
      setSelectedDepartment(data?.department ?? "");
      setDepartmentLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- FUNGSI UNTUK MENGELOLA LAMPIRAN ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const toastId = toast.loading(`Mengunggah ${files.length} file...`);

    const uploadPromises = Array.from(files).map(async (file) => {
      const filePath = `design-requests/${Date.now()}_${file.name}`;
      const { data, error } = await s.storage
        .from("permintaan")
        .upload(filePath, file); // Ganti "mr" dengan nama bucket Anda
      if (error) return { error, file };
      return { data: { ...data, name: file.name }, error: null };
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results
      .filter((r) => !r.error)
      .map((r) => ({ url: r.data!.path, name: r.data!.name }));
    const failedUploads = results.filter((r) => r.error);

    if (successfulUploads.length > 0) {
      setUploadedFiles((prev) => [...prev, ...successfulUploads]);
      toast.success(`${successfulUploads.length} file berhasil diunggah.`, {
        id: toastId,
      });
    }
    if (failedUploads.length > 0) {
      toast.error(`Gagal mengunggah ${failedUploads.length} file.`, {
        id: toastId,
      });
    } else if (successfulUploads.length === 0) {
      toast.dismiss(toastId);
    }
    setIsUploading(false);
    e.target.value = ""; // Reset input file
  };

  const handleRemoveFile = async (index: number, path: string) => {
    const toastId = toast.loading("Menghapus file...");
    const { error } = await s.storage.from("permintaan").remove([path]); // Ganti "mr" dengan nama bucket Anda

    if (error) {
      toast.error("Gagal menghapus file", {
        id: toastId,
        description: error.message,
      });
      return;
    }

    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    toast.success("File berhasil dihapus.", { id: toastId });
  };

  // --- FUNGSI SUBMIT FORM UTAMA ---
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const judul = formData.get("judul") as string;
    const deskripsi = formData.get("deskripsi") as string;
    const due_date = formData.get("due_date") as string;
    const departemen = selectedDepartment;
    const projectValue =
      selectedProject === "Lainnya" ? customProject : selectedProject;

    if (!departemen || !projectValue || !judul || !deskripsi || !due_date) {
      setAlertMessage("Semua kolom (selain lampiran) wajib diisi.");
      return;
    }
    if (selectedProject === "Lainnya" && !customProject.trim()) {
      setAlertMessage("Harap sebutkan jenis proyek lainnya.");
      return;
    }

    setAlertMessage("");
    try {
      setLoading(true);
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) throw new Error("Anda harus login untuk membuat permintaan.");

      const dataToInsert = {
        departemen,
        deskripsi,
        judul,
        project: projectValue,
        due_date: new Date(due_date),
        files: uploadedFiles, // <-- Menambahkan data lampiran
        status: "TO DO",
        requester: user.id,
      };

      const { error: insertError } = await s
        .from("permintaan")
        .insert([dataToInsert]);
      if (insertError) throw insertError;

      form.reset();
      setSelectedProject("");
      setCustomProject("");
      setUploadedFiles([]); // <-- Reset state lampiran
      toast.success("Permintaan desain berhasil dibuat.");
      setAlertMessage("Berhasil membuat permintaan desain.");
      push("/permintaan-desain");
    } catch (error: any) {
      toast.error("Terjadi kesalahan: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDepartmentChange(value: string) {
    setSelectedDepartment(value);
  }
  function handleProjectChange(value: string) {
    setSelectedProject(value);
    if (value !== "Lainnya") setCustomProject("");
  }

  return (
    <>
      <Content title="Permintaan Desain" size="md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="judul">Judul Permintaan</Label>
            <Input
              id="judul"
              name="judul"
              required
              disabled={loading}
              placeholder="Contoh: Poster untuk Event 17 Agustus"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project">Jenis Proyek</Label>
            <Combobox
              data={dataProject}
              onChange={handleProjectChange}
              defaultValue={selectedProject}
            />
          </div>

          {selectedProject === "Lainnya" && (
            <div className="flex flex-col gap-2 animate-in fade-in">
              <Label htmlFor="custom_project">Sebutkan Proyek Lainnya</Label>
              <Input
                id="custom_project"
                name="custom_project"
                value={customProject}
                onChange={(e) => setCustomProject(e.target.value)}
                placeholder="Contoh: Desain Kalender"
                required={selectedProject === "Lainnya"}
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
              placeholder="Jelaskan detail desain yang Anda butuhkan (ukuran, teks, referensi warna, dll)..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="departemen">Departemen</Label>
            <Combobox
              key={selectedDepartment}
              data={DEPARTMENTS}
              onChange={handleDepartmentChange}
              defaultValue={selectedDepartment}
              disabled
            />
            <p className="text-sm text-muted-foreground">
              {departmentLoading
                ? "Memuat departemen..."
                : selectedDepartment
                ? "Diambil otomatis dari profil Anda dan tidak dapat diubah."
                : "Departemen Anda belum diset. Hubungi admin untuk mengaturnya sebelum membuat permintaan."}
            </p>
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

          {/* BAGIAN LAMPIRAN BARU */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="attachments">Lampiran (Opsional)</Label>
            <Input
              id="attachments"
              type="file"
              multiple
              disabled={loading || isUploading}
              onChange={handleFileUpload}
            />
            {isUploading && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengunggah...
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div className="mt-2 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama File</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadedFiles.map((file, index) => (
                      <TableRow key={index}>
                        <TableCell className="flex items-center gap-2 truncate max-w-xs">
                          <Paperclip className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFile(index, file.url)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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
          <Button
            type="submit"
            disabled={loading || isUploading}
            className="w-full"
          >
            {loading ? "Mengirim..." : "Kirim Permintaan"}
          </Button>
        </form>
      </Content>
    </>
  );
}
