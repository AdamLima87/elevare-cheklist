import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, media: 0, ativos: 0, ruins: 0 });
  const [inspecoes, setInspecoes] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("inspecoes").select("*").order("data_inicio", { ascending: false });
      if (data) {
        setInspecoes(data);
        const concluidas = data.filter(i => i.status === "concluida");
        const media = concluidas.length ? concluidas.reduce((a, i) => a + Number(i.conformidade), 0) / concluidas.length : 0;
        const ruins = concluidas.filter(i => Number(i.conformidade) < 50).length;
        const cnpjs = new Set(data.map(i => i.cnpj)).size;
        setStats({ total: data.length, media: Math.round(media * 10) / 10, ativos: cnpjs, ruins });
      }
    }
    load();
  }, []);

  const badge = (v: number) => v >= 76 ? "bg-green-100 text-green-700" : v >= 51 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  const label = (v: number) => v >= 76 ? "BOM" : v >= 51 ? "REGULAR" : "RUIM";

  return (
    <ProtectedRoute allowedProfiles={["admin"]}>
      <AppShell>
        <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total de inspeções", value: stats.total },
            { label: "Média de conformidade", value: `${stats.media}%` },
            { label: "Estabelecimentos", value: stats.ativos },
            { label: "Classificação RUIM", value: stats.ruins },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-2xl font-semibold mt-1">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-medium mb-4">Inspeções recentes</h2>
          <div className="divide-y">
            {inspecoes.slice(0, 10).map(i => (
              <div key={i.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{i.estabelecimento_nome}</p>
                  <p className="text-xs text-slate-500">{new Date(i.data_inicio).toLocaleDateString("pt-BR")}</p>
                </div>
                {i.status === "concluida" ? (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${badge(Number(i.conformidade))}`}>
                    {Number(i.conformidade).toFixed(1)}% {label(Number(i.conformidade))}
                  </span>
                ) : (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Em andamento</span>
                )}
              </div>
            ))}
            {inspecoes.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Nenhuma inspeção ainda.</p>}
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
