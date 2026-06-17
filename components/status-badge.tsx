import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Warna status konsisten lintas seluruh halaman (requester / admin / designer).
// Satu sumber kebenaran — jangan duplikasi getStatusVariant di tiap halaman.
const STATUS_STYLES: Record<string, string> = {
  "TO DO": "border-transparent bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  PROGRESS: "border-transparent bg-blue-600 text-white hover:bg-blue-700",
  REVIEW: "border-transparent bg-amber-500 text-white hover:bg-amber-600",
  REVISION: "border-transparent bg-orange-500 text-white hover:bg-orange-600",
  DONE: "border-transparent bg-green-600 text-white hover:bg-green-700",
};

export const STATUS_VALUES = [
  "TO DO",
  "PROGRESS",
  "REVIEW",
  "REVISION",
  "DONE",
] as const;

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const label = status || "-";
  const style = (status && STATUS_STYLES[status]) || "";
  return <Badge className={cn(style, className)}>{label}</Badge>;
}
