"use client";

import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Paperclip,
  RotateCcw,
  Send,
  Star,
  Trash2,
  UploadCloud,
  User,
  ShieldCheck,
  RefreshCw, // Icon Refresh
  AlertTriangle, // Icon Warning
  Quote, // Icon Review
  Info,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isRequester } from "@/lib/auth/roles";

// --- TIPE DATA ---

interface FileItem {
  name: string;
  url: string;
}

interface UserProfile {
  id: string;
  name: string;
  email?: string;
  role: string;
}

interface KomentarItem {
  id: number;
  created_at: string;
  message: string;
  user_id: string;
  user_name?: string;
  sender_role?: string;
}

interface PermintaanDetail {
  id: string;
  judul: string;
  deskripsi: string;
  project: string;
  status: string;
  due_date: string;
  created_at: string;
  requester: string;
  requester_data?: UserProfile;
  assigned_designer?: string;
  designer_data?: UserProfile;
  files?: FileItem[] | null;
  rating?: string;
  rating_numeric?: number;
  review?: string;
  departemen?: string;
}

const statusOptions = [
  { label: "TO DO", value: "TO DO" },
  { label: "PROGRESS", value: "PROGRESS" },
  { label: "REVIEW", value: "REVIEW" },
  { label: "REVISION", value: "REVISION" },
  { label: "DONE", value: "DONE" },
];

