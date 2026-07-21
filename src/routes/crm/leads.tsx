import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search as SearchIcon, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useCrmPipelinePadrao, useCrmEtapas } from "@/hooks/useCrmCatalogos";
import {
  useLeadFinderSearch,
  useLeadFinderUsage,
  useLeadFinderImport,
  type LeadFinderResultado,
} from "@/hooks/useLeadFinder";

export const Route = createFileRoute("/crm/leads")({
  head: () => ({
    meta: [
      { title: "Buscar Leads · CRM Comercial · RDCheck" },
      { name: "description", content: "Encontre estabelecimentos por categoria e cidade e importe como Conta no CRM." },
    ],
  }),
  component: CrmLeadsPage,
});

interface ImportForm {
  razaoSocial: string;
  cidade: string;
  estado: string;
}

function CrmLeadsPage() {
  const { data: profile } = useCurrentProfile();
  const { data: pipeline } = useCrmPipelinePadrao();
  const { data: etapas = [] } = useCrmEtapas(pipeline?.id);
  const etapaInicial = useMemo(() => etapas.find((e) => e.tipo === "aberta"), [etapas]);

  const { data: usage, isLoading: usageLoading } = useLeadFinderUsage();
  const search = useLeadFinderSearch();
  const importLead = useLeadFinderImport();

  const [textQuery, setTextQuery] = useState("");
  const [resultados, setResultados] = useState<LeadFinderResultado[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForms, setBatchForms] = useState<Record<string, ImportForm>>({});
  const [batchStatus, setBatchStatus] = useState<Record<string, "pendente" | "ok" | "erro" | "importando">>({});

  const limite = usage?.limite;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textQuery.trim()) return;
    try {
      const result = await search.mutateAsync({ textQuery: textQuery.trim() });
      setResultados(result.resultados);
      setSelecionados(new Set());
    } catch (error: any) {
      toast.error(error.message || "Erro ao buscar.");
    }
  };

  const elegiveis = resultados.filter((r) => !r.jaExisteNoCrm);

  const toggleSelecionado = (placeId: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  };

  const toggleTodos = () => {
    if (selecionados.size === elegiveis.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(elegiveis.map((r) => r.placeId)));
    }
  };

  const abrirImportacaoLote = () => {
    const forms: Record<string, ImportForm> = {};
    const status: Record<string, "pendente"> = {};
    for (const placeId of selecionados) {
      const item = resultados.find((r) => r.placeId === placeId);
      if (!item) continue;
      forms[placeId] = { razaoSocial: item.nome, cidade: item.cidade ?? "", estado: item.estado ?? "" };
      status[placeId] = "pendente";
    }
    setBatchForms(forms);
    setBatchStatus(status);
    setBatchOpen(true);
  };

  const confirmarImportacaoLote = async () => {
    if (!pipeline?.id || !etapaInicial?.id || !profile?.userId) {
      toast.error("Pipeline padrão do CRM não encontrado.");
      return;
    }

    for (const placeId of Object.keys(batchForms)) {
      const form = batchForms[placeId];
      if (!form.razaoSocial.trim()) continue;
      setBatchStatus((prev) => ({ ...prev, [placeId]: "importando" }));
      try {
        await importLead.mutateAsync({
          placeId,
          razaoSocial: form.razaoSocial.trim(),
          cidade: form.cidade.trim() || null,
          estado: form.estado.trim() || null,
          pipelineId: pipeline.id,
          etapaId: etapaInicial.id,
          responsavelId: profile.userId,
        });
        setBatchStatus((prev) => ({ ...prev, [placeId]: "ok" }));
      } catch (error: any) {
        setBatchStatus((prev) => ({ ...prev, [placeId]: "erro" }));
        toast.error(`${form.razaoSocial}: ${error.message || "erro ao importar"}`);
      }
    }
    toast.success("Importação concluída. Confira o resultado por item.");
  };

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Buscar Leads</h1>
          <p className="text-sm text-muted-foreground">
            Encontre estabelecimentos por categoria e cidade (ex: "restaurantes em Campinas") e importe como Conta no CRM.
          </p>
        </div>

        <Card className="mb-4">
          <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <form onSubmit={handleSearch} className="flex flex-1 gap-2">
              <Input
                placeholder='Ex: "padarias em Moema", "hotéis em Belém"...'
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
              />
              <Button type="submit" disabled={search.isPending || !textQuery.trim()} className="gap-2">
                {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
                Buscar
              </Button>
            </form>

            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {usageLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : limite?.tem_credencial_propria ? (
                <Badge variant="outline">Chave própria conectada — sem limite do RDCheck</Badge>
              ) : limite ? (
                <span>
                  Leads incluídos {limite.limite_tipo === "trial" ? "na demonstração" : "neste mês"}:{" "}
                  <strong>
                    {limite.usados} de {limite.limite}
                  </strong>{" "}
                  utilizados
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {resultados.length > 0 && (
          <div className="mb-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={elegiveis.length > 0 && selecionados.size === elegiveis.length}
                onCheckedChange={toggleTodos}
              />
              Selecionar todos elegíveis ({elegiveis.length})
            </label>
            <Button size="sm" disabled={selecionados.size === 0} onClick={abrirImportacaoLote}>
              Adicionar {selecionados.size > 0 ? selecionados.size : ""} selecionados ao CRM
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {resultados.map((r) => (
            <Card key={r.placeId}>
              <CardContent className="flex items-start gap-3 py-3">
                <Checkbox
                  className="mt-1"
                  disabled={r.jaExisteNoCrm}
                  checked={selecionados.has(r.placeId)}
                  onCheckedChange={() => toggleSelecionado(r.placeId)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.nome}</span>
                    {r.categoria && <Badge variant="secondary">{r.categoria}</Badge>}
                    {r.jaExisteNoCrm && <Badge variant="outline">Já está no CRM</Badge>}
                  </div>
                  {r.endereco && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {r.endereco}
                    </p>
                  )}
                  {r.googleMapsUri && (
                    <a
                      href={r.googleMapsUri}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Ver no Google Maps
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {resultados.length === 0 && !search.isPending && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Busque por categoria e cidade pra ver estabelecimentos aqui. Resultados vêm do Google Maps e não são
              salvos até você confirmar a importação.
            </p>
          )}
        </div>

        <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Revisar e confirmar importação</DialogTitle>
              <DialogDescription>
                Revise os dados abaixo antes de salvar — só o que você confirmar aqui vira uma Conta permanente no
                CRM.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {Object.entries(batchForms).map(([placeId, form]) => (
                <div key={placeId} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{form.razaoSocial || "(sem nome)"}</span>
                    {batchStatus[placeId] === "ok" && <Badge>Importado</Badge>}
                    {batchStatus[placeId] === "erro" && <Badge variant="destructive">Erro</Badge>}
                    {batchStatus[placeId] === "importando" && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <Label className="text-xs">Razão social</Label>
                      <Input
                        value={form.razaoSocial}
                        disabled={batchStatus[placeId] !== "pendente"}
                        onChange={(e) =>
                          setBatchForms((prev) => ({ ...prev, [placeId]: { ...prev[placeId], razaoSocial: e.target.value } }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cidade</Label>
                      <Input
                        value={form.cidade}
                        disabled={batchStatus[placeId] !== "pendente"}
                        onChange={(e) =>
                          setBatchForms((prev) => ({ ...prev, [placeId]: { ...prev[placeId], cidade: e.target.value } }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Estado</Label>
                      <Input
                        value={form.estado}
                        disabled={batchStatus[placeId] !== "pendente"}
                        onChange={(e) =>
                          setBatchForms((prev) => ({ ...prev, [placeId]: { ...prev[placeId], estado: e.target.value } }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBatchOpen(false)}>
                Fechar
              </Button>
              <Button onClick={confirmarImportacaoLote} disabled={importLead.isPending}>
                {importLead.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar e importar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppShell>
    </ProtectedRoute>
  );
}
