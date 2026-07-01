import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/elevare/AppShell";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown, MessageCircle, ArrowLeft } from "lucide-react";
import { calcularPercentual, classificacao, type Inspecao } from "@/lib/storage";
import { checklistSections } from "@/lib/checklist-data";
import { gerarPDF } from "@/lib/pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/resultado")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: s.id as string,
    readonly: Boolean(s.readonly),
  }),
  head: () => ({
    meta: [{ title: "Resultado · Elevare" }],
  }),
  component: ResultadoPage,
});

function ResultadoPage() {
  const { id } = Route.useSearch();
  const [insp, setInsp] = useState<Inspecao | null>(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) { navigate({ to: "/historico" }); return; }
    supabase.from("inspecoes").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        const mapped: Inspecao = {
          id: data.id,
          numero_sequencial: data.numero_sequencial,
          status: data.status as "em_andamento" | "concluida",
          estabelecimento: data.estabelecimento_nome,
          dataInicio: data.data_inicio,
          dataConclusao: data.data_conclusao,
          progresso: data.progresso,
          conformidade: data.conformidade,
          dados: (data.dados as any) || { estabelecimento: {}, questionario: {}, funcionarios: [], fotos: {} },
          respostas: (data.respostas as any) || {},
        };
        setInsp(mapped);
      }
      setLoading(false);
    });
  }, [id, navigate]);

  const handleGerarPDF = async () => {
    if (!insp) return;
    setGerando(true);
    try {
      await gerarPDF(insp);
      toast.success("PDF gerado com sucesso!");
    } catch (e) {
      toast.error("Erro ao gerar PDF.");
      console.error(e);
    } finally {
      setGerando(false);
    }
  };

  const handleWhatsApp = () => {
    if (!insp) return;
    const score = calcularPercentual(insp.respostas);
    const cls = classificacao(score.percentual);
    const msg = encodeURIComponent(`Olá! Segue o resultado da inspeção sanitária do estabelecimento *${insp.estabelecimento}*:\n\n✅ Conformidade: *${score.percentual.toFixed(1)}%* — ${cls.label}\n\nAcesse o relatório completo em: ${window.location.href}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  if (loading) return <AppShell><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div></AppShell>;
  if (!insp) return <AppShell><p className="text-center py-12 text-slate-400">Inspeção não encontrada.</p></AppShell>;

  const score = calcularPercentual(insp.respostas);
  const cls = classificacao(score.percentual);

  const naoConformes: { item: string; secao: string; descricao: string }[] = [];
  checklistSections.forEach(s => {
    s.items.forEach(item => {
      if (insp.respostas[item.id] === "N") {
        naoConformes.push({ item: item.id, secao: s.title, descricao: item.text });
      }
    });
  });

  const secaoStats = checklistSections.map(s => {
    const resps = s.items.map(i => insp.respostas[i.id]);
    const S = resps.filter(r => r === "S").length;
    const N = resps.filter(r => r === "N").length;
    const NA = resps.filter(r => r === "NA").length;
    const aplicaveis = S + N;
    const pct = aplicaveis > 0 ? (S / aplicaveis) * 100 : null;
    return { title: s.title, S, N, NA, pct };
  });

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{insp.estabelecimento}</h1>
            <p className="text-sm text-slate-500 mt-1">
              CNPJ: {insp.dados.estabelecimento?.cnpj} · {new Date(insp.dataInicio).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleWhatsApp} variant="outline" className="gap-2">
              <MessageCircle className="h-4 w-4 text-green-500" />WhatsApp
            </Button>
            <Button onClick={handleGerarPDF} disabled={gerando} className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white gap-2">
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Gerar PDF
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-5xl font-bold" style={{ color: cls.color }}>{score.percentual.toFixed(1)}%</p>
              <p className="text-sm text-slate-500 mt-1">Conformidade geral</p>
            </div>
            <div>
              <span className="text-lg font-bold px-4 py-2 rounded-full" style={{ color: cls.color, background: cls.bg }}>
                {cls.label === "BOM" ? "✅" : cls.label === "REGULAR" ? "⚠️" : "❌"} {cls.label}
              </span>
            </div>
            <div className="ml-auto grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-semibold text-green-600">{score.conformes}</p>
                <p className="text-xs text-slate-500">Conformes</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-red-600">{score.naoConformes}</p>
                <p className="text-xs text-slate-500">Não conformes</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-400">{score.naoAplicaveis}</p>
                <p className="text-xs text-slate-500">N/A</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-medium">Conformidade por seção</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#1a4d2e] text-white">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium">Seção</th>
                <th className="text-center px-3 py-2 text-xs font-medium">S</th>
                <th className="text-center px-3 py-2 text-xs font-medium">N</th>
                <th className="text-center px-3 py-2 text-xs font-medium">NA</th>
                <th className="text-center px-3 py-2 text-xs font-medium">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {secaoStats.map((s, i) => {
                const c = s.pct !== null ? classificacao(s.pct) : null;
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-4 py-2 text-xs">{s.title}</td>
                    <td className="px-3 py-2 text-center text-xs text-green-600 font-medium">{s.S}</td>
                    <td className="px-3 py-2 text-center text-xs text-red-600 font-medium">{s.N}</td>
                    <td className="px-3 py-2 text-center text-xs text-slate-400">{s.NA}</td>
                    <td className="px-3 py-2 text-center">
                      {c ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: c.color, background: c.bg }}>
                          {s.pct!.toFixed(0)}%
                        </span>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {naoConformes.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-medium text-red-600">Não conformidades identificadas</h2>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">{naoConformes.length}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {naoConformes.map((nc, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded flex-shrink-0 mt-0.5">
                    {nc.item}
                  </span>
                  <div>
                    <p className="text-xs text-slate-400">{nc.secao}</p>
                    <p className="text-sm text-slate-700">{nc.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pb-6">
          <Button onClick={() => navigate({ to: "/historico" })} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />Voltar ao histórico
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
