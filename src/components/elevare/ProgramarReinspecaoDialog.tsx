import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { dueDate } from "@/lib/reinspection";
import { useCriarProgramacaoReinspecao } from "@/hooks/useReinspecaoProgramacoes";
import { toast } from "sonner";

interface ProgramarReinspecaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspecaoOrigemId: string;
  /** ISO da data de conclusão da inspeção de origem — usada só para sugerir a data padrão (+6 meses), editável. */
  dataConclusaoOrigem: string | null;
}

export function ProgramarReinspecaoDialog({
  open,
  onOpenChange,
  inspecaoOrigemId,
  dataConclusaoOrigem,
}: ProgramarReinspecaoDialogProps) {
  const sugestao = dataConclusaoOrigem ? format(dueDate(dataConclusaoOrigem), "yyyy-MM-dd") : "";
  const [dataPrevista, setDataPrevista] = useState(sugestao);
  const [observacao, setObservacao] = useState("");
  const criar = useCriarProgramacaoReinspecao();

  const handleConfirmar = () => {
    if (!dataPrevista) return;
    criar.mutate(
      { inspecaoOrigemId, dataPrevista, observacao: observacao.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Reinspeção programada.");
          onOpenChange(false);
          setObservacao("");
        },
        onError: (err) => {
          console.error(err);
          toast.error("Não foi possível programar a reinspeção.");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Programar reinspeção
          </DialogTitle>
          <DialogDescription>
            Sugestão de 6 meses após a conclusão — ajuste livremente. Nenhuma inspeção é criada agora, só o
            agendamento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Data prevista</Label>
            <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Observação (opcional)</Label>
            <Textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!dataPrevista || criar.isPending} className="gap-2">
            {criar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar programação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
