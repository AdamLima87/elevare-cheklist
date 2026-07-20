import { cn } from "@/lib/utils";

export function CrmLeadScoreBadge({ score, className }: { score: number; className?: string }) {
  const tier =
    score >= 50 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : score >= 25 ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-muted text-muted-foreground border-border";

  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", tier, className)}
      title="Score do lead (regra, não IA)"
    >
      Score {score}
    </span>
  );
}
