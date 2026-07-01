import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingDown, Users, Building2, ClipboardCheck, AlertTriangle } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from "recharts";
import { checklistSections } from "@/lib/checklist-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data: inspections, error } = await supabase
          .from("inspecoes")
          .select("*");

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
        const concluded = inspections?.filter(i => i.status === "concluida") || [];
        const avgCompliance = concluded.length > 0 
          ? concluded.reduce((acc, i) => acc + (Number(i.conformidade) || 0), 0) / concluded.length 
          : 0;
        
        const activeEstabs = new Set(inspections?.map(i => i.cnpj || i.estabelecimento_nome)).size;
        
        const classifications = concluded.reduce((acc, i) => {
          const conf = Number(i.conformidade) || 0;
          if (conf >= 76) acc.bom++;
          else if (conf >= 51) acc.regular++;
          else acc.ruim++;
          return acc;
        }, { bom: 0, regular: 0, ruim: 0 });

        const pctRuim = concluded.length > 0 ? (classifications.ruim / concluded.length) * 100 : 0;

        // Monthly data
        const monthlyDataMap: any = {};
        inspections?.forEach(i => {
          const date = new Date(i.data_inicio);
          const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          if (!monthlyDataMap[key]) monthlyDataMap[key] = { name: key, concluida: 0, em_andamento: 0 };
          if (i.status === "concluida") monthlyDataMap[key].concluida++;
          else monthlyDataMap[key].em_andamento++;
        });
        const monthlyData = Object.values(monthlyDataMap).sort((a: any, b: any) => a.name.localeCompare(b.name));

        // Pie chart data
        const pieData = [
          { name: "Bom", value: classifications.bom, color: "#10b981" },
          { name: "Regular", value: classifications.regular, color: "#f59e0b" },
          { name: "Ruim", value: classifications.ruim, color: "#ef4444" },
        ].filter(d => d.value > 0);

        // Non-conformities ranking
        const sectionNonConf: any = {};
        checklistSections.forEach(s => sectionNonConf[s.id] = { id: s.id, title: s.title, count: 0 });
        
        inspections?.forEach(i => {
          const respostas = i.respostas as any;
          if (respostas) {
            checklistSections.forEach(sec => {
              sec.items.forEach(item => {
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

        // Consultant performance
        const consultantPerfMap: any = {};
        inspections?.forEach(i => {
          const cId = i.consultor_id;
          if (cId) {
            if (!consultantPerfMap[cId]) consultantPerfMap[cId] = { nome: consultantMap[cId] || "Desconhecido", count: 0, sum: 0, concluded: 0 };
            consultantPerfMap[cId].count++;
            if (i.status === "concluida") {
              consultantPerfMap[cId].concluded++;
              consultantPerfMap[cId].sum += (Number(i.conformidade) || 0);
            }
          }
        });
        const consultantPerf = Object.values(consultantPerfMap).map((c: any) => ({
          ...c,
          avg: c.concluded > 0 ? c.sum / c.concluded : 0
        }));

        // Segment performance
        const segmentMap: any = {};
        inspections?.forEach(i => {
          const segment = (i.dados as any)?.estabelecimento?.atividade || "Não informado";
          if (!segmentMap[segment]) segmentMap[segment] = { name: segment, count: 0, sum: 0, concluded: 0 };
          segmentMap[segment].count++;
          if (i.status === "concluida") {
            segmentMap[segment].concluded++;
            segmentMap[segment].sum += (Number(i.conformidade) || 0);
          }
        });
        const segmentPerf = Object.values(segmentMap).map((s: any) => ({
          ...s,
          avg: s.concluded > 0 ? s.sum / s.concluded : 0
        })).sort((a: any, b: any) => b.count - a.count).slice(0, 10);

        setStats({
          totalInspections,
          avgCompliance,
          activeEstabs,
          pctRuim,
          monthlyData,
          pieData,
          rankingNonConf,
          bottomEstabs,
          consultantPerf,
          segmentPerf
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
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
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral das inspeções e performance sanitária.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Total de Inspeções" 
              value={stats.totalInspections} 
              icon={ClipboardCheck} 
              color="bg-blue-50 text-blue-600"
            />
            <StatCard 
              title="Média de Conformidade" 
              value={`${(stats.avgCompliance || 0).toFixed(1)}%`} 
              icon={TrendingDown} 
              color="bg-green-50 text-green-600"
              sub="Dos concluídos"
            />
            <StatCard 
              title="Estabelecimentos" 
              value={stats.activeEstabs} 
              icon={Building2} 
              color="bg-purple-50 text-purple-600"
            />
            <StatCard 
              title="Classificação RUIM" 
              value={`${(stats.pctRuim || 0).toFixed(1)}%`} 
              icon={AlertTriangle} 
              color="bg-red-50 text-red-600"
              sub="Abaixo de 50%"
            />
          </div>

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
                    <Bar dataKey="concluida" name="Concluídas" fill="#1a4d2e" radius={[4, 4, 0, 0]} />
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

function StatCard({ title, value, icon: Icon, color, sub }: any) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={cn("p-3 rounded-xl", color)}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold mt-0.5">{value}</h3>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}
