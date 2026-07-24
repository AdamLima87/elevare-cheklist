import { AlertTriangle } from "lucide-react";

// Estado de erro reaproveitado onde quer que useChecklistModelo/
// carregarChecklistModelo falhe em resolver o modelo (não deveria acontecer,
// dado o FK em inspecoes.checklist_modelo_versao_id, mas cobre corrupção/
// edge case) — mesmo padrão de DiagnosticoNaoEncontrado.tsx.
export function ChecklistModeloNaoEncontrado() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground max-w-sm">
        Modelo de checklist não encontrado. Contate o suporte.
      </p>
    </div>
  );
}
