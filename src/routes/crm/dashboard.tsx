import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCrmDashboard } from "@/hooks/useCrmDashboard";

export const Route = createFileRoute("/crm/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · CRM Comercial · RDCheck" }],
  }),
  component: CrmDashboardPage,
});

function formatMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function CrmDashboardPage() {
  const { data: stats, isLoading } = useCrmDashboard();

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Dashboard do CRM</h1>
          <p className="text-sm text-muted-foreground">Visão geral do funil comercial.</p>
        </div>

        {isLoading || !stats ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Contas (leads)</p>
                <p className="mt-1 text-3xl font-semibold">{stats.totalLeads}</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Pipeline aberto</p>
                <p className="mt-1 text-2xl font-semibold">{formatMoeda(stats.valorPipeline)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ponderado: {formatMoeda(stats.valorPipelinePonderado)}
                </p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Win rate</p>
                <p className="mt-1 text-3xl font-semibold">{stats.winRate.toFixed(0)}%</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Ticket médio (ganho)</p>
                <p className="mt-1 text-2xl font-semibold">{formatMoeda(stats.ticketMedio)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.tempoMedioFechamentoDias != null
                    ? `Fecha em ${stats.tempoMedioFechamentoDias.toFixed(0)} dias em média`
                    : "Sem oportunidades ganhas ainda"}
                </p>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ranking por responsável</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stats.rankingResponsaveis.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Sem dados ainda.</p>
                  ) : (
                    stats.rankingResponsaveis.map((r) => (
                      <div
                        key={r.responsavel_id}
                        className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{r.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.oportunidadesGanhas} ganha(s) · {r.oportunidadesAbertas} aberta(s)
                          </p>
                        </div>
                        <span className="font-semibold text-foreground">{formatMoeda(r.valorGanho)}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Motivos de perda</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.motivosPerda.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma oportunidade perdida ainda.
                    </p>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.motivosPerda} layout="vertical" margin={{ left: 24 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="quantidade" fill="var(--color-destructive)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Origens de lead</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.origensLead.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada ainda.</p>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.origensLead} layout="vertical" margin={{ left: 24 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="quantidade" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
