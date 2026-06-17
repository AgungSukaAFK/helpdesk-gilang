// Tampilan read-only skor KPI sebuah tiket (dipakai di detail designer & admin).
import { Label } from "@/components/ui/label";

function fmt(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(0);
}

export function KpiScores({
  ketepatan,
  kualitas,
  akhir,
}: {
  ketepatan?: number | null;
  kualitas?: number | null;
  akhir?: number | null;
}) {
  // Sembunyikan bila belum ada skor sama sekali.
  if (
    (ketepatan === null || ketepatan === undefined) &&
    (kualitas === null || kualitas === undefined) &&
    (akhir === null || akhir === undefined)
  ) {
    return null;
  }

  const items = [
    { label: "Ketepatan Waktu", value: ketepatan },
    { label: "Kualitas (Rating)", value: kualitas },
    { label: "KPI Akhir", value: akhir, highlight: true },
  ];

  return (
    <div className="border rounded-lg p-5 bg-card shadow-sm space-y-3">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Skor KPI Tiket
      </Label>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div
            key={it.label}
            className={`rounded-md border p-3 text-center ${
              it.highlight ? "bg-primary/5 border-primary/30" : "bg-muted/30"
            }`}
          >
            <p className="text-[10px] text-muted-foreground leading-tight">
              {it.label}
            </p>
            <p className="text-xl font-bold">{fmt(it.value)}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        KPI = 0.35·Ketepatan + 0.65·Kualitas. Terisi setelah selesai &amp; dinilai.
      </p>
    </div>
  );
}