export default function DetailPermintaanPage() {
  const params = useParams();
  const router = useRouter();
  const s = createClient();
  const id = params.id as string;

  // State Data Utama
  const [data, setData] = useState<PermintaanDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Revisi & Review (User)
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  // State Diskusi
  const [komentar, setKomentar] = useState<KomentarItem[]>([]);
  const [pesanBaru, setPesanBaru] = useState("");
  const [loadingKomentar, setLoadingKomentar] = useState(false);
  const bottomChatRef = useRef<HTMLDivElement>(null);

  // State Upload
  const [isUploading, setIsUploading] = useState(false);

  // --- FETCH DATA ---

  // Fungsi dipisahkan agar bisa dipanggil ulang untuk Quick Refresh
  const fetchAllData = async () => {
    // setLoading(true); // Opsional: Matikan loading full screen jika hanya refresh parsial
    try {
      // 1. Get Current User & Role
      const {
        data: { user },
      } = await s.auth.getUser();

      if (user) {
        const { data: myProfile } = await s
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setCurrentUser(myProfile);
      }

      // 2. Get Detail Permintaan
      const { data: requestData, error } = await s
        .from("permintaan")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // 3. Fetch Relations
      let designerInfo = null;
      let requesterInfo = null;

      if (requestData.assigned_designer) {
        const { data: a } = await s
          .from("user_profiles")
          .select("name, email, role")
          .eq("id", requestData.assigned_designer)
          .single();
        if (a) designerInfo = a;
      }

      if (requestData.requester) {
        const { data: r } = await s
          .from("user_profiles")
          .select("name, email, role")
          .eq("id", requestData.requester)
          .single();
        if (r) requesterInfo = r;
      }

      setData({
        ...requestData,
        designer_data: designerInfo || undefined,
        requester_data: requesterInfo || undefined,
        files: Array.isArray(requestData.files) ? requestData.files : [],
      });
    } catch (e: any) {
      toast.error("Gagal memuat data: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchKomentar = async (reqId: string) => {
    setLoadingKomentar(true);
    const { data: chatData, error } = await s
      .from("komentar")
      .select(
        `
        id, created_at, message, user_id,
        user_profiles ( name, role ) 
      `,
      )
      .eq("permintaan_id", reqId)
      .order("created_at", { ascending: true });

    if (!error && chatData) {
      const mappedComments = chatData.map((c: any) => ({
        id: c.id,
        created_at: c.created_at,
        message: c.message,
        user_id: c.user_id,
        user_name: c.user_profiles?.name || "Unknown",
        sender_role: c.user_profiles?.role || "user",
      }));
      setKomentar(mappedComments);
      setTimeout(
        () => bottomChatRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    }
    setLoadingKomentar(false);
  };

  useEffect(() => {
    if (id) {
      fetchAllData();
      fetchKomentar(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, s, router]);

  // Guard: halaman ini khusus requester. Admin -> monitoring, Desainer -> route designer.
  useEffect(() => {
    if (currentUser && !isRequester(currentUser.role)) {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  // --- QUICK REFRESH HANDLERS ---
  const handleRefreshData = async () => {
    const toastId = toast.loading("Menyegarkan data...");
    await fetchAllData();
    toast.dismiss(toastId);
    toast.success("Data diperbarui");
  };

  const handleRefreshChat = async () => {
    await fetchKomentar(id);
    toast.success("Chat diperbarui");
  };

  // --- HANDLERS SHARED ---

  const handleDownloadFile = (file: FileItem) => {
    window.open(file.url, "_blank");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !data) return;

    setIsUploading(true);
    const toastId = toast.loading("Mengunggah file...");

    const uploadPromises = Array.from(files).map(async (file) => {
      const filePath = `${id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error } = await s.storage
        .from("permintaan")
        .upload(filePath, file);

      if (error) return { error, file };

      const { data: urlData } = s.storage
        .from("permintaan")
        .getPublicUrl(filePath);

      return {
        data: { name: file.name, url: urlData.publicUrl },
        error: null,
      };
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results
      .filter((r) => !r.error)
      .map((r) => r.data!);

    if (successfulUploads.length > 0) {
      const currentFiles = data.files || [];
      const newFilesList = [...currentFiles, ...successfulUploads];

      const { error: dbError } = await s
        .from("permintaan")
        .update({ files: newFilesList })
        .eq("id", id);

      if (dbError) {
        toast.error("Gagal simpan ke database", { id: toastId });
      } else {
        toast.success("File berhasil diunggah", { id: toastId });
        setData((prev) => (prev ? { ...prev, files: newFilesList } : null));
      }
    } else {
      toast.error("Gagal mengunggah", { id: toastId });
    }

    setIsUploading(false);
    e.target.value = "";
  };

  // --- HANDLERS DISKUSI ---

  const handleSendComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pesanBaru.trim() || !currentUser) return;

    const tempMessage = pesanBaru;
    setPesanBaru("");

    const { error } = await s.from("komentar").insert({
      permintaan_id: id,
      user_id: currentUser.id,
      message: tempMessage,
    });

    if (error) {
      toast.error("Gagal kirim pesan");
      setPesanBaru(tempMessage);
    } else {
      await fetchKomentar(id);
    }
  };

  // --- HANDLERS USER ACTIONS ---

  const handleFinishAndReview = async () => {
    if (rating === 0) {
      toast.warning("Berikan rating bintang.");
      return;
    }
    setIsSubmitting(true);
    const { error } = await s
      .from("permintaan")
      .update({
        status: "DONE",
        rating_numeric: rating,
        review: reviewText,
      })
      .eq("id", id);

    if (error) toast.error(error.message);
    else {
      toast.success("Permintaan selesai!");
      setData((prev) =>
        prev
          ? {
              ...prev,
              status: "DONE",
              rating_numeric: rating,
              review: reviewText,
            }
          : null,
      );
      setIsFinishOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleRequestRevision = async () => {
    if (!revisionNote.trim()) {
      toast.warning("Isi catatan revisi.");
      return;
    }
    setIsSubmitting(true);
    const oldDeskripsi = data?.deskripsi || "";
    const timeNow = new Date().toLocaleString("id-ID");
    const newDeskripsi = `${oldDeskripsi}\n\n[REVISI ${timeNow}]: ${revisionNote}`;

    const { error } = await s
      .from("permintaan")
      .update({
        status: "REVISION",
        deskripsi: newDeskripsi,
      })
      .eq("id", id);

    if (error) toast.error(error.message);
    else {
      toast.success("Revisi dikirim.");
      setData((prev) =>
        prev ? { ...prev, status: "REVISION", deskripsi: newDeskripsi } : null,
      );
      setIsRevisionOpen(false);
      // Auto kirim chat notifikasi juga agar jelas
      await s.from("komentar").insert({
        permintaan_id: id,
        user_id: currentUser?.id,
        message: `[SYSTEM] Mengirim permintaan REVISI: "${revisionNote}"`,
      });
      fetchKomentar(id);
    }
    setIsSubmitting(false);
  };

  // --- RENDER HELPERS ---

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "DONE")
      return <Badge className="bg-green-600 hover:bg-green-700">Selesai</Badge>;
    if (s === "PROGRESS")
      return <Badge variant="secondary">Sedang Dikerjakan</Badge>;
    if (s === "REVISION")
      return (
        <Badge
          variant="outline"
          className="border-orange-500 text-orange-500 bg-orange-50 dark:bg-orange-950/20"
        >
          Perlu Revisi
        </Badge>
      );
    if (s === "REVIEW")
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700">Menunggu Review</Badge>
      );
    if (s === "TO DO") return <Badge variant="outline">Menunggu</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  if (loading) {
    return (
      <Content title="Memuat Data..." size="lg">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Content>
    );
  }

  if (!data) return <Content title="404" description="Data tidak ditemukan." />;

  const isReviewStatus = data.status === "REVIEW";
  const isDoneStatus = data.status === "DONE";
  const isRevisionStatus = data.status === "REVISION";

  return (
    <Content
      title="Detail Permintaan Desain"
      size="lg"
      cardAction={
        <div className="flex gap-2">
          {/* Quick Refresh Data Utama */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshData}
            title="Refresh Data"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" asChild>
            <Link href="/permintaan-desain">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-3">
        {/* KOLOM KIRI: Detail, Files, Chat */}
        <div className="md:col-span-2 space-y-6">
          {/* ALERT REVISI: Muncul jika status Revision */}
          {isRevisionStatus && (
            <Alert
              variant="default"
              className="border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-200"
            >
              <AlertTriangle className="h-4 w-4 stroke-orange-600" />
              <AlertTitle>Permintaan Revisi</AlertTitle>
              <AlertDescription>
                User meminta perbaikan desain. Cek detail revisi di deskripsi
                atau kolom diskusi di bawah.
              </AlertDescription>
            </Alert>
          )}

          {/* CARD DETAIL UTAMA */}
          <div className="border rounded-lg p-6 bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">{data.judul}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{data.project}</Badge>
                  {data.departemen && (
                    <Badge variant="secondary">{data.departemen}</Badge>
                  )}
                </div>
              </div>
              {getStatusBadge(data.status)}
            </div>

            <Separator />

            {/* Jika DONE, Tampilkan Review */}
            {isDoneStatus && data.rating_numeric && (
              <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-4 rounded-md space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold text-lg">
                    {data.rating_numeric} / 5
                  </span>
                  <span className="text-muted-foreground text-sm ml-1">
                    • Penilaian User
                  </span>
                </div>
                {data.review ? (
                  <div className="flex gap-2 items-start mt-2">
                    <Quote className="h-4 w-4 text-muted-foreground rotate-180 flex-shrink-0 mt-1" />
                    <p className="text-sm italic text-muted-foreground">
                      {data.review}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Tidak ada ulasan tertulis.
                  </p>
                )}
              </div>
            )}

            <div>
              <Label className="text-base font-semibold mb-2 block">
                Deskripsi
              </Label>
              <div className="prose dark:prose-invert max-w-none text-sm p-4 bg-muted/30 rounded-md whitespace-pre-wrap leading-relaxed">
                {data.deskripsi || "-"}
              </div>
            </div>

            {/* SECTION FILES */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <Label className="text-base font-semibold">Lampiran</Label>
                <div className="relative">
                  <Input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    onChange={handleUpload}
                    disabled={isUploading}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={isUploading}
                  >
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {isUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      ) : (
                        <UploadCloud className="h-3 w-3 mr-2" />
                      )}
                      Upload Tambahan
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
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2 max-w-[200px] truncate">
                              <Paperclip className="h-3 w-3 text-muted-foreground" />
                              <span title={f.name}>{f.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownloadFile(f)}
                              >
                                <Download className="h-4 w-4" />
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
                  Belum ada file.
                </div>
              )}
            </div>
          </div>

          {/* CHAT SECTION */}
          <div className="border rounded-lg bg-card shadow-sm flex flex-col h-[500px]">
            <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" /> Diskusi & Revisi
              </h3>
              {/* Quick Refresh Chat */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefreshChat}
                title="Refresh Chat"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
              {loadingKomentar ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="animate-spin text-muted-foreground" />
                </div>
              ) : komentar.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-10 opacity-60">
                  Belum ada diskusi.
                </div>
              ) : (
                komentar.map((k) => {
                  const isMe = k.user_id === currentUser?.id;
                  const isSystem = k.message.startsWith("[SYSTEM]"); // Deteksi pesan sistem
                  return (
                    <div
                      key={k.id}
                      className={cn(
                        "flex gap-3 max-w-[85%]",
                        isMe ? "ml-auto flex-row-reverse" : "",
                        isSystem ? "mx-auto max-w-full justify-center" : "",
                      )}
                    >
                      {!isSystem && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className={cn(
                              "text-xs",
                              isMe ? "bg-primary text-primary-foreground" : "",
                            )}
                          >
                            {k.user_name?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={cn(
                          "p-3 rounded-lg text-sm shadow-sm",
                          isSystem
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border border-orange-200 text-xs py-1"
                            : isMe
                              ? "bg-primary text-primary-foreground rounded-tr-none"
                              : "bg-white dark:bg-slate-800 border rounded-tl-none",
                        )}
                      >
                        {!isSystem && (
                          <div className="flex items-center gap-2 mb-1 opacity-80 text-xs font-medium">
                            <span>{k.user_name}</span>
                            {k.sender_role === "admin" && (
                              <Badge
                                variant="secondary"
                                className="h-4 px-1 text-[9px]"
                              >
                                ADMIN
                              </Badge>
                            )}
                            <span className="font-normal text-[10px] opacity-70">
                              {new Date(k.created_at).toLocaleTimeString(
                                "id-ID",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>
                        )}

                        <p className="whitespace-pre-wrap leading-relaxed">
                          {k.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomChatRef} />
            </div>
            <div className="p-4 border-t bg-card">
              <form onSubmit={handleSendComment} className="flex gap-2">
                <Input
                  placeholder="Ketik pesan..."
                  value={pesanBaru}
                  onChange={(e) => setPesanBaru(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!pesanBaru.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* USER ACTION AREA (Requester saat status REVIEW) */}
          {isReviewStatus && (
            <div className="border rounded-lg p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-5">
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <Info className="h-4 w-4" /> Konfirmasi Hasil
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Cek file di atas. Klik &quot;Selesai&quot; jika sudah oke,
                  atau &quot;Revisi&quot; jika belum.
                </p>
              </div>
              <div className="flex gap-3">
                <Dialog open={isRevisionOpen} onOpenChange={setIsRevisionOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <RotateCcw className="mr-2 h-4 w-4" /> Revisi
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Catatan Revisi</DialogTitle>
                      <DialogDescription>
                        Berikan detail revisi yang jelas agar desainer dapat
                        memperbaiki dengan cepat.
                      </DialogDescription>
                    </DialogHeader>
                    <Label>Detail Perbaikan</Label>
                    <Textarea
                      placeholder="Contoh: Ubah warna font menjadi biru, logo diperbesar sedikit..."
                      value={revisionNote}
                      onChange={(e) => setRevisionNote(e.target.value)}
                      rows={4}
                    />
                    <DialogFooter>
                      <Button
                        variant="ghost"
                        onClick={() => setIsRevisionOpen(false)}
                      >
                        Batal
                      </Button>
                      <Button
                        onClick={handleRequestRevision}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : (
                          "Kirim Revisi"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isFinishOpen} onOpenChange={setIsFinishOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Selesai
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Terima Hasil & Rating</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-4">
                      <Label>Seberapa puas Anda dengan hasil desain ini?</Label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            onClick={() => setRating(star)}
                            className={cn(
                              "h-8 w-8 cursor-pointer transition-colors hover:scale-110",
                              star <= rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/40",
                            )}
                          />
                        ))}
                      </div>
                      <div className="w-full">
                        <Label>Ulasan / Masukan (opsional)</Label>
                        <Textarea
                          placeholder="Tulis ulasan Anda..."
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleFinishAndReview}
                        disabled={isSubmitting}
                      >
                        Kirim
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </div>

        {/* KOLOM KANAN: Sidebar Info */}
        <div className="space-y-6">
          {/* INFO PROJECT */}
          <div className="border rounded-lg p-5 bg-card shadow-sm space-y-5 sticky top-6">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Info Project
            </h3>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="font-medium text-sm">
                  {new Date(data.due_date).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Dibuat Pada</p>
                <p className="font-medium text-sm">
                  {new Date(data.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <Separator />

            {/* Info Requester */}
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Requester</p>
                <p className="font-medium text-sm">
                  {data.requester_data?.name || "Memuat..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.requester_data?.email}
                </p>
              </div>
            </div>

            {/* Info Admin */}
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Desainer (PIC)</p>
                {data.designer_data ? (
                  <div className="mt-1">
                    <p className="font-medium text-sm">
                      {data.designer_data.name}
                    </p>
                    <Badge variant="outline" className="text-[10px] px-1 h-5">
                      Desainer
                    </Badge>
                  </div>
                ) : (
                  <p className="font-medium text-sm text-orange-600">
                    Belum ada
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Content>
  );
}
