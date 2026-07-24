import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CrmDiagnosticoResumo } from "@/hooks/useCrmOportunidades";

export interface DiagnosticoSaidaPendente {
  etapaOrigemNome: string;
  etapaAlvoNome: string;
  diagnosticos: CrmDiagnosticoResumo[];
  resolve: (avancar: boolean) => void;
}

interface DiagnosticoSaidaEtapaDialogProps {
  pendente: DiagnosticoSaidaPendente | null;
}

// Checado ANTES de chamar a mutation de mover etapa (ver handleMoverEtapa
// em pipeline.tsx) — se o usuário cancelar, nada é persistido. Não bloqueia
// definitivamente: é aviso + confirmação consciente, conforme decisão
// explícita desta fase (obrigatoriedade comercial ainda não foi definida).
export function DiagnosticoSaidaEtapaDialog({ pendente }: DiagnosticoSaidaEtapaDialogProps) {
  if (!pendente) return null;

  const temDiagnosticoEmAndamento = pendente.diagnosticos.length > 0;

  const handleResolve = (avancar: boolean) => {
    pendente.resolve(avancar);
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && handleResolve(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {temDiagnosticoEmAndamento
              ? "O Diagnóstico ainda não foi concluído"
              : "Esta oportunidade ainda não possui Diagnóstico Inicial"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Deseja mover mesmo assim de "{pendente.etapaOrigemNome}" para "{pendente.etapaAlvoNome}"?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleResolve(false)}>
            {temDiagnosticoEmAndamento ? "Continuar Diagnóstico" : "Voltar e iniciar Diagnóstico"}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => handleResolve(true)}>
            {temDiagnosticoEmAndamento ? "Avançar mesmo assim" : "Avançar sem Diagnóstico"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
