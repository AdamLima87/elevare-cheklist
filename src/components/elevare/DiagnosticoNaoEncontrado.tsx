import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// Estado de erro compartilhado pelas rotas de execução do Diagnóstico do CRM
// (/crm/oportunidades/$id/diagnostico/*) — usado sempre que a inspeção não
// existe, não pertence à oportunidade da URL, ou não é um diagnóstico
// (tipo_execucao≠'diagnostico'). Nunca renderiza o shell nem tenta salvar
// nesses casos — evita abrir/manipular silenciosamente o diagnóstico de
// outra oportunidade via tamper de URL.
export function DiagnosticoNaoEncontrado({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground max-w-sm">
        Diagnóstico não encontrado, ou você não tem permissão para acessá-lo.
      </p>
      <Button variant="outline" size="sm" onClick={onVoltar}>Voltar à oportunidade</Button>
    </div>
  );
}
