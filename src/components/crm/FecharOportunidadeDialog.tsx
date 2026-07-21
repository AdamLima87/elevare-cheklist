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
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { CrmCatalogoItem } from "@/hooks/useCrmCatalogos";

interface FecharOportunidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: "ganha" | "perdida";
  oportunidadeNome: string;
  motivosPerda: CrmCatalogoItem[];
  onConfirmarGanha: () => void;
  onConfirmarPerdida: (motivoId: string, detalhe: string | null) => void;
  isPending: boolean;
}

// Fechamento é irreversível na prática (a oportunidade some das colunas
// abertas do Kanban), então sempre pede confirmação explícita — nunca
// dispara direto de um onValueChange de Select.
export function FecharOportunidadeDialog({
  open,
  onOpenChange,
  modo,
  oportunidadeNome,
  motivosPerda,
  onConfirmarGanha,
  onConfirmarPerdida,
  isPending,
}: FecharOportunidadeDialogProps) {
  const [motivoId, setMotivoId] = useState("");
  const [detalhe, setDetalhe] = useState("");

  const motivoEhOutro = motivosPerda.find((m) => m.id === motivoId)?.nome?.toLowerCase() === "outro";

  const handleConfirmar = () => {
    if (modo === "ganha") {
      onConfirmarGanha();
    } else {
      if (!motivoId) return;
      onConfirmarPerdida(motivoId, detalhe.trim() || null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modo === "ganha" ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            {modo === "ganha" ? "Marcar como ganha" : "Marcar como perdida"}
          </DialogTitle>
          <DialogDescription>
            {modo === "ganha"
              ? `"${oportunidadeNome}" será fechada e a Conta vinculada (ou criada) como cliente operacional.`
              : `Informe o motivo da perda de "${oportunidadeNome}".`}
          </DialogDescription>
        </DialogHeader>

        {modo === "perdida" && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="motivo-perda">Motivo</Label>
              <Select value={motivoId} onValueChange={setMotivoId}>
                <SelectTrigger id="motivo-perda">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivosPerda.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {motivoEhOutro && (
              <div className="grid gap-2">
                <Label htmlFor="motivo-detalhe">Detalhe</Label>
                <Input
                  id="motivo-detalhe"
                  value={detalhe}
                  onChange={(e) => setDetalhe(e.target.value)}
                  placeholder="Explique o motivo"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={handleConfirmar}
            disabled={isPending || (modo === "perdida" && !motivoId)}
            variant={modo === "ganha" ? "default" : "destructive"}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : modo === "ganha" ? (
              "Confirmar ganho"
            ) : (
              "Confirmar perda"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
