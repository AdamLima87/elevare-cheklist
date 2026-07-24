import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { useCrmOportunidade, useCrmDiagnostico } from "@/hooks/useCrmOportunidades";
import { useCrmEtapas } from "@/hooks/useCrmCatalogos";

export const Route = createFileRoute("/crm/oportunidades/$id")({
  head: () => ({ meta: [{ title: "Oportunidade · CRM Comercial · RDCheck" }] }),
  component: CrmOportunidadeDetailPage,
});

function formatMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CrmOportunidadeDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/crm/oportunidades/$id" });
  const { data: oportunidade, isLoading } = useCrmOportunidade(id);
  const { data: etapas } = useCrmEtapas(oportunidade?.pipeline_id);
  const etapaAtual = etapas?.find((e) => e.id === oportunidade?.etapa_id);

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/crm/pipeline" })} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Pipeline
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">{oportunidade?.nome || "Oportunidade"}</h1>
              <p className="text-sm text-muted-foreground">
                {oportunidade?.crm_empresas?.nome_fantasia || oportunidade?.crm_empresas?.razao_social || "Conta não identificada"}
                {etapaAtual ? ` · ${etapaAtual.nome}` : ""}
              </p>
            </div>

            {oportunidade?.fechada_em && etapaAtual?.tipo === "ganho" && (
              <div className="mb-4 rounded-md border border-success/30 bg-success/5 px-4 py-2 text-sm text-success">
                Esta oportunidade já foi convertida em cliente.
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Dados da oportunidade</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Valor estimado</p>
                    <p>{oportunidade?.valor_estimado != null ? formatMoeda(oportunidade.valor_estimado) : "---"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Probabilidade</p>
                    <p>{oportunidade?.probabilidade != null ? `${oportunidade.probabilidade}%` : "---"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Previsão de fechamento</p>
                    <p>
                      {oportunidade?.data_prevista_fechamento
                        ? new Date(oportunidade.data_prevista_fechamento + "T00:00:00").toLocaleDateString("pt-BR")
                        : "---"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Concorrente</p>
                    <p>{oportunidade?.concorrente || "---"}</p>
                  </div>
                  {oportunidade?.observacoes && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">Observações</p>
                      <p className="whitespace-pre-wrap">{oportunidade.observacoes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {oportunidade && (
                <DiagnosticoInicialCard
                  crmOportunidadeId={oportunidade.id}
                  crmEmpresaId={oportunidade.crm_empresa_id}
                />
              )}
            </div>

            {oportunidade?.crm_empresa_id && (
              <div className="mt-4">
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() =>
                    navigate({ to: "/crm/empresas/$id", params: { id: oportunidade.crm_empresa_id } })
                  }
                >
                  Ver Conta
                </Button>
              </div>
            )}
          </>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}

function DiagnosticoInicialCard({
  crmOportunidadeId,
}: {
  crmOportunidadeId: string;
  crmEmpresaId?: string;
}) {
  const navigate = useNavigate();
  const { data: diag, isLoading } = useCrmDiagnostico(crmOportunidadeId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (diag?.inconsistente) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Diagnóstico Inicial — inconsistência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Há {diag.rows.length} diagnósticos para esta oportunidade. Isso não deveria acontecer — contate o
            suporte.
          </p>
          {diag.rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded border p-2 text-xs">
              <span>{r.id.slice(0, 8)} · {r.status} · {r.progresso}%</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  navigate({
                    to: "/crm/oportunidades/$id/diagnostico/resultado",
                    params: { id: crmOportunidadeId },
                    search: { inspecaoId: r.id },
                  })
                }
              >
                Ver
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const row = diag?.rows[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Diagnóstico Inicial</CardTitle>
      </CardHeader>
      <CardContent>
        {!row && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Nenhum diagnóstico iniciado ainda. Checklist atual do RDCheck, sem depender de cliente cadastrado.
            </p>
            <Button
              size="sm"
              onClick={() =>
                navigate({ to: "/crm/oportunidades/$id/diagnostico/novo", params: { id: crmOportunidadeId } })
              }
            >
              Iniciar Diagnóstico
            </Button>
          </div>
        )}
        {row?.status === "em_andamento" && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Em andamento — {row.progresso}% concluído.</p>
            <p className="text-xs text-muted-foreground">
              Início: {new Date(row.data_inicio).toLocaleDateString("pt-BR")}
            </p>
            <Button
              size="sm"
              onClick={() =>
                navigate({
                  to: row.estabelecimento_nome
                    ? "/crm/oportunidades/$id/diagnostico/checklist"
                    : "/crm/oportunidades/$id/diagnostico/novo",
                  params: { id: crmOportunidadeId },
                  search: row.estabelecimento_nome ? { inspecaoId: row.id } : undefined,
                })
              }
            >
              Continuar Diagnóstico
            </Button>
          </div>
        )}
        {row?.status === "concluida" && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Concluído em {row.data_conclusao ? new Date(row.data_conclusao).toLocaleDateString("pt-BR") : "---"}
              {row.conformidade != null ? ` — ${Number(row.conformidade).toFixed(1)}% de conformidade` : ""}.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigate({
                  to: "/crm/oportunidades/$id/diagnostico/resultado",
                  params: { id: crmOportunidadeId },
                  search: { inspecaoId: row.id },
                })
              }
            >
              Ver Resultado
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
