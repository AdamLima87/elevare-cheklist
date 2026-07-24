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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { CrmCatalogoItem } from "@/hooks/useCrmCatalogos";

interface FecharOportunidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: "ganha" | "perdida";
  oportunidadeNome: string;
  motivosPerda: CrmCatalogoItem[];
  /** Fase 5: true depois que a 1ª tentativa de fechar ganho retornou
   * DIAGNOSTICO_NAO_CONCLUIDO — mostra o campo de motivo obrigatório. */
  precisaMotivoDiagnostico?: boolean;
  onConfirmarGanha: (motivoSemDiagnostico?: string) => void;
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
  precisaMotivoDiagnostico,
  onConfirmarGanha,
  onConfirmarPerdida,
  isPending,
}: FecharOportunidadeDialogProps) {
  const [motivoId, setMotivoId] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [motivoSemDiagnostico, setMotivoSemDiagnostico] = useState("");

  const motivoEhOutro = motivosPerda.find((m) => m.id === motivoId)?.nome?.toLowerCase() === "outro";
  // Validação client-side é só UX (feedback rápido) — a validação real e
  // definitiva é a da própria RPC (trim/mínimo/máximo no backend).
  const motivoDiagnosticoValido = motivoSemDiagnostico.trim().length >= 5 && motivoSemDiagnostico.trim().length <= 500;

  const handleConfirmar = () => {
    if (modo === "ganha") {
      if (precisaMotivoDiagnostico) {
        if (!motivoDiagnosticoValido) return;
        onConfirmarGanha(motivoSemDiagnostico.trim());
      } else {
        onConfirmarGanha();
      }
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

        {modo === "ganha" && precisaMotivoDiagnostico && (
          <div className="grid gap-3 py-2">
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>
                O Diagnóstico Inicial desta oportunidade ainda não foi concluído. Confirme mesmo assim informando
                um motivo — isso fica registrado na timeline da oportunidade.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="motivo-sem-diagnostico">Motivo para fechar sem o Diagnóstico concluído</Label>
              <Textarea
                id="motivo-sem-diagnostico"
                value={motivoSemDiagnostico}
                onChange={(e) => setMotivoSemDiagnostico(e.target.value)}
                placeholder="Ex: cliente pediu urgência, diagnóstico será feito após o fechamento."
                maxLength={500}
                className="min-h-20"
              />
            </div>
          </div>
        )}

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
            disabled={
              isPending ||
              (modo === "perdida" && !motivoId) ||
              (modo === "ganha" && precisaMotivoDiagnostico && !motivoDiagnosticoValido)
            }
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
