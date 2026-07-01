import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { classificacao } from "@/lib/storage";
import { checklistSections } from "@/lib/checklist-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: DashboardWrapper,
});

function DashboardWrapper() {
  return (
    <ProtectedRoute allowedProfiles={["admin"]}>
      <DashboardPage />
    </ProtectedRoute>
  );
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, media: 0, ativos: 0, ruins: 0 });
  const [distribuicao, setDistribuicao] = useState<any[]>([]);
  const [porMes, setPorMes] = useState<any[]>([]);
  const [secoesCriticas, setSecoesCriticas] = useState<any[]>([]);
  const [criticos, setCriticos] = useState<any[]>([]);
  const [consultores, setConsultores] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const { data: inspecoes } = await supabase.from("inspecoes").select("*");
        const { data: profiles } = await supabase.from("profiles").select("id, nome, perfil");
        if (!inspecoes) return;

        const concluidas = inspecoes.filter(i => i.status === "concluida");
        const media = concluidas.length ? concluidas.reduce((a, i) => a + Number(i.conformidade), 0) / concluidas.length : 0;
        const ruins = concluidas.filter(i => Number(i.conformidade) < 50).length;
        const cnpjs = new Set(inspecoes.map(i => i.cnpj)).size;
        setStats({ total: inspecoes.length, media: Math.round(media * 10) / 10, ativos: cnpjs, ruins });

        const bom = concluidas.filter(i => Number(i.conformidade) >= 76).length;
        const regular = concluidas.filter(i => Number(i.conformidade) >= 51 && Number(i.conformidade) < 76).length;
        setDistribuicao([
          { name: "BOM", value: bom, color: "#639922" },
          { name: "REGULAR", value: regular, color: "#BA7517" },
          { name: "RUIM", value: ruins, color: "#E24B4A" },
        ]);

        const meses: Record<string, { concluidas: number; andamento: number }> = {};
        inspecoes.forEach(i => {
          const mes = new Date(i.data_inicio).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
          if (!meses[mes]) meses[mes] = { concluidas: 0, andamento: 0 };
          if (i.status === "concluida") meses[mes].concluidas++;
          else meses[mes].andamento++;
        });
        setPorMes(Object.entries(meses).slice(-6).map(([mes, v]) => ({ mes, ...v })));

        const secaoNaoConf: Record<string, number> = {};
        concluidas.forEach(i => {
          const respostas = (i.respostas as any) || {};
          checklistSections.forEach(s => {
            const n = s.items.filter(item => respostas[item.id] === "N").length;
            secaoNaoConf[s.title] = (secaoNaoConf[s.title] || 0) + n;
          });
        });
        setSecoesCriticas(Object.entries(secaoNaoConf).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([secao, count]) => ({ secao: secao.split(" ").slice(0, 2).join(" "), count })));

        const crit = concluidas.filter(i => Number(i.conformidade) < 60).sort((a, b) => Number(a.conformidade) - Number(b.conformidade)).slice(0, 5);
        setCriticos(crit);

        const profMap: Record<string, string> = {};
        profiles?.filter(p => p.perfil !== "cliente").forEach(p => profMap[p.id] = p.nome);
        const consMap: Record<string, { nome: string; total: number; soma: number }> = {};
        concluidas.forEach(i => {
          const nome = profMap[i.consultor_id] || "Desconhecido";
          if (!consMap[i.consultor_id]) consMap[i.consultor_id] = { nome, total: 0, soma: 0 };
          consMap[i.consultor_id].total++;
          consMap[i.consultor_id].soma += Number(i.conformidade);
        });
        setConsultores(Object.values(consMap).map(c => ({ nome: c.nome, total: c.total, media: c.total > 0 ? Math.round(c.soma / c.total * 10) / 10 : 0 })).sort((a, b) => b.media - a.media));

      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <AppShell><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div></AppShell>;

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total de inspeções", value: stats.total },
          { label: "Média de conformidade", value: `${stats.media}%` },
          { label: "Estabelecimentos", value: stats.ativos },
          { label: "Classificação RUIM", value: stats.ruins, danger: true },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={cn("text-2xl font-semibold mt-1", s.danger && stats.ruins > 0 ? "text-red-600" : "")}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Inspeções por mês</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="concluidas" name="Concluídas" fill="#639922" radius={[3,3,0,0]} />
                <Bar dataKey="andamento" name="Em andamento" fill="#BA7517" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Distribuição por classificação</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={distribuicao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {distribuicao.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Seções com mais não conformidades</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {secoesCriticas.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-28 truncate flex-shrink-0">{s.secao}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-red-400" style={{ width: `${Math.min((s.count / (secoesCriticas[0]?.count || 1)) * 100, 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 w-6 text-right">{s.count}</span>
                </div>
              ))}
              {secoesCriticas.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhum dado disponível.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Estabelecimentos críticos</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {criticos.map((i, idx) => {
                const cls = classificacao(Number(i.conformidade));
                return (
                  <div key={idx} className="flex items-center justify-between py-2 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded" onClick={() => navigate({ to: "/resultado", search: { id: i.id, readonly: true } })}>
                    <span className="text-sm text-slate-700 truncate flex-1">{i.estabelecimento_nome}</span>
                    <span className="text-xs font-bold ml-3 px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: cls.color, background: cls.bg }}>{Number(i.conformidade).toFixed(1)}%</span>
                  </div>
                );
              })}
              {criticos.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhum estabelecimento crítico.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Performance por consultor</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {consultores.map((c, i) => {
              const cls = classificacao(c.media);
              return (
                <div key={i} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-700">{c.nome}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400">{c.total} inspeções</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: cls.color, background: cls.bg }}>{c.media}%</span>
                  </div>
                </div>
              );
            })}
            {consultores.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhum dado disponível.</p>}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
