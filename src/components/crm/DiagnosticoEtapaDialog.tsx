import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCrmDiagnostico, useObterOuCriarDiagnostico } from "@/hooks/useCrmOportunidades";
import { toast } from "sonner";

interface DiagnosticoEtapaDialogProps {
  oportunidadeId: string | null;
  onClose: () => void;
}

// Aberto DEPOIS que a mudança de etapa já foi persistida com sucesso (ver
// handleMoverEtapa em pipeline.tsx). Se a consulta ao diagnóstico falhar
// aqui, a mudança de etapa NUNCA é desfeita — só informamos e oferecemos
// abrir a oportunidade.
export function DiagnosticoEtapaDialog({ oportunidadeId, onClose }: DiagnosticoEtapaDialogProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useCrmDiagnostico(oportunidadeId ?? undefined);
  const obterOuCriar = useObterOuCriarDiagnostico();

  if (!oportunidadeId) return null;

  const abrirOportunidade = () => {
    navigate({ to: "/crm/oportunidades/$id", params: { id: oportunidadeId } });
    onClose();
  };

  const handleIniciar = async () => {
    try {
      await obterOuCriar.mutateAsync(oportunidadeId);
      navigate({ to: "/crm/oportunidades/$id", params: { id: oportunidadeId } });
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Erro ao iniciar o Diagnóstico.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && isError && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Não foi possível carregar o Diagnóstico
              </DialogTitle>
              <DialogDescription>
                A etapa foi alterada com sucesso, mas não conseguimos consultar o status do Diagnóstico agora.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={abrirOportunidade}>Abrir oportunidade</Button>
            </DialogFooter>
          </>
        )}

        {!isLoading && !isError && data?.inconsistente && (
          <>
            <DialogHeader>
              <DialogTitle>Inconsistência: múltiplos Diagnósticos</DialogTitle>
              <DialogDescription>
                Esta oportunidade tem mais de um registro de Diagnóstico Inicial. Abra a oportunidade para revisar.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={abrirOportunidade}>Abrir oportunidade</Button>
            </DialogFooter>
          </>
        )}

        {!isLoading && !isError && !data?.inconsistente && !data?.rows[0] && (
          <>
            <DialogHeader>
              <DialogTitle>A oportunidade entrou na etapa de Diagnóstico</DialogTitle>
              <DialogDescription>Deseja iniciar o Diagnóstico Inicial agora?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Agora não</Button>
              <Button onClick={handleIniciar} disabled={obterOuCriar.isPending}>
                {obterOuCriar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar Diagnóstico
              </Button>
            </DialogFooter>
          </>
        )}

        {!isLoading && !isError && !data?.inconsistente && data?.rows[0]?.status === "em_andamento" && (
          <>
            <DialogHeader>
              <DialogTitle>Diagnóstico em andamento</DialogTitle>
              <DialogDescription>Esta oportunidade já possui um Diagnóstico em andamento.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={abrirOportunidade}>Continuar Diagnóstico</Button>
            </DialogFooter>
          </>
        )}

        {!isLoading && !isError && !data?.inconsistente && data?.rows[0]?.status === "concluida" && (
          <>
            <DialogHeader>
              <DialogTitle>Diagnóstico já concluído</DialogTitle>
              <DialogDescription>O Diagnóstico Inicial desta oportunidade já foi concluído.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Continuar no pipeline</Button>
              <Button onClick={abrirOportunidade}>Ver resultado</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
