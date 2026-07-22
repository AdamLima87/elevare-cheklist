import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { usePlatformDashboardMetrics } from "@/hooks/usePlatform";

export const Route = createFileRoute("/plataforma/")({
  head: () => ({
    meta: [{ title: "Dashboard · Administração da Plataforma · RDCheck" }],
  }),
  component: PlatformDashboardPage,
});

function PlatformDashboardPage() {
  const { data, isLoading } = usePlatformDashboardMetrics();

  return (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Indicadores globais do RDCheck como plataforma.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Metric titulo="Empresas cadastradas" valor={data.empresas_total} />
              <Metric titulo="Empresas ativas" valor={data.empresas_ativas} />
              <Metric titulo="Em trial" valor={data.empresas_trial} />
              <Metric titulo="Pagas" valor={data.empresas_pagas} />
              <Metric titulo="Usuários" valor={data.usuarios_total} />
              <Metric titulo="Clientes" valor={data.clientes_total} />
              <Metric titulo="Inspeções" valor={data.inspecoes_total} />
              <Metric titulo="Contas CRM" valor={data.crm_contas_total} />
              <Metric titulo="Oportunidades" valor={data.crm_oportunidades_total} />
              <Metric titulo="Leads via Google Places" valor={data.leads_google_total} />
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Últimos cadastros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.cadastros_recentes.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada ainda.</p>
                ) : (
                  data.cadastros_recentes.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{e.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {e.plano} · {e.status} · {new Date(e.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </PlatformLayout>
    </ProtectedRoute>
  );
}

function Metric({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-2xl font-bold">{valor}</p>
        <p className="text-xs text-muted-foreground">{titulo}</p>
      </CardContent>
    </Card>
  );
}
