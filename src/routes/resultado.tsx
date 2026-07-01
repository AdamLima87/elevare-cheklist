import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/elevare/AppShell";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";

export const Route = createFileRoute("/resultado")({
  validateSearch: (s: Record<string, unknown>) => ({ id: s.id as string, readonly: Boolean(s.readonly) }),
  component: ResultadoPage,
});

function ResultadoPage() {
  const { id } = Route.useSearch();
  const [insp, setInsp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) { navigate({ to: "/historico" }); return; }
    supabase.from("inspecoes").select("*").eq("id", id).single().then(({ data }) => {
      setInsp(data);
      setLoading(false);
    });
  }, [id, navigate]);

  if (loading) return <AppShell><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div></AppShell>;
  if (!insp) return <AppShell><p className="text-center py-12 text-slate-400">Inspeção não encontrada.</p></AppShell>;

  const conf = Number(insp.conformidade);
  const badgeClass = conf >= 76 ? "bg-green-100 text-green-700" : conf >= 51 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  const label = conf >= 76 ? "✅ BOM" : conf >= 51 ? "⚠️ REGULAR" : "❌ RUIM";
  const respostas = insp.respostas || {};
  const naoConformes = Object.entries(respostas).filter(([, v]) => v === "N").map(([k]) => k);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{insp.estabelecimento_nome}</h1>
            <p className="text-sm text-slate-500">CNPJ: {insp.cnpj} · {new Date(insp.data_inicio).toLocaleDateString("pt-BR")}</p>
          </div>
          <Button onClick={() => window.print()} variant="outline" className="gap-2"><Download className="h-4 w-4" />Gerar PDF</Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-slate-800">{conf.toFixed(1)}%</p>
            <p className="text-sm text-slate-500 mt-1">Conformidade geral</p>
          </div>
          <span className={`text-lg font-bold px-4 py-2 rounded-full ${badgeClass}`}>{label}</span>
          <div className="ml-auto grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xl font-semibold text-green-600">{Object.values(respostas).filter(v => v === "S").length}</p><p className="text-xs text-slate-500">Conformes</p></div>
            <div><p className="text-xl font-semibold text-red-600">{naoConformes.length}</p><p className="text-xs text-slate-500">Não conformes</p></div>
            <div><p className="text-xl font-semibold text-slate-400">{Object.values(respostas).filter(v => v === "NA").length}</p><p className="text-xs text-slate-500">N/A</p></div>
          </div>
        </div>

        {naoConformes.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-medium mb-4 text-red-600">Não conformidades identificadas ({naoConformes.length})</h2>
            <div className="divide-y">
              {naoConformes.map(item => (
                <div key={item} className="py-2 flex items-center gap-3">
                  <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">Item {item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={() => navigate({ to: "/historico" })} variant="outline">← Voltar ao histórico</Button>
        </div>
      </div>
    </AppShell>
  );
}
