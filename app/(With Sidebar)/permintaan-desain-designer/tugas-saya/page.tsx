// Tugas Saya — tiket yang sudah diambil oleh desainer yang sedang login.
"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { ROLES } from "@/lib/auth/roles";

interface Tugas {
  id: string;
  judul: string;
  project: string | null;
  departemen: string | null;
  status: string;
  due_date: string;
}

export default function TugasSayaPage() {
  const s = createClient();
  const { userId, loading: guardLoading } = useRoleGuard([ROLES.DESIGNER]);

  const [list, setList] = useState<Tugas[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchTugas = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    let query = s
      .from("permintaan")
      .select("id, judul, project, departemen, status, due_date")
      .eq("assigned_designer", userId);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data, error } = await query.order("due_date", { ascending: true });

    if (error) {
      toast.error("Gagal memuat tugas: " + error.message);
      setList([]);
    } else {
      setList((data as Tugas[]) || []);
    }
    setLoading(false);
  }, [s, userId, statusFilter]);

  useEffect(() => {
    fetchTugas();
  }, [fetchTugas]);

  const showSkeleton = guardLoading || loading;

  return (
    <Content
      title="Tugas Saya"
      description="Tiket yang sedang/sudah Anda tangani."
      size="lg"
      cardAction={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="PROGRESS">Progress</SelectItem>
            <SelectItem value="REVIEW">Review</SelectItem>
            <SelectItem value="REVISION">Revision</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
          </SelectContent>
        </Select>
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
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
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
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(item.due_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/permintaan-desain-designer/${item.id}`}>
                        Kerjakan
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ClipboardCheck className="h-8 w-8 opacity-50" />
                    <p className="font-medium">Belum ada tugas</p>
                    <p className="text-sm">
                      Ambil tiket dari{" "}
                      <Link
                        href="/permintaan-desain-designer"
                        className="text-primary hover:underline"
                      >
                        Antrean Tugas
                      </Link>{" "}
                      untuk mulai bekerja.
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
