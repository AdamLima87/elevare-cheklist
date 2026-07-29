import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useChecklistModelosDisponiveis } from "@/hooks/useChecklistModelosDisponiveis";
import type { ResultadoRecomendacao } from "@/lib/checklist-modelo-recomendacao";

/**
 * Passo de seleção de legislação/modelo antes de abrir o checklist. Com uma
 * única opção disponível, seleciona automaticamente sem exigir clique
 * extra. Com 2+ opções, mostra a lista — e, a partir da Fase 9.D, pode
 * destacar uma recomendação (badge + motivo) e alertar sobre múltiplos
 * escopos regulatórios. A recomendação nunca escolhe por conta própria:
 * todos os botões continuam clicáveis em qualquer cenário.
 */
export function ChecklistModeloPicker({
  onSelecionar,
  recomendacao,
}: {
  onSelecionar: (modeloVersaoId: string) => void;
  /** Fase 9.D — resultado do motor de recomendação, já calculado pelo chamador. */
  recomendacao?: ResultadoRecomendacao;
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

  const sugestaoPorModeloId = new Map<string, string>();
  let usoAntecipadoModeloId: string | null = null;
  if (recomendacao?.tipo === "unica") {
    sugestaoPorModeloId.set(recomendacao.modeloRecomendadoId, recomendacao.motivo);
    if (recomendacao.usoAntecipado) usoAntecipadoModeloId = recomendacao.modeloRecomendadoId;
  } else if (recomendacao?.tipo === "multiplos_escopos") {
    for (const s of recomendacao.sugestoes) sugestaoPorModeloId.set(s.modeloId, s.motivo);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Selecione a legislação</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {recomendacao?.tipo === "multiplos_escopos" && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{recomendacao.alerta}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          {modelos.map((modelo) => {
            const motivo = sugestaoPorModeloId.get(modelo.modeloVersaoId);
            return (
              <Button
                key={modelo.modeloVersaoId}
                variant="outline"
                className="h-auto flex-col items-start gap-0.5 whitespace-normal py-3 text-left"
                onClick={() => onSelecionar(modelo.modeloVersaoId)}
              >
                <span className="flex items-center gap-2 font-medium">
                  {modelo.nome}
                  {motivo && <Badge variant="secondary">Recomendado</Badge>}
                  {usoAntecipadoModeloId === modelo.modeloVersaoId && (
                    <Badge variant="outline">Ainda não vigente — uso antecipado</Badge>
                  )}
                </span>
                {modelo.descricao && (
                  <span className="text-xs font-normal text-muted-foreground">{modelo.descricao}</span>
                )}
                {motivo && <span className="text-xs font-normal text-foreground/80">{motivo}</span>}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
