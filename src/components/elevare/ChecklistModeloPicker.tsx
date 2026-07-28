import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChecklistModelosDisponiveis } from "@/hooks/useChecklistModelosDisponiveis";

/**
 * Passo de seleção de legislação/modelo antes de abrir o checklist. Com uma
 * única opção disponível (hoje, só RDC 275), seleciona automaticamente sem
 * exigir clique extra — a UI já é 100% dirigida pelos dados de
 * useChecklistModelosDisponiveis, então Fases 8/9 não precisam de nenhuma
 * mudança aqui pra mostrar mais opções.
 */
export function ChecklistModeloPicker({
  onSelecionar,
}: {
  onSelecionar: (modeloVersaoId: string) => void;
}) {
  const { data: modelos, isLoading, error } = useChecklistModelosDisponiveis();

  useEffect(() => {
    if (modelos && modelos.length === 1) {
      onSelecionar(modelos[0].modeloVersaoId);
    }
  }, [modelos, onSelecionar]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !modelos || modelos.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhum modelo de checklist disponível. Contate o suporte.
      </p>
    );
  }

  if (modelos.length === 1) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Selecione a legislação</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {modelos.map((modelo) => (
          <Button
            key={modelo.modeloVersaoId}
            variant="outline"
            className="h-auto flex-col items-start gap-0.5 whitespace-normal py-3 text-left"
            onClick={() => onSelecionar(modelo.modeloVersaoId)}
          >
            <span className="font-medium">{modelo.nome}</span>
            {modelo.descricao && (
              <span className="text-xs font-normal text-muted-foreground">{modelo.descricao}</span>
            )}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
