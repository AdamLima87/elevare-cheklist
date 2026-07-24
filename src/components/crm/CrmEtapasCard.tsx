import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
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
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useCrmPipelinePadrao, useCrmEtapas } from "@/hooks/useCrmCatalogos";
import {
  useUpsertCrmEtapa,
  useDeleteCrmEtapa,
  useDefinirEtapaDiagnostico,
  isDiagnosticoSomenteAbertaError,
  type CrmEtapa,
  type CrmEtapaTipo,
} from "@/hooks/useCrmCatalogos";

const TIPO_LABEL: Record<CrmEtapaTipo, string> = {
  aberta: "Aberta",
  ganho: "Ganho",
  perdido: "Perdido",
};

export function CrmEtapasCard() {
  const { data: profile } = useCurrentProfile();
  // Defesa em profundidade: a rota /configuracoes já é admin/super_admin
  // only, mas os controles de escrita deste card ficam desabilitados de
  // novo aqui — a RPC/RLS continuam sendo a autoridade real.
  const podeEditar = profile?.perfil === "admin" || profile?.perfil === "super_admin";

  const { data: pipeline, isLoading: loadingPipeline } = useCrmPipelinePadrao();
  const { data: etapas = [], isLoading: loadingEtapas } = useCrmEtapas(pipeline?.id);
  const upsertEtapa = useUpsertCrmEtapa();
  const deleteEtapa = useDeleteCrmEtapa();
  const definirDiagnostico = useDefinirEtapaDiagnostico();

  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<CrmEtapaTipo>("aberta");
  const [transferencia, setTransferencia] = useState<{ de: CrmEtapa; para: CrmEtapa } | null>(null);

  const isLoading = loadingPipeline || loadingEtapas;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id || !pipeline?.id || !novoNome.trim()) return;
    const proximaOrdem = etapas.reduce((max, et) => Math.max(max, et.ordem), 0) + 1;
    try {
      await upsertEtapa.mutateAsync({
        empresa_id: profile.empresa_id,
        pipeline_id: pipeline.id,
        nome: novoNome.trim(),
        tipo: novoTipo,
        ordem: proximaOrdem,
      });
      setNovoNome("");
      setNovoTipo("aberta");
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar etapa");
    }
  };

  const handleDelete = async (etapa: CrmEtapa) => {
    if (!pipeline?.id) return;
    try {
      await deleteEtapa.mutateAsync({ id: etapa.id, pipelineId: pipeline.id });
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover etapa");
    }
  };

  const handleTipoChange = async (etapa: CrmEtapa, novoTipoEtapa: CrmEtapaTipo) => {
    try {
      await upsertEtapa.mutateAsync({
        id: etapa.id,
        empresa_id: etapa.empresa_id,
        pipeline_id: etapa.pipeline_id,
        nome: etapa.nome,
        ordem: etapa.ordem,
        cor: etapa.cor,
        tipo: novoTipoEtapa,
      });
    } catch (error: any) {
      if (isDiagnosticoSomenteAbertaError(error)) {
        toast.error("Remova a marcação de Diagnóstico desta etapa antes de mudar o tipo.");
      } else {
        toast.error(error.message || "Erro ao atualizar etapa");
      }
    }
  };

  const handleToggleDiagnostico = (etapa: CrmEtapa) => {
    if (!pipeline?.id) return;

    if (etapa.gera_diagnostico) {
      definirDiagnostico.mutate(
        { pipelineId: pipeline.id, etapaId: null },
        { onError: (error: any) => toast.error(error.message || "Erro ao remover a marcação de Diagnóstico") },
      );
      return;
    }

    const outraMarcada = etapas.find((e) => e.gera_diagnostico && e.id !== etapa.id);
    if (outraMarcada) {
      setTransferencia({ de: outraMarcada, para: etapa });
      return;
    }

    definirDiagnostico.mutate(
      { pipelineId: pipeline.id, etapaId: etapa.id },
      { onError: (error: any) => toast.error(error.message || "Erro ao marcar a etapa de Diagnóstico") },
    );
  };

  const confirmarTransferencia = () => {
    if (!pipeline?.id || !transferencia) return;
    definirDiagnostico.mutate(
      { pipelineId: pipeline.id, etapaId: transferencia.para.id },
      { onError: (error: any) => toast.error(error.message || "Erro ao transferir a marcação de Diagnóstico") },
    );
    setTransferencia(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Etapas do Pipeline</CardTitle>
        <CardDescription>
          Marque qual etapa aberta representa o Diagnóstico Inicial — ao chegar nela, a oportunidade
          exibirá a ação para iniciar ou continuar o Diagnóstico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {etapas.map((etapa) => (
              <div
                key={etapa.id}
                className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{etapa.nome}</span>
                  <select
                    value={etapa.tipo}
                    disabled={!podeEditar}
                    onChange={(e) => handleTipoChange(etapa, e.target.value as CrmEtapaTipo)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {(Object.keys(TIPO_LABEL) as CrmEtapaTipo[]).map((t) => (
                      <option key={t} value={t}>
                        {TIPO_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  {etapa.gera_diagnostico && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Stethoscope className="h-3 w-3" /> Diagnóstico
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center gap-2"
                    title={
                      etapa.tipo !== "aberta"
                        ? "Apenas etapas abertas podem ser marcadas como etapa de Diagnóstico"
                        : undefined
                    }
                  >
                    <Label htmlFor={`diag-${etapa.id}`} className="text-xs font-normal text-muted-foreground">
                      Etapa de Diagnóstico
                    </Label>
                    <Switch
                      id={`diag-${etapa.id}`}
                      checked={etapa.gera_diagnostico}
                      disabled={!podeEditar || etapa.tipo !== "aberta" || definirDiagnostico.isPending}
                      onCheckedChange={() => handleToggleDiagnostico(etapa)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    disabled={!podeEditar}
                    onClick={() => handleDelete(etapa)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {etapas.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">Nenhuma etapa cadastrada.</p>
            )}
          </div>
        )}

        {podeEditar && (
          <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Nova etapa..." value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
            <select
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value as CrmEtapaTipo)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {(Object.keys(TIPO_LABEL) as CrmEtapaTipo[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
            <Button type="submit" size="icon" disabled={upsertEtapa.isPending || !novoNome.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        )}
      </CardContent>

      <AlertDialog open={!!transferencia} onOpenChange={(open) => !open && setTransferencia(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transferir a etapa de Diagnóstico?</AlertDialogTitle>
            <AlertDialogDescription>
              A etapa "{transferencia?.de.nome}" já está marcada como etapa de Diagnóstico. Transferir a
              marcação para "{transferencia?.para.nome}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarTransferencia}>Transferir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
