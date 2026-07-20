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
import { createClient } from "@/lib/supabase/client";
import { Loader2, Search, Star } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as indonesiaLocale } from "date-fns/locale";

// Definisikan tipe data untuk riwayat
interface RiwayatPermintaan {
  id: string;
  judul: string;
  due_date: string;
  rating_numeric: number | null;
  review: string | null;
}

const ITEMS_PER_PAGE = 9; // Cocok untuk layout grid 3x3

export function RiwayatClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [riwayatList, setRiwayatList] = useState<RiwayatPermintaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState<number>(0);

  // State untuk filter dan pencarian dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";

  // State untuk input, agar bisa menggunakan debounce
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

      let query = s
        .from("permintaan")
        .select(`id, judul, due_date, rating_numeric, review`, {
          count: "exact",
        })
        .eq("requester", user.id)
        .eq("status", "DONE");

      if (searchTerm) {
        query = query.ilike("judul", `%${searchTerm}%`);
      }

      query = query.range(from, to).order("due_date", { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data riwayat: " + error.message);
        setRiwayatList([]);
      } else {
        setRiwayatList(data || []);
        setTotalItems(count || 0);
      }
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

  return (
    <Content title="Riwayat Pengajuan Desain" size="lg">
      <div className="flex justify-center mb-6">
        <div className="relative w-full md:w-2/3 lg:w-1/2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Cari riwayat berdasarkan judul..."
            className="pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64 gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-muted-foreground">Memuat riwayat...</p>
        </div>
      ) : riwayatList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {riwayatList.map((item) => (
            <Card key={item.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="line-clamp-2">{item.judul}</CardTitle>
                <CardDescription>
                  Selesai pada:{" "}
                  {format(new Date(item.due_date), "dd MMMM yyyy", {
                    locale: indonesiaLocale,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex items-center gap-2 mb-4">
                  {item.rating_numeric !== null ? (
                    <>
                      <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                      <span className="text-xl font-bold">
                        {item.rating_numeric}
                      </span>
                      <span className="text-muted-foreground">/ 5</span>
                    </>
                  ) : (
                    <>
                      <Star className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Belum dinilai
                      </span>
                    </>
                  )}
                </div>
                <blockquote className="border-l-2 pl-4 italic text-sm text-muted-foreground line-clamp-4">
                  {item.review || "Tidak ada review yang diberikan."}
                </blockquote>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a href={`/permintaan-desain/${item.id}`}>Lihat Detail</a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center h-64 flex flex-col justify-center items-center">
          <h3 className="text-xl font-semibold">Tidak Ada Riwayat</h3>
          <p className="text-muted-foreground mt-2">
            Anda belum memiliki riwayat permintaan yang selesai.
          </p>
        </div>
      )}

      <div className="mt-8">
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
