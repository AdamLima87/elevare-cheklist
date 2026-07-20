import { cn } from "@/lib/utils";
import type { CrmSaude } from "@/hooks/useCrmOportunidades";

const SAUDE_CONFIG: Record<CrmSaude, { emoji: string; label: string; className: string }> = {
  verde: { emoji: "🟢", label: "Em dia", className: "bg-green-50 text-green-700 border-green-200" },
  amarelo: { emoji: "🟡", label: "Atenção", className: "bg-amber-50 text-amber-700 border-amber-200" },
  vermelho: { emoji: "🔴", label: "Parada", className: "bg-red-50 text-red-700 border-red-200" },
  fechada: { emoji: "⚪", label: "Fechada", className: "bg-muted text-muted-foreground border-border" },
};

export function CrmSaudeBadge({ saude, className }: { saude: CrmSaude; className?: string }) {
  const config = SAUDE_CONFIG[saude];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
      title={config.label}
    >
      <span aria-hidden="true">{config.emoji}</span>
      {config.label}
    </span>
  );
}
