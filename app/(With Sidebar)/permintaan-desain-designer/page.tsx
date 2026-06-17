// Antrean Tugas (pool terbuka) — desainer mengambil tiket secara mandiri.
"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Inbox, HandMetal } from "lucide-react";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { ROLES } from "@/lib/auth/roles";

interface Antrean {
  id: string;
  judul: string;
  project: string | null;
  departemen: string | null;
  due_date: string;
  created_at: string;
}

export default function AntreanTugasPage() {
  const s = createClient();
  const router = useRouter();
  const { userId, loading: guardLoading } = useRoleGuard([ROLES.DESIGNER]);

  const [list, setList] = useState<Antrean[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    // Antrean = tiket TO DO yang belum diambil siapa pun.
    const { data, error } = await s
      .from("permintaan")
      .select("id, judul, project, departemen, due_date, created_at")
      .eq("status", "TO DO")
      .is("assigned_designer", null)
      .order("due_date", { ascending: true });

    if (error) {
      toast.error("Gagal memuat antrean: " + error.message);
      setList([]);
    } else {
      setList((data as Antrean[]) || []);
    }
    setLoading(false);
  }, [s]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Ambil tugas: UPDATE atomik dengan syarat masih kosong & TO DO.
  // Jika 0 baris terupdate -> tiket sudah diambil desainer lain.
  const handleAmbil = async (ticketId: string) => {
    if (!userId) return;
    setClaimingId(ticketId);
    try {
      const { data, error } = await s
        .from("permintaan")
        .update({
          assigned_designer: userId,
          status: "PROGRESS",
          assigned_at: new Date().toISOString(),
        })
        .eq("id", ticketId)
        .is("assigned_designer", null)
        .eq("status", "TO DO")
        .select("id");

      if (error) throw error;

      if (data && data.length === 1) {
        toast.success("Tugas berhasil diambil!");
        router.push(`/permintaan-desain-designer/${ticketId}`);
      } else {
        toast.error("Tiket ini baru saja diambil desainer lain.");
        await fetchQueue();
      }
    } catch (e: any) {
      toast.error("Gagal mengambil tugas: " + e.message);
      await fetchQueue();
    } finally {
      setClaimingId(null);
    }
  };

  const showSkeleton = guardLoading || loading;

  return (
    <Content
      title="Antrean Tugas"
      description="Tiket yang belum diambil siapa pun. Ambil tugas untuk mulai mengerjakan."
      size="lg"
      cardAction={
        <Button variant="outline" onClick={fetchQueue} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Segarkan"
          )}
        </Button>
      }
    >
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : list.length > 0 ? (
              list.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell className="font-semibold">{item.judul}</TableCell>
                  <TableCell>{item.project || "-"}</TableCell>
                  <TableCell>{item.departemen || "-"}</TableCell>
                  <TableCell>
                    {new Date(item.due_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => handleAmbil(item.id)}
                      disabled={claimingId === item.id}
                    >
                      {claimingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <HandMetal className="h-4 w-4 mr-2" /> Ambil Tugas
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Inbox className="h-8 w-8 opacity-50" />
                    <p className="font-medium">Antrean kosong</p>
                    <p className="text-sm">
                      Tidak ada tiket baru yang menunggu untuk dikerjakan.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Content>
  );
}
