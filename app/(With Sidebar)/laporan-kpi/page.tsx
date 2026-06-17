// Laporan KPI Desainer (admin) — konsumsi RPC get_designer_kpi_report.
"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BarChart3, Loader2, FileSpreadsheet, Printer } from "lucide-react";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { ROLES } from "@/lib/auth/roles";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface KpiRow {
  designer_id: string;
  designer_name: string;
  jumlah_selesai: number;
  avg_ketepatan: number | null;
  avg_kualitas: number | null;
  avg_kpi: number | null;
  tiket_perlu_perhatian: { id: number; judul: string; skor_kpi_akhir: number }[];
}

interface DesignerOpt {
  id: string;
  name: string | null;
}

const fmt = (v: number | null) => (v === null ? "—" : Number(v).toFixed(1));

export default function LaporanKpiPage() {
  useRoleGuard([ROLES.ADMIN]);
  const s = createClient();

  const [rows, setRows] = useState<KpiRow[]>([]);
  const [designers, setDesigners] = useState<DesignerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [designerId, setDesignerId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Daftar desainer untuk dropdown filter.
  useEffect(() => {
    async function loadDesigners() {
      const { data } = await s
        .from("user_profiles")
        .select("id, name")
        .eq("role", "designer");
      setDesigners((data as DesignerOpt[]) || []);
    }
    loadDesigners();
  }, [s]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const { data, error } = await s.rpc("get_designer_kpi_report", {
      p_designer: designerId === "all" ? null : designerId,
      p_start: startDate || null,
      p_end: endDate || null,
    });
    if (error) {
      toast.error("Gagal memuat laporan: " + error.message);
      setRows([]);
    } else {
      setRows((data as KpiRow[]) || []);
    }
    setLoading(false);
  }, [s, designerId, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const periodeLabel =
    startDate || endDate
      ? `${startDate || "awal"} s/d ${endDate || "sekarang"}`
      : "Semua periode";
  const tanggalCetak = new Date().toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const handleExportExcel = () => {
    if (rows.length === 0) {
      toast.warning("Tidak ada data untuk diekspor.");
      return;
    }
    // Sheet 1: ringkasan per desainer
    const ringkasan = rows.map((r, i) => ({
      No: i + 1,
      Desainer: r.designer_name,
      "Tugas Selesai": r.jumlah_selesai,
      "Skor Ketepatan Waktu": r.avg_ketepatan ?? "-",
      "Skor Kualitas": r.avg_kualitas ?? "-",
      "Skor KPI Akhir": r.avg_kpi ?? "-",
      "Tiket < 60": r.tiket_perlu_perhatian.length,
    }));
    // Sheet 2: daftar tiket perlu perhatian (flatten)
    const perhatian = rows.flatMap((r) =>
      r.tiket_perlu_perhatian.map((t) => ({
        Desainer: r.designer_name,
        "ID Tiket": t.id,
        Judul: t.judul,
        "Skor KPI": t.skor_kpi_akhir,
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(ringkasan),
      "Ringkasan KPI"
    );
    if (perhatian.length > 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(perhatian),
        "Tiket Perlu Perhatian"
      );
    }
    XLSX.writeFile(
      wb,
      `Laporan_KPI_${new Date().toISOString().split("T")[0]}.xlsx`
    );
    toast.success("Excel berhasil diunduh.");
  };

  const handleExportPdf = () => {
    if (rows.length === 0) {
      toast.warning("Tidak ada data untuk dicetak.");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Laporan KPI Desainer — DesignDesk", 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Periode: ${periodeLabel}`, 14, 22);
    doc.text(`Dicetak: ${tanggalCetak}`, 14, 27);

    autoTable(doc, {
      startY: 32,
      head: [
        [
          "No",
          "Desainer",
          "Tugas Selesai",
          "Ketepatan",
          "Kualitas",
          "KPI Akhir",
          "Tiket <60",
        ],
      ],
      body: rows.map((r, i) => [
        i + 1,
        r.designer_name,
        r.jumlah_selesai,
        fmt(r.avg_ketepatan),
        fmt(r.avg_kualitas),
        fmt(r.avg_kpi),
        r.tiket_perlu_perhatian.length,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`Laporan_KPI_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF berhasil dibuat.");
  };

  return (
    <Content
      title="Laporan KPI Desainer"
      description="Performa desainer berdasarkan ketepatan waktu & kualitas (rating)."
      size="lg"
      cardAction={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={loading || rows.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={loading || rows.length === 0}
          >
            <Printer className="h-4 w-4 mr-2" /> Cetak PDF
          </Button>
        </div>
      }
    >
      {/* FILTER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-muted/30">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Desainer</label>
          <Select value={designerId} onValueChange={setDesignerId}>
            <SelectTrigger>
              <SelectValue placeholder="Semua desainer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Desainer</SelectItem>
              {designers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name || d.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Periode Dari</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Sampai</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={fetchReport} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Terapkan"}
          </Button>
        </div>
      </div>

      {/* TABEL */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Desainer</TableHead>
              <TableHead className="text-center">Tugas Selesai</TableHead>
              <TableHead className="text-center">Ketepatan Waktu</TableHead>
              <TableHead className="text-center">Kualitas</TableHead>
              <TableHead className="text-center">KPI Akhir</TableHead>
              <TableHead className="text-center">Perlu Perhatian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : rows.length > 0 ? (
              rows.map((r, i) => (
                <TableRow key={r.designer_id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-semibold">
                    {r.designer_name}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.jumlah_selesai}
                  </TableCell>
                  <TableCell className="text-center">
                    {fmt(r.avg_ketepatan)}
                  </TableCell>
                  <TableCell className="text-center">
                    {fmt(r.avg_kualitas)}
                  </TableCell>
                  <TableCell className="text-center font-bold">
                    {fmt(r.avg_kpi)}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.tiket_perlu_perhatian.length > 0 ? (
                      <Badge variant="destructive">
                        {r.tiket_perlu_perhatian.length} tiket &lt; 60
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <BarChart3 className="h-8 w-8 opacity-50" />
                    <p className="text-sm">
                      Belum ada data KPI untuk filter ini.
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
