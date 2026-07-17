import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingDown, Users, Building2, ClipboardCheck, AlertTriangle, CalendarClock, FileWarning } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { checklistSections } from "@/lib/checklist-data";
import { dedupeLatestPerCnpj, dueDate, isWithinReminderWindow } from "@/lib/reinspection";
import { cn } from "@/lib/utils";
import { useUpcomingVisitas } from "@/hooks/useVisitas";
import { useExpiringDocumentos } from "@/hooks/useDocumentos";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const DASHBOARD_COLUMNS =
  "id, status, conformidade, cnpj, estabelecimento_nome, data_inicio, data_conclusao, consultor_id, dados, respostas";

async function fetchDashboardStats() {
  const { data: inspections, error } = await supabase.from("inspecoes").select(DASHBOARD_COLUMNS);

  if (error) throw error;

  const { data: consultants } = await supabase
    .from("profiles")
    .select("id, nome")
    .eq("perfil", "consultor");

  const consultantMap = (consultants || []).reduce((acc: any, c: any) => {
    acc[c.id] = c.nome;
    return acc;
  }, {});

  // Process metrics
  const totalInspections = inspections?.length || 0;
  const concluded = inspections?.filter((i) => i.status === "concluida") || [];
  const avgCompliance =
    concluded.length > 0
      ? concluded.reduce((acc, i) => acc + (Number(i.conformidade) || 0), 0) / concluded.length
      : 0;

  const activeEstabs = new Set(inspections?.map((i) => i.cnpj || i.estabelecimento_nome)).size;

  const classifications = concluded.reduce(
    (acc, i) => {
      const conf = Number(i.conformidade) || 0;
      if (conf >= 76) acc.bom++;
      else if (conf >= 51) acc.regular++;
      else acc.ruim++;
      return acc;
    },
    { bom: 0, regular: 0, ruim: 0 },
  );

  const pctRuim = concluded.length > 0 ? (classifications.ruim / concluded.length) * 100 : 0;

  // Monthly data
  const monthlyDataMap: any = {};
  inspections?.forEach((i) => {
    const date = new Date(i.data_inicio);
    const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    if (!monthlyDataMap[key]) monthlyDataMap[key] = { name: key, concluida: 0, em_andamento: 0 };
    if (i.status === "concluida") monthlyDataMap[key].concluida++;
    else monthlyDataMap[key].em_andamento++;
  });
  const monthlyData = Object.values(monthlyDataMap).sort((a: any, b: any) =>
    a.name.localeCompare(b.name),
  );

  // Pie chart data
  const pieData = [
    { name: "Bom", value: classifications.bom, color: "#18a860" },
    { name: "Regular", value: classifications.regular, color: "#f59e0b" },
    { name: "Ruim", value: classifications.ruim, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  // Non-conformities ranking
  const sectionNonConf: any = {};
  checklistSections.forEach((s) => (sectionNonConf[s.id] = { id: s.id, title: s.title, count: 0 }));

  inspections?.forEach((i) => {
    const respostas = i.respostas as any;
    if (respostas) {
      checklistSections.forEach((sec) => {
        sec.items.forEach((item) => {
          if (respostas[item.id] === "N") {
            sectionNonConf[sec.id].count++;
          }
        });
      });
    }
  });
  const rankingNonConf = Object.values(sectionNonConf)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 8);

  // Bottom 5 establishments
  const bottomEstabs = concluded
    .sort((a, b) => (Number(a.conformidade) || 0) - (Number(b.conformidade) || 0))
    .slice(0, 5);

  // Establishments due (or overdue) for reinspection within the reminder window,
  // one entry per cnpj using its most recent concluded inspection.
  const latestPerCnpj = dedupeLatestPerCnpj(
    concluded
      .filter((i) => i.cnpj && i.data_conclusao)
      .sort(
        (a, b) => new Date(b.data_conclusao as string).getTime() - new Date(a.data_conclusao as string).getTime(),
      ),
  );
  const now = new Date();
  const reinspectionsDue = latestPerCnpj
    .map((i) => ({ ...i, prazo: dueDate(i.data_conclusao as string) }))
    .filter((i) => isWithinReminderWindow(i.prazo, now))
    .sort((a, b) => a.prazo.getTime() - b.prazo.getTime())
    .slice(0, 8);

  // Consultant performance
  const consultantPerfMap: any = {};
  inspections?.forEach((i) => {
    const cId = i.consultor_id;
    if (cId) {
      if (!consultantPerfMap[cId])
        consultantPerfMap[cId] = {
          nome: consultantMap[cId] || "Desconhecido",
          count: 0,
          sum: 0,
          concluded: 0,
        };
      consultantPerfMap[cId].count++;
      if (i.status === "concluida") {
        consultantPerfMap[cId].concluded++;
        consultantPerfMap[cId].sum += Number(i.conformidade) || 0;
      }
    }
  });
  const consultantPerf = Object.values(consultantPerfMap).map((c: any) => ({
    ...c,
    avg: c.concluded > 0 ? c.sum / c.concluded : 0,
  }));

  // Segment performance
  const segmentMap: any = {};
  inspections?.forEach((i) => {
    const segment = (i.dados as any)?.estabelecimento?.atividade || "Não informado";
    if (!segmentMap[segment])
      segmentMap[segment] = { name: segment, count: 0, sum: 0, concluded: 0 };
    segmentMap[segment].count++;
    if (i.status === "concluida") {
      segmentMap[segment].concluded++;
      segmentMap[segment].sum += Number(i.conformidade) || 0;
    }
  });
  const segmentPerf = Object.values(segmentMap)
    .map((s: any) => ({
      ...s,
      avg: s.concluded > 0 ? s.sum / s.concluded : 0,
    }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  return {
    totalInspections,
    avgCompliance,
    activeEstabs,
    pctRuim,
    monthlyData,
    pieData,
    rankingNonConf,
    bottomEstabs,
    reinspectionsDue,
    consultantPerf,
    segmentPerf,
  };
}

function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
  });
  const { data: proximosCompromissos = [] } = useUpcomingVisitas(7);
  const { data: documentosVencendo = [] } = useExpiringDocumentos(30);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!stats) {
    return (
      <AppShell>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Não foi possível carregar as estatísticas.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <ProtectedRoute allowedProfiles={["admin"]}>
      <AppShell>
        <div className="space-y-8">
          <div className="border-b border-border pb-6">
            <span className="label-eyebrow text-primary">RDCheck · Painel</span>
            <h1 className="font-display text-4xl font-semibold mt-2">Diagnóstico Sanitário</h1>
            <p className="text-sm text-muted-foreground mt-1">Visão geral das inspeções e performance de conformidade.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total de Inspeções"
              value={stats.totalInspections}
              icon={ClipboardCheck}
              accent="var(--brand)"
            />
            <StatCard
              title="Conformidade Média"
              value={`${(stats.avgCompliance || 0).toFixed(1)}%`}
              icon={TrendingDown}
              accent="var(--brand-accent)"
              sub="Dos concluídos"
            />
            <StatCard
              title="Estabelecimentos"
              value={stats.activeEstabs}
              icon={Building2}
              accent="var(--amber-seal)"
            />
            <StatCard
              title="Classificação Ruim"
              value={`${(stats.pctRuim || 0).toFixed(1)}%`}
              icon={AlertTriangle}
              accent="var(--destructive)"
              sub="Abaixo de 50%"
            />
          </div>

          {stats.reinspectionsDue.length > 0 && (
            <Card className="p-6 border-l-4" style={{ borderLeftColor: "var(--amber-seal)" }}>
              <CardHeader className="px-0 pt-0 flex-row items-center gap-2 space-y-0">
                <CalendarClock className="h-4 w-4 shrink-0" style={{ color: "var(--amber-seal)" }} />
                <CardTitle className="text-base font-semibold">
                  Reinspeções a vencer ({stats.reinspectionsDue.length})
                </CardTitle>
              </CardHeader>
              <div className="divide-y divide-border">
                {stats.reinspectionsDue.map((item: any) => {
                  const overdue = item.prazo.getTime() < Date.now();
                  const dias = Math.round((item.prazo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{item.estabelecimento_nome}</div>
                        <div
                          className={cn(
                            "text-xs mt-0.5",
                            overdue ? "text-destructive font-medium" : "text-muted-foreground",
                          )}
                        >
                          {overdue
                            ? `Vencida há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`
                            : `Vence em ${dias} dia${dias === 1 ? "" : "s"}`}{" "}
                          · {item.prazo.toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => navigate({ to: "/estabelecimento", search: { cnpj: item.cnpj } })}
                      >
                        Ver histórico
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {proximosCompromissos.length > 0 && (
            <Card className="p-6 border-l-4" style={{ borderLeftColor: "var(--brand)" }}>
              <CardHeader className="px-0 pt-0 flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 shrink-0" style={{ color: "var(--brand)" }} />
                  <CardTitle className="text-base font-semibold">
                    Próximos Compromissos ({proximosCompromissos.length})
                  </CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/agenda" })}>
                  Ver agenda
                </Button>
              </CardHeader>
              <div className="divide-y divide-border">
                {proximosCompromissos.slice(0, 6).map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{v.clientes?.nome ?? "Cliente"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(v.data_hora).toLocaleDateString("pt-BR")} às{" "}
                        {new Date(v.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {v.observacoes ? ` · ${v.observacoes}` : ""}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => navigate({ to: "/clientes/$id", params: { id: v.cliente_id } })}
                    >
                      Ver cliente
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {documentosVencendo.length > 0 && (
            <Card className="p-6 border-l-4" style={{ borderLeftColor: "var(--destructive)" }}>
              <CardHeader className="px-0 pt-0 flex-row items-center gap-2 space-y-0">
                <FileWarning className="h-4 w-4 shrink-0" style={{ color: "var(--destructive)" }} />
                <CardTitle className="text-base font-semibold">
                  Documentos vencidos ou a vencer ({documentosVencendo.length})
                </CardTitle>
              </CardHeader>
              <div className="divide-y divide-border">
                {documentosVencendo.slice(0, 8).map((doc) => {
                  const vencimento = doc.data_vencimento ? new Date(doc.data_vencimento + "T00:00:00") : null;
                  const overdue = !!vencimento && vencimento.getTime() < Date.now();
                  const dias = vencimento ? Math.round((vencimento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {doc.tipo} · {doc.clientes?.nome ?? "Cliente"}
                        </div>
                        <div
                          className={cn(
                            "text-xs mt-0.5",
                            overdue ? "text-destructive font-medium" : "text-muted-foreground",
                          )}
                        >
                          {overdue
                            ? `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`
                            : `Vence em ${dias} dia${dias === 1 ? "" : "s"}`}
                          {vencimento ? ` · ${vencimento.toLocaleDateString("pt-BR")}` : ""}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => navigate({ to: "/clientes/$id", params: { id: doc.cliente_id } })}
                      >
                        Ver cliente
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base font-semibold">Inspeções por Mês</CardTitle>
              </CardHeader>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Legend verticalAlign="top" align="right" height={36}/>
                    <Bar dataKey="concluida" name="Concluídas" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="em_andamento" name="Em andamento" fill="#5cb947" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base font-semibold">Distribuição de Resultados</CardTitle>
              </CardHeader>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.pieData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base font-semibold">Ranking de Não Conformidades por Seção</CardTitle>
              </CardHeader>
              <div className="space-y-4 mt-4">
                {stats.rankingNonConf.map((item: any) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium truncate mr-4">{item.title}</span>
                      <span className="text-muted-foreground">{item.count} itens</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500" 
                        style={{ width: `${(item.count / Math.max(...stats.rankingNonConf.map((r: any) => Math.max(r.count, 1)))) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base font-semibold text-red-600">Menor Conformidade</CardTitle>
              </CardHeader>
              <div className="space-y-4 mt-4">
                {stats.bottomEstabs.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{item.estabelecimento_nome}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{new Date(item.data_inicio).toLocaleDateString()}</div>
                    </div>
                    <div className="text-sm font-bold text-red-600">
                      {Number(item.conformidade || 0).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="p-6">
              <CardHeader className="px-0 pt-0 border-b pb-4 mb-4">
                <CardTitle className="text-base font-semibold">Performance por Consultor</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="pb-2 font-medium">Nome</th>
                      <th className="pb-2 font-medium text-center">Inspeções</th>
                      <th className="pb-2 font-medium text-right">Média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.consultantPerf.map((c: any) => (
                      <tr key={c.nome} className="border-b last:border-0">
                        <td className="py-3 font-medium">{c.nome}</td>
                        <td className="py-3 text-center">{c.count}</td>
                        <td className="py-3 text-right font-bold text-primary">{Number(c.avg || 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-6">
              <CardHeader className="px-0 pt-0 border-b pb-4 mb-4">
                <CardTitle className="text-base font-semibold">Conformidade Média por Segmento</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="pb-2 font-medium">Segmento</th>
                      <th className="pb-2 font-medium text-center">Inspeções</th>
                      <th className="pb-2 font-medium text-right">Média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.segmentPerf.map((s: any) => (
                      <tr key={s.name} className="border-b last:border-0">
                        <td className="py-3 font-medium truncate max-w-[200px]">{s.name}</td>
                        <td className="py-3 text-center">{s.count}</td>
                        <td className="py-3 text-right font-bold text-primary">{Number(s.avg || 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function StatCard({ title, value, icon: Icon, accent, sub }: any) {
  return (
    <div
      className="relative bg-card rounded-md p-5 flex items-center gap-4 border border-border shadow-sm overflow-hidden"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div
        className="p-2.5 rounded-md"
        style={{ background: `color-mix(in oklab, ${accent} 12%, transparent)`, color: accent }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <div>
        <p className="label-eyebrow text-muted-foreground">{title}</p>
        <h3 className="font-display text-3xl font-semibold mt-1 leading-none">{value}</h3>
        {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}
