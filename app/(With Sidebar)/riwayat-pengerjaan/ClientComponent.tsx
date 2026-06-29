"use client";

import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Search,
  Star,
  User,
  Briefcase,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as indonesiaLocale } from "date-fns/locale";
import Link from "next/link";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { ROLES } from "@/lib/auth/roles";

// Definisikan tipe data sesuai struktur tabel permintaan
interface RiwayatItem {
  id: string;
  judul: string;
  due_date: string;
  rating_numeric: number | null;
  review: string | null;
  requester: string | null;
  project: string | null;
  status: string;
  requester_name?: string; // Field tambahan untuk UI
}

const ITEMS_PER_PAGE = 9;

export function RiwayatAdminClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Guard: riwayat pengerjaan milik desainer.
  useRoleGuard([ROLES.DESIGNER]);

  // State
  const [riwayatList, setRiwayatList] = useState<RiwayatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [kpi, setKpi] = useState<{
    jumlah_selesai: number;
    avg_ketepatan: number | null;
    avg_kualitas: number | null;
    avg_kpi: number | null;
  } | null>(null);

  // State dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(searchTerm);

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [name, value] of Object.entries(paramsToUpdate)) {
        if (value) {
          params.set(name, String(value));
        } else {
          params.delete(name);
        }
      }
      if (paramsToUpdate.search !== undefined) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  useEffect(() => {
    async function fetchRiwayat() {
      setLoading(true);

      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        toast.error("Anda harus login untuk melihat riwayat.");
        setLoading(false);
        return;
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // 1. QUERY PERMINTAAN
      // Menggunakan select('*') agar lebih aman memastikan semua kolom (termasuk project) terambil
      let query = s
        .from("permintaan")
        .select("*", { count: "exact" })
        .eq("status", "DONE")
        .eq("assigned_designer", user.id) // hanya pekerjaan desainer yang login
        .order("due_date", { ascending: false });

      if (searchTerm) {
        query = query.ilike("judul", `%${searchTerm}%`);
      }

      query = query.range(from, to);

      const { data: rawData, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data: " + error.message);
        setRiwayatList([]);
        setLoading(false);
        return;
      }

      setTotalItems(count || 0);

      if (!rawData || rawData.length === 0) {
        setRiwayatList([]);
        setLoading(false);
        return;
      }

      // 2. FETCH USER PROFILES (Perbaikan: Menggunakan 'user_profiles')
      // Ambil daftar requester ID yang unik
      const requesterIds = Array.from(
        new Set(rawData.map((item) => item.requester).filter(Boolean))
      ) as string[];

      let userMap: Record<string, string> = {};

      if (requesterIds.length > 0) {
        // PERBAIKAN: Menggunakan tabel 'user_profiles' sesuai dashboard/page.tsx
        const { data: profiles, error: profileError } = await s
          .from("user_profiles")
          .select("id, name")
          .in("id", requesterIds);

        // Debugging: Cek di console browser jika masih error
        if (profileError) {
          console.error("Error fetching profiles:", profileError);
        }

        if (profiles) {
          profiles.forEach((p) => {
            userMap[p.id] = p.name;
          });
        }
      }

      // 3. GABUNGKAN DATA
      const finalData = rawData.map((item) => {
        // Logika Fallback Nama
        let displayName = "Tanpa Nama";
        if (item.requester) {
          // Jika ada di map pakai map, jika tidak tampilkan potong UUID agar rapi
          displayName =
            userMap[item.requester] || `User: ${item.requester.slice(0, 4)}...`;
        }

        return {
          ...item,
          requester_name: displayName,
          // Pastikan project tidak null saat di-render
          project: item.project || "Project Umum",
        };
      });

      setRiwayatList(finalData);
      setLoading(false);
    }

    fetchRiwayat();
  }, [s, currentPage, searchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => {
      router.push(pathname + "?" + createQueryString({ search: searchInput }));
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, pathname, router, createQueryString]);

  // Ambil ringkasan KPI pribadi desainer.
  useEffect(() => {
    async function fetchKpi() {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) return;
      const { data } = await s.rpc("get_designer_kpi_report", {
        p_designer: user.id,
      });
      if (Array.isArray(data) && data.length > 0) setKpi(data[0]);
      else setKpi({ jumlah_selesai: 0, avg_ketepatan: null, avg_kualitas: null, avg_kpi: null });
    }
    fetchKpi();
  }, [s]);

  return (
    <Content title="Riwayat Pekerjaan Selesai" size="lg">
      {/* PANEL KPI PRIBADI DESAINER (dari RPC get_designer_kpi_report) */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Rata-rata Ketepatan Waktu", value: kpi?.avg_ketepatan },
          { label: "Rata-rata Kualitas (Rating)", value: kpi?.avg_kualitas },
          { label: "Rata-rata KPI Akhir", value: kpi?.avg_kpi },
        ].map((m) => (
          <Card key={m.label} className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardDescription>{m.label}</CardDescription>
              <CardTitle className="text-2xl">
                {m.value === null || m.value === undefined
                  ? "—"
                  : Number(m.value).toFixed(1)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Dari {kpi?.jumlah_selesai ?? 0} tugas selesai.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search Bar */}
      <div className="flex justify-center mb-6">
        <div className="relative w-full md:w-2/3 lg:w-1/2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan judul..."
            className="pl-10 shadow-sm"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">
            Memuat riwayat pekerjaan...
          </p>
        </div>
      ) : riwayatList.length > 0 ? (
        // Grid Card
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {riwayatList.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col hover:shadow-lg transition-all duration-200 border-muted/60 group"
            >
              <CardHeader className="pb-3 relative">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 h-auto bg-green-50 text-green-700 border-green-200"
                  >
                    SELESAI
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {item.due_date
                      ? format(new Date(item.due_date), "dd MMM yyyy", {
                          locale: indonesiaLocale,
                        })
                      : "-"}
                  </span>
                </div>

                <CardTitle
                  className="text-lg leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2"
                  title={item.judul}
                >
                  {item.judul}
                </CardTitle>

                {/* Info Project & Peminta */}
                <div className="mt-4 space-y-2 pt-3 border-t border-dashed">
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5 shrink-0" />
                    <span
                      className="font-medium truncate text-foreground/80 max-w-[200px]"
                      title={item.project || ""}
                    >
                      {item.project}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span
                      className="font-medium truncate text-foreground/80 max-w-[200px]"
                      title={item.requester_name}
                    >
                      {item.requester_name}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-grow pt-0 pb-4">
                {/* Bagian Rating */}
                {item.rating_numeric ? (
                  <div className="bg-yellow-50/50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/40 mt-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-500 uppercase tracking-wide">
                        Rating User
                      </span>
                      <div className="flex items-center gap-1 bg-white dark:bg-black/20 px-1.5 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-800">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        <span className="font-bold text-xs text-yellow-700 dark:text-yellow-400">
                          {item.rating_numeric}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground italic line-clamp-3 leading-relaxed">
                      &quot;{item.review || "Tidak ada komentar tertulis."}
                      &quot;
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-xs text-muted-foreground/60 italic border border-dashed rounded-lg bg-muted/20">
                    <AlertCircle className="h-4 w-4 mb-1 opacity-50" />
                    Belum dinilai user
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-0">
                <Button
                  variant="default"
                  className="w-full shadow-sm"
                  size="sm"
                  asChild
                >
                  <Link href={`/permintaan-desain-designer/${item.id}`}>
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Lihat Detail
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        // Empty State
        <div className="flex flex-col justify-center items-center py-16 px-4 border rounded-xl bg-muted/5 border-dashed text-center animate-in fade-in-50">
          <div className="bg-muted p-4 rounded-full mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            Tidak Ada Riwayat
          </h3>
          <p className="text-muted-foreground mt-2 max-w-sm">
            Tidak ditemukan pekerjaan selesai yang sesuai dengan kriteria
            pencarian &quot;{searchInput}&quot;.
          </p>
          {searchInput && (
            <Button
              variant="link"
              onClick={() => setSearchInput("")}
              className="mt-2 text-primary"
            >
              Bersihkan Pencarian
            </Button>
          )}
        </div>
      )}

      <div className="mt-10">
        <PaginationComponent
          basePath={`${pathname}?${createQueryString({ page: "" }).slice(
            0,
            -1
          )}`}
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>
    </Content>
  );
}
