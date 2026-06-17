"use client";

import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createClient } from "@/lib/supabase/client";
import { Loader2, Newspaper, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx"; // Impor library Excel
import { StatusBadge } from "@/components/status-badge";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { ROLES } from "@/lib/auth/roles";

// Definisikan tipe data untuk konsistensi
interface Permintaan {
  id: string;
  judul: string;
  status: string;
  due_date: string;
  created_at: string;
  departemen?: string | null;
  assigned_designer?: string | null;
  designer_name?: string;
}

// Tipe data untuk ekspor Excel yang lebih lengkap
interface PermintaanExport {
  id: string;
  created_at: string;
  due_date: string;
  judul: string;
  deskripsi: string;
  status: string;
  departemen: string;
  project: string;
  // Relasi untuk mengambil nama requester
  requester: {
    name: string;
  } | null;
}

const LIMIT_OPTIONS = [10, 25, 50, 100];

export function PermintaanAdminClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Guard: halaman monitoring hanya untuk admin.
  useRoleGuard([ROLES.ADMIN]);

  // State
  const [permintaanList, setPermintaanList] = useState<Permintaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isPending, startTransition] = useTransition();

  // State dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const departemenFilter = searchParams.get("departemen") || "";
  const assignFilter = searchParams.get("assign") || ""; // "assigned" | "unassigned"
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const limit = Number(searchParams.get("limit") || 10);

  // State untuk input form
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (value) {
          params.set(name, String(value));
        } else {
          params.delete(name);
        }
      });
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  useEffect(() => {
    async function fetchPermintaan() {
      setLoading(true);

      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      let query = s
        .from("permintaan")
        .select(
          `id, judul, status, due_date, created_at, departemen, assigned_designer`,
          { count: "exact" }
        );

      if (searchTerm) query = query.ilike("judul", `%${searchTerm}%`);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (departemenFilter) query = query.eq("departemen", departemenFilter);
      if (assignFilter === "assigned")
        query = query.not("assigned_designer", "is", null);
      if (assignFilter === "unassigned")
        query = query.is("assigned_designer", null);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate} 23:59:59`);

      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data: " + error.message);
        setPermintaanList([]);
        setLoading(false);
        return;
      }

      let rows = (data as Permintaan[]) || [];

      // Resolusi nama desainer (assigned_designer = uuid).
      const designerIds = [
        ...new Set(rows.map((r) => r.assigned_designer).filter(Boolean)),
      ] as string[];
      if (designerIds.length > 0) {
        const { data: profiles } = await s
          .from("user_profiles")
          .select("id, name")
          .in("id", designerIds);
        const nameMap: Record<string, string> = {};
        profiles?.forEach((p) => (nameMap[p.id] = p.name));
        rows = rows.map((r) => ({
          ...r,
          designer_name: r.assigned_designer
            ? nameMap[r.assigned_designer] || "..."
            : undefined,
        }));
      }

      setPermintaanList(rows);
      setTotalItems(count || 0);
      setLoading(false);
    }
    fetchPermintaan();
  }, [
    s,
    currentPage,
    searchTerm,
    statusFilter,
    departemenFilter,
    assignFilter,
    startDate,
    endDate,
    limit,
  ]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchTerm) {
        startTransition(() => {
          router.push(
            `${pathname}?${createQueryString({ search: searchInput })}`
          );
        });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleDownloadExcel = async () => {
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap untuk diunduh...");

    try {
      // REVISI: Query baru untuk mengambil semua data yang dibutuhkan untuk Excel
      let query = s.from("permintaan").select<string, PermintaanExport>(
        `
            created_at,
            due_date,
            judul,
            deskripsi,
            status,
            departemen,
            project,
            requester:user_profiles (name)
            `
      );

      // Terapkan semua filter yang sedang aktif
      if (searchTerm) query = query.ilike("judul", `%${searchTerm}%`);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate} 23:59:59`);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.warning(
          "Tidak ada data untuk diekspor sesuai filter yang dipilih."
        );
        return;
      }

      // REVISI: Format data sesuai kolom yang diminta
      const formattedData = data.map((item) => ({
        "Tanggal Dibuat": new Date(item.created_at).toLocaleString("id-ID", {
          dateStyle: "long",
          timeStyle: "short",
        }),
        "Due Date": new Date(item.due_date).toLocaleDateString("id-ID", {
          dateStyle: "long",
        }),
        "Judul Permintaan": item.judul,
        Deskripsi: item.deskripsi,
        Status: item.status,
        Departemen: item.departemen,
        Project: item.project,
        Requester: item.requester?.name || "N/A",
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Permintaan Desain");
      XLSX.writeFile(
        workbook,
        `Laporan_Permintaan_Desain_${
          new Date().toISOString().split("T")[0]
        }.xlsx`
      );

      toast.success("Data berhasil diunduh!");
    } catch (error: any) {
      toast.error("Gagal mengunduh data", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusVariant = (status: Permintaan["status"]) => {
    switch (status) {
      case "DONE":
        return "default";
      case "PROGRESS":
        return "secondary";
      case "REVISION":
        return "outline";
      case "REVIEW":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <Content title="Daftar Semua Permintaan Desain" size="lg">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan judul..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting}
            className="w-full md:w-auto"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Newspaper className="mr-2 h-4 w-4" />
            )}
            Download Excel
          </Button>
        </div>

        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    status: value === "all" ? undefined : value,
                  })
                }
                defaultValue={statusFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="TO DO">To Do</SelectItem>
                  <SelectItem value="PROGRESS">Progress</SelectItem>
                  <SelectItem value="REVISION">Revision</SelectItem>
                  <SelectItem value="REVIEW">Review</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Penanganan</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    assign: value === "all" ? undefined : value,
                  })
                }
                defaultValue={assignFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="assigned">Sudah diambil desainer</SelectItem>
                  <SelectItem value="unassigned">Belum diambil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Departemen</label>
              <Input
                placeholder="Filter departemen..."
                defaultValue={departemenFilter}
                onChange={(e) =>
                  handleFilterChange({ departemen: e.target.value || undefined })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Dari Tanggal</label>
              <Input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Sampai Tanggal</label>
              <Input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              className="mt-4 w-full md:w-auto"
              onClick={() =>
                handleFilterChange({
                  startDate: startDateInput,
                  endDate: endDateInput,
                })
              }
            >
              Terapkan Filter Tanggal
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Desainer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memuat data...
                  </div>
                </TableCell>
              </TableRow>
            ) : permintaanList.length > 0 ? (
              permintaanList.map((permintaan, index) => (
                <TableRow key={permintaan.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {permintaan.judul}
                  </TableCell>
                  <TableCell>{permintaan.departemen || "-"}</TableCell>
                  <TableCell>
                    {permintaan.designer_name || (
                      <span className="text-muted-foreground italic text-xs">
                        Belum diambil
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={permintaan.status} />
                  </TableCell>
                  <TableCell>
                    {new Date(permintaan.due_date).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/permintaan-desain-admin/${permintaan.id}`}>
                        Lihat Detail
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  Tidak ada permintaan yang ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Tampilkan</span>
          <Select
            value={String(limit)}
            onValueChange={(value) => handleFilterChange({ limit: value })}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder={limit} />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>dari {totalItems} hasil.</span>
        </div>
        <PaginationComponent
          basePath={pathname}
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={limit}
        />
      </div>
    </Content>
  );
}
