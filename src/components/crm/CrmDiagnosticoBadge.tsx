import { Badge } from "@/components/ui/badge";
import { classificacao } from "@/lib/storage";
import type { CrmDiagnosticoResumo } from "@/hooks/useCrmOportunidades";

interface CrmDiagnosticoBadgeProps {
  diagnosticos: CrmDiagnosticoResumo[];
  onClick: () => void;
}

// Nunca escolhe entre múltiplos registros — >1 é inconsistência estrutural
// (não deveria ocorrer, protegida por índice único desde a Fase 4), mas a
// UI precisa tolerar dados históricos/edge cases sem esconder o problema.
export function CrmDiagnosticoBadge({ diagnosticos, onClick }: CrmDiagnosticoBadgeProps) {
  if (diagnosticos.length > 1) {
    return (
      <Badge
        variant="destructive"
        className="cursor-pointer text-[10px]"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        Inconsistência: múltiplos Diagnósticos
      </Badge>
    );
  }

  const d = diagnosticos[0];

  if (!d) {
    return (
      <Badge
        variant="secondary"
        className="cursor-pointer text-[10px]"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        Diagnóstico não iniciado
      </Badge>
    );
  }

  if (d.status === "concluida") {
    const cls = d.conformidade != null ? classificacao(d.conformidade) : null;
    return (
      <Badge
        variant="outline"
        className="cursor-pointer text-[10px]"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        Diagnóstico concluído — {d.conformidade != null ? `${d.conformidade.toFixed(0)}%` : "---"}
        {cls ? ` — ${cls.label}` : ""}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="cursor-pointer text-[10px]"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      Diagnóstico em andamento — {d.progresso}%
    </Badge>
  );
}
