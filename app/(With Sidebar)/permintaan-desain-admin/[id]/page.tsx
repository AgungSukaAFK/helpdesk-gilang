// Detail permintaan untuk ADMIN — READ ONLY (monitoring & eskalasi).
// Admin tidak lagi mengeksekusi tiket; eksekusi eksklusif milik desainer.

"use client";

import { Content } from "@/components/content";
import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Calendar, Loader2, User, Download } from "lucide-react";
import { format } from "date-fns";
import { id as indonesiaLocale } from "date-fns/locale";
import { PermintaanDesain } from "../buat/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { KpiScores } from "@/components/kpi-scores";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { ROLES } from "@/lib/auth/roles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function DetailPermintaanAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Guard: hanya admin.
  useRoleGuard([ROLES.ADMIN]);

  const [permin, setPermin] = useState<PermintaanDesain | null>(null);
  const [requester, setRequester] = useState<UserProfile | null>(null);
  const [designer, setDesigner] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const s = createClient();

  useEffect(() => {
    if (!id) return;
    async function fetchData() {
      setLoading(true);
      const { data, error } = await s
        .from("permintaan")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        toast.error("Gagal mengambil data permintaan: " + error.message);
        setPermin(null);
      } else {
        setPermin(data as PermintaanDesain);
      }
      setLoading(false);
    }
    fetchData();
  }, [s, id]);

  useEffect(() => {
    async function fetchUser(userId: string, setUser: (u: UserProfile) => void) {
      const { data } = await s
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) setUser(data);
    }
    if (permin?.requester) fetchUser(permin.requester, setRequester);
    if (permin?.assigned_designer)
      fetchUser(permin.assigned_designer, setDesigner);
  }, [s, permin]);

  const handleDownloadFile = async (file: { name: string; url: string }) => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengunduh file.");
    }
  };

  if (loading && !permin) {
    return (
      <Content
        title="Memuat Detail Permintaan..."
        description="Harap tunggu sebentar."
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Content>
    );
  }

  if (!permin) {
    return (
      <Content
        title="Data Tidak Ditemukan"
        description={`Permintaan desain dengan ID: ${id} tidak dapat ditemukan.`}
      />
    );
  }

  return (
    <>
      <Content size="sm" title="Detail Permintaan Desain (Monitoring)">
        <div className="space-y-6">
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Judul Permintaan</Label>
            <p>{permin.judul}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Project</Label>
            <p>{permin.project}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Departemen</Label>
            <p>{permin.departemen}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Status Permintaan</Label>
            <StatusBadge status={permin.status} />
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label className="text-base">Deskripsi</Label>
            <p className="max-h-52 overflow-auto whitespace-pre-wrap">
              {permin.deskripsi}
            </p>
          </div>
        </div>
      </Content>

      <Content size="sm" title="Informasi Tambahan">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 mt-1 text-muted-foreground" />
            <div>
              <Label>Peminta</Label>
              <div className="text-sm font-medium">
                {requester?.name || "Memuat..."}
              </div>
              <p className="text-sm text-muted-foreground">
                {requester?.email}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 mt-1 text-muted-foreground" />
            <div>
              <Label>Desainer (PIC)</Label>
              {designer ? (
                <>
                  <div className="text-sm font-medium">{designer.name}</div>
                  <p className="text-sm text-muted-foreground">
                    {designer.email}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Belum diambil desainer
                </p>
              )}
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 mt-1 text-muted-foreground" />
            <div>
              <Label>Tanggal Dibuat</Label>
              <p className="text-sm font-medium">
                {format(new Date(permin.created_at), "dd MMMM yyyy", {
                  locale: indonesiaLocale,
                })}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 mt-1 text-red-500" />
            <div>
              <Label>Batas Waktu</Label>
              <p className="text-sm font-medium">
                {format(new Date(permin.due_date), "dd MMMM yyyy", {
                  locale: indonesiaLocale,
                })}
              </p>
            </div>
          </div>
          {permin.rating && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 mt-1 text-yellow-500" />
                <div>
                  <Label>Rating Requester</Label>
                  <p className="text-sm font-medium">{permin.rating} / 5</p>
                  {permin.review && (
                    <p className="text-sm text-muted-foreground italic">
                      &quot;{permin.review}&quot;
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Content>

      {permin.skor_kpi_akhir !== null &&
        permin.skor_kpi_akhir !== undefined && (
          <Content size="sm" title="Penilaian KPI">
            <KpiScores
              ketepatan={permin.skor_ketepatan_waktu}
              kualitas={permin.skor_kualitas}
              akhir={permin.skor_kpi_akhir}
            />
          </Content>
        )}

      {permin.files && permin.files.length > 0 && (
        <Content size="sm" title="File Terlampir">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Nama File</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permin.files.map((file, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {file.name}
                    </a>
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadFile(file)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Unduh
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Content>
      )}
    </>
  );
}
