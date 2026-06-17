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
import {
  Loader2,
  Plus,
  Search,
  Newspaper,
  FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useState,
  useCallback,
  useTransition,
  Suspense,
} from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx"; // Pastikan install xlsx: npm install xlsx
import { isRequester, normalizeRole } from "@/lib/auth/roles";

interface Permintaan {
  id: string;
  judul: string;
  project: string;
  status: string;
  due_date: string;
  created_at: string;
  requester?: string;
  requester_name?: string; // Nama Peminta (Untuk Admin)
  assigned_designer?: string | null;
  designer_name?: string; // Nama Desainer
  departemen?: string;
  deskripsi?: string;
}

const LIMIT_OPTIONS = [10, 25, 50, 100];

function PermintaanList() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State User & Data
  const [permintaanList, setPermintaanList] = useState<Permintaan[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("user");

  // State UI
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Filter Params
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const limit = Number(searchParams.get("limit") || 10);

  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);

  // 1. Cek User & Role (halaman ini khusus requester)
  useEffect(() => {
    async function initUser() {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (user) {
        // Cek Role
        const { data: profile } = await s
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        const role = normalizeRole(profile?.role);
        if (!isRequester(role)) {
          router.replace("/dashboard");
          return;
        }
        setCurrentUser(user);
        setUserRole(role);
      }
    }
    initUser();
  }, [s, router]);

  // 2. Query Data (Cerdas: Admin vs User)
  useEffect(() => {
    async function fetchData() {
      if (!currentUser) return;
      setLoading(true);

      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      // Select basic data + count
      let query = s.from("permintaan").select("*", { count: "exact" });

      // LOGIKA KUNCI: Jika BUKAN admin, filter hanya punya sendiri
      if (userRole !== "admin") {
        query = query.eq("requester", currentUser.id);
      }

      // Filter Umum
      if (searchTerm) query = query.ilike("judul", `%${searchTerm}%`);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate} 23:59:59`);

      // Pagination & Order
      query = query.range(from, to).order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal: " + error.message);
        setLoading(false);
        return;
      }

      let formattedData = (data as Permintaan[]) || [];
      const isAdmin = userRole === "admin";

      // --- MAPPING NAMA (Admin butuh nama requester, User butuh nama admin/desainer) ---

      const userIdsToFetch = new Set<string>();
      formattedData.forEach((item) => {
        if (item.requester) userIdsToFetch.add(item.requester); // Untuk Admin lihat siapa yg minta
        if (item.assigned_designer) userIdsToFetch.add(item.assigned_designer); // Untuk lihat desainer
      });

      if (userIdsToFetch.size > 0) {
        // Ambil nama dari tabel users / user_profiles
        const { data: profiles } = await s
          .from("user_profiles") // atau 'users' tergantung setupmu
          .select("id, name")
          .in("id", Array.from(userIdsToFetch));

        const nameMap: Record<string, string> = {};
        profiles?.forEach((p) => (nameMap[p.id] = p.name));

        formattedData = formattedData.map((item) => ({
          ...item,
          requester_name: item.requester ? nameMap[item.requester] : "Unknown",
          designer_name: item.assigned_designer
            ? nameMap[item.assigned_designer]
            : "-",
        }));
      }

      setPermintaanList(formattedData);
      setTotalItems(count || 0);
      setLoading(false);
    }

    fetchData();
  }, [
    s,
    currentUser,
    userRole,
    currentPage,
    limit,
    searchTerm,
    statusFilter,
    startDate,
    endDate,
  ]);

  // 3. Handle URL Update
  const createQueryString = useCallback(
    (params: Record<string, string | number | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([k, v]) => {
        if (v) p.set(k, String(v));
        else p.delete(k);
      });
      if (!params.page) p.set("page", "1"); // Reset page on filter change
      return p.toString();
    },
    [searchParams],
  );

  const handleFilter = (key: string, value: string | undefined) => {
    startTransition(() => {
      router.push(pathname + "?" + createQueryString({ [key]: value }));
    });
  };

  // Debounce Search
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== searchTerm) handleFilter("search", searchInput);
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 4. Export Excel (Fitur Admin)
  const handleDownloadExcel = async () => {
    setIsExporting(true);
    try {
      // Fetch semua data sesuai filter (tanpa pagination)
      let query = s.from("permintaan").select(`
        created_at, due_date, judul, deskripsi, status, departemen, project, requester
      `);

      // Apply filters lagi (sama seperti tabel)
      if (searchTerm) query = query.ilike("judul", `%${searchTerm}%`);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate} 23:59:59`);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;

      // Kita butuh nama requester lagi karena query raw hanya dpt UUID
      const reqIds = [...new Set(data?.map((d) => d.requester))];
      const { data: profiles } = await s
        .from("user_profiles")
        .select("id, name")
        .in("id", reqIds);
      const nameMap: any = {};
      profiles?.forEach((p) => (nameMap[p.id] = p.name));

      const excelData = data?.map((item) => ({
        "Tanggal Dibuat": new Date(item.created_at).toLocaleDateString("id-ID"),
        "Due Date": new Date(item.due_date).toLocaleDateString("id-ID"),
        Judul: item.judul,
        Project: item.project,
        Departemen: item.departemen,
        Status: item.status,
        Peminta: nameMap[item.requester] || "Unknown",
        Deskripsi: item.deskripsi,
      }));

      const ws = XLSX.utils.json_to_sheet(excelData || []);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Permintaan");
      XLSX.writeFile(wb, "Laporan_Permintaan_Desain.xlsx");
      toast.success("Excel berhasil diunduh");
    } catch (e: any) {
      toast.error("Gagal export: " + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusVariant = (s: string) => {
    if (s === "DONE") return "default";
    if (s === "PROGRESS") return "secondary";
    if (s === "REVISION") return "outline";
    if (s === "REVIEW") return "destructive";
    return "secondary";
  };

  const isAdmin = userRole === "admin";

  return (
    <Content
      title={isAdmin ? "Semua Permintaan Desain" : "Permintaan Saya"}
      size="lg"
      cardAction={
        isAdmin ? (
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting}
            variant="outline"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Export Excel
          </Button>
        ) : (
          <Button asChild>
            <Link href="/permintaan-desain/buat">
              <Plus className="mr-2 h-4 w-4" /> Buat Baru
            </Link>
          </Button>
        )
      }
    >
      {/* FILTER AREA */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Baris 1: Search & Status */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari judul..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter || "all"}
            onValueChange={(val) =>
              handleFilter("status", val === "all" ? undefined : val)
            }
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="PROGRESS">Progress</SelectItem>
              <SelectItem value="REVIEW">Review</SelectItem>
              <SelectItem value="REVISION">Revision</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Baris 2: Date Range (Opsional, lebih relevan buat Admin) */}
        {isAdmin && (
          <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/30 p-3 rounded-md border">
            <div className="w-full md:w-auto">
              <span className="text-xs font-medium mb-1 block">Dari</span>
              <Input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
              />
            </div>
            <div className="w-full md:w-auto">
              <span className="text-xs font-medium mb-1 block">Sampai</span>
              <Input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                handleFilter("startDate", startDateInput);
                handleFilter("endDate", endDateInput);
              }}
            >
              Filter Tanggal
            </Button>
          </div>
        )}
      </div>

      {/* TABLE AREA */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Project</TableHead>
              {isAdmin && <TableHead>Peminta</TableHead>}
              <TableHead>Desainer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 7}
                  className="text-center h-24"
                >
                  <div className="flex justify-center items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" /> Memuat...
                  </div>
                </TableCell>
              </TableRow>
            ) : permintaanList.length > 0 ? (
              permintaanList.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{(currentPage - 1) * limit + idx + 1}</TableCell>
                  <TableCell className="font-semibold">{item.judul}</TableCell>
                  <TableCell>{item.project}</TableCell>

                  {/* Kolom Khusus Admin: Siapa Peminta */}
                  {isAdmin && (
                    <TableCell>{item.requester_name || "Unknown"}</TableCell>
                  )}

                  {/* Kolom Desainer */}
                  <TableCell>
                    {item.designer_name ||
                      (item.assigned_designer ? (
                        "..."
                      ) : (
                        <span className="text-muted-foreground italic text-xs">
                          Belum ada
                        </span>
                      ))}
                  </TableCell>

                  <TableCell>
                    <Badge variant={getStatusVariant(item.status) as any}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(item.due_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/permintaan-desain/${item.id}`}>Detail</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 7}
                  className="text-center h-24 text-muted-foreground"
                >
                  Tidak ada data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* FOOTER & PAGINATION */}
      <div className="mt-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(limit)}
            onValueChange={(v) => handleFilter("limit", v)}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((o) => (
                <SelectItem key={o} value={String(o)}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

export default function PermintaanClientContent() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <PermintaanList />
    </Suspense>
  );
}
