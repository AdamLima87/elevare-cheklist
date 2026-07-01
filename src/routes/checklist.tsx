import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { checklistSections, totalChecklistItems } from "@/lib/checklist-data";
import {
  loadRascunho, saveRascunho, clearRascunho, calcularPercentual,
  emptyFuncionario, type Inspecao, type Resposta, type Funcionario,
} from "@/lib/storage";

export const Route = createFileRoute("/checklist")({
  head: () => ({
    meta: [{ title: "Checklist · Elevare" }, { name: "description", content: "Lista de Verificação Higiênico-Sanitária." }],
  }),
  component: ChecklistWrapper,
});

function ChecklistWrapper() {
  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <ChecklistPage />
    </ProtectedRoute>
  );
}

function ChecklistPage() {
  const navigate = useNavigate();
  const [insp, setInsp] = useState<Inspecao | null>(null);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [secaoAberta, setSecaoAberta] = useState<string>("instalacoes");
  const [saving, setSaving] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [questionario, setQuestionario] = useState<Record<string, string>>({});

  useEffect(() => {
    const r = loadRascunho();
    if (!r) { navigate({ to: "/nova-inspecao" }); return; }
    setInsp(r);
    setRespostas(r.respostas || {});
    setFuncionarios(r.dados?.funcionarios || []);
    setQuestionario(r.dados?.questionario as any || {});
  }, [navigate]);

  const score = calcularPercentual(respostas);

  const responder = async (id: string, valor: Resposta) => {
    const novas = { ...respostas, [id]: valor };
    setRespostas(novas);
    if (insp) {
      const s = calcularPercentual(novas);
      const updated = { ...insp, respostas: novas, progresso: s.progresso, dados: { ...insp.dados, funcionarios, questionario: questionario as any } };
      setInsp(updated);
      localStorage.setItem("elevare_rascunho", JSON.stringify(updated));
      await supabase.from("inspecoes").update({ respostas: novas as any, progresso: s.progresso }).eq("id", insp.id);
    }
  };

  const updateQuestionario = (k: string, v: string) => setQuestionario(q => ({ ...q, [k]: v }));

  const addFuncionario = () => setFuncionarios(f => [...f, emptyFuncionario()]);
  const removeFuncionario = (i: number) => setFuncionarios(f => f.filter((_, idx) => idx !== i));
  const updateFuncionario = (i: number, k: keyof Funcionario, v: string) => {
    setFuncionarios(f => f.map((func, idx) => idx === i ? { ...func, [k]: v } : func));
  };

  const handleFinalizar = async () => {
    if (score.progresso < 80) { toast.error(`Responda pelo menos 80% dos itens. Atual: ${score.progresso}%`); return; }
    setSaving(true);
    try {
      const updated = { ...insp!, respostas, progresso: 100, conformidade: score.percentual, status: "concluida" as const, dataConclusao: new Date().toISOString(), dados: { ...insp!.dados, funcionarios, questionario: questionario as any } };
      await supabase.from("inspecoes").update({ status: "concluida", conformidade: score.percentual, progresso: 100, data_conclusao: new Date().toISOString(), respostas: respostas as any, dados: updated.dados as any }).eq("id", insp!.id);
      clearRascunho();
      toast.success("Inspeção finalizada com sucesso!");
      navigate({ to: "/resultado", search: { id: insp!.id, readonly: false } });
    } catch { toast.error("Erro ao finalizar."); }
    finally { setSaving(false); }
  };

  if (!insp) return <AppShell><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Inspeção</p>
              <h1 className="text-lg font-semibold">{insp.estabelecimento}</h1>
            </div>
            <span className="text-sm text-slate-500">{score.respondidos}/{totalChecklistItems} ({score.progresso}%)</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-[#1a4d2e] h-2 rounded-full transition-all duration-300" style={{ width: `${score.progresso}%` }} />
          </div>
        </div>

        <Tabs defaultValue="apendice-a" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="apendice-a" className="flex-1">Apêndice A — Verificação</TabsTrigger>
            <TabsTrigger value="apendice-b" className="flex-1">Apêndice B — Questionário</TabsTrigger>
          </TabsList>

          <TabsContent value="apendice-a" className="space-y-3">
            {checklistSections.map(secao => {
              const respondidosSecao = secao.items.filter(i => respostas[i.id]).length;
              const aberta = secaoAberta === secao.id;
              return (
                <div key={secao.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button onClick={() => setSecaoAberta(aberta ? "" : secao.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#1a4d2e] text-white hover:bg-[#1a4d2e]/90 transition-colors">
                    <span className="font-medium text-sm text-left">{secao.title}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{respondidosSecao}/{secao.items.length}</span>
                      {aberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {aberta && (
                    <div className="divide-y divide-slate-100">
                      {secao.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3 gap-4 hover:bg-slate-50">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-slate-400 font-mono mr-2">{item.id}.</span>
                            <span className="text-sm text-slate-700">{item.text}</span>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {(["S", "N", "NA"] as Resposta[]).map(op => (
                              <button key={op!} onClick={() => responder(item.id, op)}
                                className={`w-10 h-8 rounded text-xs font-bold border transition-all ${
                                  respostas[item.id] === op
                                    ? op === "S" ? "bg-green-500 text-white border-green-500"
                                    : op === "N" ? "bg-red-500 text-white border-red-500"
                                    : "bg-slate-500 text-white border-slate-500"
                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                                }`}>{op}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="apendice-b" className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <h2 className="font-medium text-slate-800">Dados do Estabelecimento / Responsável</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Receptividade", k: "receptividade", options: ["Elevada", "Média", "Baixa"] },
                  { label: "Nº de trabalhadores", k: "numTrabalhadores", options: ["até 2", "2 a 5", "6 a 10", "11 a 15", "16 a 20", "21 ou +"] },
                  { label: "Refeições oferecidas/período", k: "refeicoesPeriodo" },
                  { label: "Alimentos predominantes no cardápio", k: "alimentosCardapio" },
                  { label: "Instruções aos funcionários?", k: "instrucoesFuncionarios", options: ["Sim", "Não"] },
                  { label: "Cursos e treinamentos", k: "cursosTreinamentos", options: ["1x mês", "1x 3 meses", "1x 6 meses", "1x ano", "Não realiza"] },
                  { label: "Avaliação pós-treinamento?", k: "avaliacaoPos", options: ["Sim", "Não"] },
                  { label: "Frequência do uniforme", k: "fornecimentoUniformeFreq", options: ["Na admissão", "Semestral", "Anual", "Raramente"] },
                ].map(({ label, k, options }) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs text-slate-500">{label}</Label>
                    {options ? (
                      <select value={questionario[k] || ""} onChange={e => updateQuestionario(k, e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d2e]/30">
                        <option value="">Selecione...</option>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <Input value={questionario[k] || ""} onChange={e => updateQuestionario(k, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-slate-800">Dados dos Funcionários</h2>
                <Button onClick={addFuncionario} variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />Adicionar funcionário
                </Button>
              </div>
              {funcionarios.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum funcionário adicionado ainda.</p>
              )}
              {funcionarios.map((func, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Funcionário {i + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeFuncionario(i)} className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Nome", k: "nome" as keyof Funcionario },
                      { label: "Idade", k: "idade" as keyof Funcionario },
                      { label: "Escolaridade", k: "escolaridade" as keyof Funcionario },
                      { label: "Carteira assinada", k: "carteiraAssinada" as keyof Funcionario },
                      { label: "Curso BMP", k: "cursoBMP" as keyof Funcionario },
                    ].map(({ label, k }) => (
                      <div key={k} className="space-y-1">
                        <Label className="text-xs text-slate-500">{label}</Label>
                        <Input value={func[k] as string} onChange={e => updateFuncionario(i, k, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end pb-6">
          <Button onClick={handleFinalizar} disabled={saving || score.progresso < 80}
            title={score.progresso < 80 ? `Responda pelo menos 80% dos itens (atual: ${score.progresso}%)` : ""}
            className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white gap-2 px-8">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar Inspeção"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
