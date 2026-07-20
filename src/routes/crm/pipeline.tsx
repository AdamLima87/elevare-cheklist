import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useCrmEmpresas } from "@/hooks/useCrmEmpresas";
import { useCrmPipelinePadrao, useCrmEtapas, useCrmTiposAtividade } from "@/hooks/useCrmCatalogos";
import {
  useCrmOportunidades,
  useUpsertCrmOportunidade,
  useMoverEtapaOportunidade,
  isProximaAcaoObrigatoriaError,
  type CrmOportunidade,
} from "@/hooks/useCrmOportunidades";
import { NextActionRequiredDialog } from "@/components/crm/NextActionRequiredDialog";
import { CrmSaudeBadge } from "@/components/crm/CrmSaudeBadge";

export const Route = createFileRoute("/crm/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline · CRM Comercial · RDCheck" },
      { name: "description", content: "Funil de oportunidades comerciais." },
    ],
  }),
  component: CrmPipelinePage,
});

function formatMoeda(valor: number | null) {
  if (valor == null) return null;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CrmPipelinePage() {
  const navigate = useNavigate();
  const { data: profile } = useCurrentProfile();
  const { data: pipeline, isLoading: loadingPipeline } = useCrmPipelinePadrao();
  const { data: etapas = [], isLoading: loadingEtapas } = useCrmEtapas(pipeline?.id);
  const { data: oportunidades = [], isLoading: loadingOportunidades } = useCrmOportunidades(pipeline?.id);
  const { data: contas = [] } = useCrmEmpresas();
  const { data: tiposAtividade = [] } = useCrmTiposAtividade();
  const upsertOportunidade = useUpsertCrmOportunidade();
  const moverEtapa = useMoverEtapaOportunidade();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ crm_empresa_id: "", nome: "", valor_estimado: "" });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverEtapa, setDragOverEtapa] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [proximaAcaoPendente, setProximaAcaoPendente] = useState<{
    oportunidade: CrmOportunidade;
    etapaId: string;
  } | null>(null);

  const etapasAbertas = etapas.filter((e) => e.tipo === "aberta");
  const primeiraEtapa = etapas.find((e) => e.tipo === "aberta");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id || !pipeline || !primeiraEtapa) {
      toast.error("Pipeline ainda não está pronto.");
      return;
    }
    try {
      await upsertOportunidade.mutateAsync({
        empresa_id: profile.empresa_id,
        crm_empresa_id: form.crm_empresa_id,
        pipeline_id: pipeline.id,
        etapa_id: primeiraEtapa.id,
        nome: form.nome,
        valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
        responsavel_id: profile.userId,
      });
      toast.success("Oportunidade criada!");
      setOpen(false);
      setForm({ crm_empresa_id: "", nome: "", valor_estimado: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar oportunidade");
    }
  };

  const handleMoverEtapa = async (oportunidade: CrmOportunidade, etapaId: string) => {
    if (!pipeline) return;
    try {
      await moverEtapa.mutateAsync({ id: oportunidade.id, etapa_id: etapaId, pipeline_id: pipeline.id });
    } catch (error: any) {
      if (isProximaAcaoObrigatoriaError(error)) {
        setProximaAcaoPendente({ oportunidade, etapaId });
        return;
      }
      toast.error(error.message || "Erro ao mover etapa");
    }
  };

  const handleConfirmarProximaAcao = async (tipoId: string, vencimentoIso: string) => {
    if (!proximaAcaoPendente || !pipeline) return;
    try {
      await moverEtapa.mutateAsync({
        id: proximaAcaoPendente.oportunidade.id,
        etapa_id: proximaAcaoPendente.etapaId,
        pipeline_id: pipeline.id,
        nova_atividade_tipo_id: tipoId,
        nova_atividade_vencimento: vencimentoIso,
      });
      toast.success("Etapa movida e próxima atividade agendada!");
      setProximaAcaoPendente(null);
    } catch (error: any) {
      toast.error(error.message || "Erro ao mover etapa");
    }
  };

  const handleDragStart = (e: React.DragEvent, oportunidade: CrmOportunidade) => {
    e.dataTransfer.setData("text/plain", oportunidade.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(oportunidade.id);
  };
  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverEtapa(null);
  };
  const handleDragOverColuna = (e: React.DragEvent, etapaId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverEtapa !== etapaId) setDragOverEtapa(etapaId);
  };
  const handleDropColuna = (e: React.DragEvent, etapaId: string) => {
    e.preventDefault();
    const oportunidadeId = e.dataTransfer.getData("text/plain");
    const oportunidade = oportunidades.find((o) => o.id === oportunidadeId);
    setDraggingId(null);
    setDragOverEtapa(null);
    if (!oportunidade || oportunidade.etapa_id === etapaId) return;
    handleMoverEtapa(oportunidade, etapaId);
  };

  const oportunidadesFiltradas = search.trim()
    ? oportunidades.filter((o) => o.nome.toLowerCase().includes(search.trim().toLowerCase()))
    : oportunidades;

  const isLoading = loadingPipeline || loadingEtapas || loadingOportunidades;

  const colunas = etapasAbertas.map((etapa) => ({
    ...etapa,
    oportunidades: oportunidadesFiltradas.filter((o) => o.etapa_id === etapa.id),
  }));

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe oportunidades comerciais do lead até o fechamento.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!primeiraEtapa}>
                <Plus className="h-4 w-4" /> Nova Oportunidade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Nova Oportunidade</DialogTitle>
                  <DialogDescription>Cria uma oportunidade na primeira etapa do pipeline.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="conta">Conta</Label>
                    <Select
                      value={form.crm_empresa_id}
                      onValueChange={(v) => setForm({ ...form, crm_empresa_id: v })}
                    >
                      <SelectTrigger id="conta">
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {contas.map((conta) => (
                          <SelectItem key={conta.id} value={conta.id}>
                            {conta.nome_fantasia || conta.razao_social}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nome">Nome da oportunidade</Label>
                    <Input
                      id="nome"
                      placeholder="Ex: Diagnóstico + acompanhamento mensal"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="valor">Valor estimado (R$)</Label>
                    <Input
                      id="valor"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.valor_estimado}
                      onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={upsertOportunidade.isPending || !form.crm_empresa_id}
                    className="w-full"
                  >
                    {upsertOportunidade.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Criar Oportunidade"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative mb-4 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar oportunidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {colunas.map((coluna) => (
              <div
                key={coluna.id}
                className="flex w-[260px] shrink-0 flex-col rounded-xl bg-muted/40 p-2"
                onDragOver={(e) => handleDragOverColuna(e, coluna.id)}
                onDragLeave={() => setDragOverEtapa((prev) => (prev === coluna.id ? null : prev))}
                onDrop={(e) => handleDropColuna(e, coluna.id)}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-1 pt-1">
                  <span className="truncate text-sm font-semibold text-foreground">{coluna.nome}</span>
                  <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-sm">
                    {coluna.oportunidades.length}
                  </span>
                </div>
                <div
                  className={cn(
                    "flex-1 space-y-2 rounded-lg p-1 transition-colors",
                    dragOverEtapa === coluna.id && "bg-primary/10 ring-2 ring-primary/30",
                  )}
                >
                  {coluna.oportunidades.map((oportunidade) => (
                    <Card
                      key={oportunidade.id}
                      className={cn(
                        "w-full cursor-grab shadow-sm active:cursor-grabbing",
                        draggingId === oportunidade.id && "opacity-40",
                      )}
                      draggable
                      onDragStart={(e) => handleDragStart(e, oportunidade)}
                      onDragEnd={handleDragEnd}
                    >
                      <CardHeader className="space-y-1.5 p-3 pb-2">
                        <CardTitle
                          className="cursor-pointer text-sm leading-snug hover:underline"
                          onClick={() =>
                            navigate({ to: "/crm/empresas/$id", params: { id: oportunidade.crm_empresa_id } })
                          }
                        >
                          {oportunidade.nome}
                        </CardTitle>
                        <CrmSaudeBadge saude={oportunidade.saude} />
                      </CardHeader>
                      <CardContent className="space-y-1.5 p-3 pt-0 text-xs text-muted-foreground">
                        <div className="truncate">
                          {oportunidade.crm_empresas?.nome_fantasia || oportunidade.crm_empresas?.razao_social}
                        </div>
                        {oportunidade.valor_estimado != null && (
                          <div className="font-medium text-foreground">
                            {formatMoeda(oportunidade.valor_estimado)}
                          </div>
                        )}
                        <Select
                          value={oportunidade.etapa_id}
                          onValueChange={(v) => handleMoverEtapa(oportunidade, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {etapas.map((etapa) => (
                              <SelectItem key={etapa.id} value={etapa.id}>
                                {etapa.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  ))}
                  {coluna.oportunidades.length === 0 && (
                    <div className="flex min-h-[100px] items-center justify-center rounded-lg border border-dashed border-border px-3 text-center text-xs leading-relaxed text-muted-foreground">
                      Arraste para cá para mover oportunidades pra essa etapa
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <NextActionRequiredDialog
          open={!!proximaAcaoPendente}
          onOpenChange={(v) => !v && setProximaAcaoPendente(null)}
          tiposAtividade={tiposAtividade}
          onConfirm={handleConfirmarProximaAcao}
          isPending={moverEtapa.isPending}
        />
      </AppShell>
    </ProtectedRoute>
  );
}
