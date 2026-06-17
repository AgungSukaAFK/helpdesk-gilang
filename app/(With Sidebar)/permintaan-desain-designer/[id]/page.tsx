// Detail pengerjaan untuk DESAINER — eksekusi tiket yang ditugaskan padanya.
"use client";

import { Content } from "@/components/content";
import { useCallback, use, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Download,
  Loader2,
  Send,
  Trash2,
  UploadCloud,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { id as indonesiaLocale } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { KpiScores } from "@/components/kpi-scores";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { ROLES } from "@/lib/auth/roles";

interface FileItem {
  name: string;
  url: string;
}

interface PermintaanDetail {
  id: string;
  judul: string;
  deskripsi: string;
  project: string;
  status: string;
  due_date: string;
  created_at: string;
  departemen?: string;
  requester: string;
  assigned_designer?: string;
  files?: FileItem[] | null;
  rating?: string;
  rating_numeric?: number;
  review?: string;
  skor_ketepatan_waktu?: number | null;
  skor_kualitas?: number | null;
  skor_kpi_akhir?: number | null;
}

interface KomentarItem {
  id: number;
  created_at: string;
  message: string;
  user_id: string;
  user_name?: string;
}

// Status yang boleh diset desainer. (DONE diputuskan requester saat menyetujui.)
const designerStatusOptions = ["PROGRESS", "REVIEW", "REVISION"];

export default function DetailPengerjaanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const s = createClient();
  const router = useRouter();
  const { userId } = useRoleGuard([ROLES.DESIGNER]);

  const [data, setData] = useState<PermintaanDetail | null>(null);
  const [requester, setRequester] = useState<{ name: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [komentar, setKomentar] = useState<KomentarItem[]>([]);
  const [pesanBaru, setPesanBaru] = useState("");
  const bottomChatRef = useRef<HTMLDivElement>(null);

  const fetchKomentar = useCallback(async () => {
    const { data: chat } = await s
      .from("komentar")
      .select("id, created_at, message, user_id, user_profiles ( name )")
      .eq("permintaan_id", id)
      .order("created_at", { ascending: true });
    if (chat) {
      setKomentar(
        chat.map((c: any) => ({
          id: c.id,
          created_at: c.created_at,
          message: c.message,
          user_id: c.user_id,
          user_name: c.user_profiles?.name || "User",
        }))
      );
      setTimeout(
        () => bottomChatRef.current?.scrollIntoView({ behavior: "smooth" }),
        100
      );
    }
  }, [s, id]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: row, error } = await s
      .from("permintaan")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      toast.error("Gagal memuat data: " + error.message);
      setData(null);
    } else {
      setData({
        ...row,
        files: Array.isArray(row.files) ? row.files : [],
      } as PermintaanDetail);
      if (row.requester) {
        const { data: r } = await s
          .from("user_profiles")
          .select("name, email")
          .eq("id", row.requester)
          .single();
        if (r) setRequester(r);
      }
    }
    setLoading(false);
  }, [s, id]);

  useEffect(() => {
    fetchData();
    fetchKomentar();
  }, [fetchData, fetchKomentar]);

  // Guard kepemilikan: hanya desainer yang di-assign yang boleh mengeksekusi.
  useEffect(() => {
    if (data && userId && data.assigned_designer !== userId) {
      toast.error("Tugas ini bukan milik Anda.");
      router.replace("/permintaan-desain-designer/tugas-saya");
    }
  }, [data, userId, router]);

  const handleStatusChange = async (val: string) => {
    if (!data) return;
    setIsSubmitting(true);
    const { error } = await s
      .from("permintaan")
      .update({ status: val })
      .eq("id", id);
    if (error) toast.error("Gagal ubah status: " + error.message);
    else {
      toast.success(`Status diubah menjadi ${val}`);
      setData((prev) => (prev ? { ...prev, status: val } : null));
    }
    setIsSubmitting(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data) return;
    setIsUploading(true);
    try {
      const filePath = `${id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await s.storage
        .from("hasil-desain")
        .upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = s.storage
        .from("hasil-desain")
        .getPublicUrl(filePath);
      const newFiles = [
        ...(data.files || []),
        { name: file.name, url: urlData.publicUrl },
      ];
      const { error: dbErr } = await s
        .from("permintaan")
        .update({ files: newFiles })
        .eq("id", id);
      if (dbErr) throw dbErr;
      setData((prev) => (prev ? { ...prev, files: newFiles } : null));
      toast.success("File hasil diunggah.");
    } catch (err: any) {
      toast.error("Gagal mengunggah: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (f: FileItem) => {
    if (!data || !window.confirm(`Hapus file ${f.name}?`)) return;
    setIsDeleting(f.name);
    try {
      const newFiles = (data.files || []).filter((x) => x.name !== f.name);
      const { error } = await s
        .from("permintaan")
        .update({ files: newFiles })
        .eq("id", id);
      if (error) throw error;
      setData((prev) => (prev ? { ...prev, files: newFiles } : null));
      toast.success("File dihapus.");
    } catch (err: any) {
      toast.error("Gagal hapus file: " + err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pesanBaru.trim() || !userId) return;
    const msg = pesanBaru;
    setPesanBaru("");
    const { error } = await s
      .from("komentar")
      .insert({ permintaan_id: id, user_id: userId, message: msg });
    if (error) {
      toast.error("Gagal kirim pesan.");
      setPesanBaru(msg);
    } else {
      fetchKomentar();
    }
  };

  if (loading && !data) {
    return (
      <Content title="Memuat..." size="lg">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Content>
    );
  }

  if (!data) return <Content title="404" description="Data tidak ditemukan." />;

  return (
    <Content title="Kerjakan Permintaan" size="lg">
      <div className="grid gap-6 md:grid-cols-3">
        {/* KIRI: detail + files + chat */}
        <div className="md:col-span-2 space-y-6">
          <div className="border rounded-lg p-6 bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">{data.judul}</h2>
                <p className="text-sm text-muted-foreground">
                  {data.project} • {data.departemen}
                </p>
              </div>
              <StatusBadge status={data.status} />
            </div>
            <Separator />
            <div>
              <Label className="text-base font-semibold mb-2 block">
                Deskripsi
              </Label>
              <div className="text-sm p-4 bg-muted/30 rounded-md whitespace-pre-wrap leading-relaxed">
                {data.deskripsi || "-"}
              </div>
            </div>

            {/* FILES (hasil desain) */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <Label className="text-base font-semibold">
                  File Hasil Desain
                </Label>
                <div>
                  <Input
                    type="file"
                    id="file-hasil"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={isUploading}
                  />
                  <Button variant="outline" size="sm" asChild disabled={isUploading}>
                    <label htmlFor="file-hasil" className="cursor-pointer">
                      {isUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      ) : (
                        <UploadCloud className="h-3 w-3 mr-2" />
                      )}
                      Unggah Hasil
                    </label>
                  </Button>
                </div>
              </div>
              {data.files && data.files.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">No</TableHead>
                        <TableHead>Nama File</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.files.map((f, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium truncate max-w-[220px]">
                            {f.name}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                asChild
                              >
                                <a href={f.url} target="_blank" rel="noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteFile(f)}
                                disabled={isDeleting === f.name}
                              >
                                {isDeleting === f.name ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center p-6 border border-dashed rounded-md text-muted-foreground text-sm">
                  Belum ada file hasil.
                </div>
              )}
            </div>
          </div>

          {/* CHAT */}
          <div className="border rounded-lg bg-card shadow-sm flex flex-col h-[420px]">
            <div className="p-4 border-b bg-muted/20 font-semibold text-sm">
              Diskusi dengan Requester
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950/50">
              {komentar.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10 opacity-60">
                  Belum ada diskusi.
                </p>
              ) : (
                komentar.map((k) => {
                  const isMe = k.user_id === userId;
                  return (
                    <div
                      key={k.id}
                      className={cn(
                        "flex gap-2 max-w-[85%]",
                        isMe ? "ml-auto flex-row-reverse" : ""
                      )}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">
                          {k.user_name?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "p-2 px-3 rounded-lg text-sm shadow-sm",
                          isMe
                            ? "bg-primary text-primary-foreground"
                            : "bg-white dark:bg-slate-800 border"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{k.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomChatRef} />
            </div>
            <form
              onSubmit={handleSendComment}
              className="p-3 border-t flex gap-2 bg-card"
            >
              <Input
                placeholder="Ketik pesan..."
                value={pesanBaru}
                onChange={(e) => setPesanBaru(e.target.value)}
              />
              <Button type="submit" size="icon" disabled={!pesanBaru.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* KANAN: kontrol status + info */}
        <div className="space-y-6">
          <div className="border rounded-lg p-5 bg-card shadow-sm space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Update Status
            </Label>
            <Select
              value={designerStatusOptions.includes(data.status) ? data.status : undefined}
              onValueChange={handleStatusChange}
              disabled={isSubmitting || data.status === "DONE"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                {designerStatusOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Set ke <b>REVIEW</b> bila hasil siap dinilai requester. Status{" "}
              <b>DONE</b> ditetapkan requester saat menyetujui.
            </p>
          </div>

          <KpiScores
            ketepatan={data.skor_ketepatan_waktu}
            kualitas={data.skor_kualitas}
            akhir={data.skor_kpi_akhir}
          />

          <div className="border rounded-lg p-5 bg-card shadow-sm space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Info Project
            </h3>
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Requester</p>
                <p className="font-medium text-sm">{requester?.name || "-"}</p>
                <p className="text-xs text-muted-foreground">
                  {requester?.email}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="font-medium text-sm">
                  {format(new Date(data.due_date), "dd MMMM yyyy", {
                    locale: indonesiaLocale,
                  })}
                </p>
              </div>
            </div>
            {data.rating && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <p className="font-medium text-sm">{data.rating} / 5</p>
                  {data.review && (
                    <p className="text-xs italic text-muted-foreground">
                      &quot;{data.review}&quot;
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Content>
  );
}
