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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { CrmCatalogoItem } from "@/hooks/useCrmCatalogos";

// "Próxima ação obrigatória": aparece sempre que o backend recusa mover
// etapa ou concluir a última atividade pendente de uma oportunidade aberta
// sem uma próxima atividade agendada (regra de negócio, não decisão de UI —
// o backend é quem decide se isso é necessário, ver crm_mover_etapa_com_
// proxima_acao / crm_concluir_atividade).
export function NextActionRequiredDialog({
  open,
  onOpenChange,
  tiposAtividade,
  onConfirm,
  isPending,
  title = "Próxima ação obrigatória",
  description = "Esta oportunidade ficaria sem nenhuma atividade agendada. Agende a próxima ação para continuar.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiposAtividade: CrmCatalogoItem[];
  onConfirm: (tipoId: string, vencimentoIso: string) => void;
  isPending: boolean;
  title?: string;
  description?: string;
}) {
  const [tipoId, setTipoId] = useState("");
  const [vencimento, setVencimento] = useState("");

  const handleConfirm = () => {
    if (!tipoId || !vencimento) return;
    onConfirm(tipoId, new Date(vencimento).toISOString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="proxima-atividade-tipo">Tipo de atividade</Label>
            <Select value={tipoId} onValueChange={setTipoId}>
              <SelectTrigger id="proxima-atividade-tipo">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tiposAtividade.map((tipo) => (
                  <SelectItem key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="proxima-atividade-vencimento">Quando</Label>
            <Input
              id="proxima-atividade-vencimento"
              type="datetime-local"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={isPending || !tipoId || !vencimento} className="w-full">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Agendar e continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
