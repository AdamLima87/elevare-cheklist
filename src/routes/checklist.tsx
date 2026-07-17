import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { checklistSections, totalChecklistItems } from "@/lib/checklist-data";
import {
  emptyFuncionario,
  loadRascunho,
  createNewInspecao,
  saveRascunho,
  saveToHistorico,
  calcularPercentual,
  type Funcionario,
  type Inspecao,
  type Resposta,
} from "@/lib/storage";
import { ArrowRight, Camera, Plus, X, Trash2, RefreshCw } from "lucide-react";
import { SyncStatus } from "@/components/elevare/SyncStatus";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checklist")({
  head: () => ({
    meta: [{ title: "Checklist · RDCheck" }, { name: "description", content: "Lista de Verificação Higiênico-Sanitária e Questionário Socioeconômico." }],
  }),
  component: ChecklistPage,
});

function ChecklistPage() {
  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <ChecklistContent />
    </ProtectedRoute>
  );
}

function ChecklistContent() {

  const navigate = useNavigate();
  const [insp, setInsp] = useState<Inspecao | null>(null);
  const [activeTab, setActiveTab] = useState("a");

  useEffect(() => {
    try {
      let r = loadRascunho();
      if (!r) {
        toast.error("Preencha os dados do estabelecimento para iniciar.");
        navigate({ to: "/nova-inspecao" });
        return;
      }
      setInsp(r);
    } catch (e) {
      console.error("Erro ao carregar inspeção:", e);
      toast.error("Erro ao carregar dados.");
      navigate({ to: "/nova-inspecao" });
    }
  }, [navigate]);

  if (!insp) return null;

  const persist = async (updater: (i: Inspecao) => Inspecao) => {
    try {
      let nextInsp: Inspecao | null = null;
      
      setInsp((cur) => {
        if (!cur) return cur;
        const next = updater(cur);
        const totalAnswers = Object.keys(next.respostas || {}).length;
        next.progresso = Math.round((totalAnswers / totalChecklistItems) * 100);
        
        // CRITICAL: Any change forces status back to "em_andamento"
        if (next.status === "concluida") {
          console.log("Modification detected: changing status to em_andamento");
          next.status = "em_andamento";
        }
        
        nextInsp = next;
        return next;
      });

      // Persist after state update is defined
      if (nextInsp) {
        const newCloudUpdatedAt = await saveToHistorico(nextInsp);
        // saveToHistorico compares insp.cloudUpdatedAt against the cloud row to
        // detect concurrent edits. Without feeding the fresh timestamp back into
        // state here, every save after the first one in this session would look
        // like it conflicts with itself and get silently dropped.
        if (newCloudUpdatedAt) {
          setInsp((cur) => (cur && cur.id === nextInsp!.id ? { ...cur, cloudUpdatedAt: newCloudUpdatedAt } : cur));
        }
      }
    } catch (error) {
      console.error("Erro ao persistir dados:", error);
      toast.error("Erro ao salvar dados.");
    }
  };

  const respondidos = Object.values(insp.respostas || {}).filter((r) => r !== null && r !== undefined).length;
  const progresso = Math.round((respondidos / totalChecklistItems) * 100);

  const finalizar = () => {
    if (respondidos < totalChecklistItems) {
      // Identificar itens faltantes
      const faltantes: string[] = [];
      checklistSections.forEach((sec) => {
        sec.items.forEach((item) => {
          if (insp.respostas?.[item.id] == null) {
            faltantes.push(item.id);
          }
        });
      });

      if (faltantes.length > 0) {
        toast.error(`Ainda faltam ${faltantes.length} itens: ${faltantes.join(", ")}`, {
          duration: 5000,
        });
      }
      return;
    }
    navigate({ to: "/resultado" });
  };

  try {
    return (
      <AppShell>
        <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between sm:justify-start sm:gap-4 mb-1">
              <div className="flex items-center gap-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Inspeção</div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate({ to: "/nova-inspecao" })}
                  className="h-7 text-xs gap-1 hover:bg-accent"
                >
                  <ArrowRight className="h-3 w-3 rotate-180" /> Editar Identificação
                </Button>
              </div>
              <SyncStatus />
            </div>
            <h1 className="text-xl font-semibold">{insp.estabelecimento || insp.dados?.estabelecimento?.nomeFantasia || "Sem nome"}</h1>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={progresso} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground">
              {respondidos}/{totalChecklistItems} ({progresso}%)
            </span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => {
          if (v === "b" && respondidos < totalChecklistItems) {
            toast.error("Complete todos os itens do Apêndice A antes de prosseguir para o Apêndice B.");
            return;
          }
          setActiveTab(v);
        }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="a">Apêndice A — Verificação</TabsTrigger>
            <TabsTrigger 
              value="b" 
              disabled={respondidos < totalChecklistItems}
              title={respondidos < totalChecklistItems ? "Complete todos os itens do Apêndice A primeiro" : ""}
            >
              Apêndice B — Questionário Socioeconômico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="a" className="mt-4">
            <ApendiceA 
              insp={insp} 
              persist={persist} 
              totalItems={totalChecklistItems} 
              onComplete={() => setActiveTab("b")}
            />
          </TabsContent>

          <TabsContent value="b" className="mt-4">
            <ApendiceB insp={insp} persist={persist} />
            <div className="mt-6 flex justify-end">
              <Button 
                size="lg" 
                onClick={finalizar} 
                className="gap-2"
              >
                Finalizar e ver resultado <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </AppShell>
    );
  } catch (renderError) {
    console.error("Erro crítico de renderização no ChecklistPage:", renderError);
    return (
      <AppShell>
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-destructive">Erro ao carregar o checklist</h2>
          <p className="mt-2 text-muted-foreground">Ocorreu um erro interno ao renderizar os dados.</p>
          <Button onClick={() => window.location.reload()} className="mt-4">Recarregar página</Button>
        </div>
      </AppShell>
    );
  }
}



function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>{children}</div>;
}

function ApendiceA({ insp, persist, totalItems, onComplete }: { insp: Inspecao; persist: (u: (i: Inspecao) => Inspecao) => void, totalItems: number, onComplete: () => void }) {
  const respondidosCount = Object.values(insp.respostas || {}).filter((r) => r !== null && r !== undefined).length;

  const setResposta = (id: string, r: Resposta) => {
    persist((i) => ({ ...i, respostas: { ...(i.respostas || {}), [id]: r } }));
  };

  const addFoto = (id: string, base64: string) => {
    persist((i) => {
      const currentFotos = i.dados?.fotos?.[id] || [];
      return { ...i, dados: { ...i.dados, fotos: { ...(i.dados?.fotos || {}), [id]: [...currentFotos, base64] } } };
    });
  };

  const removeFoto = (id: string, index: number) => {
    persist((i) => {
      const currentFotos = i.dados.fotos?.[id] || [];
      return {
        ...i,
        dados: { ...i.dados, fotos: { ...(i.dados?.fotos || {}), [id]: currentFotos.filter((_, k) => k !== index) } },
      };
    });
  };

  try {
    return (
      <>
        <Accordion type="single" collapsible defaultValue={checklistSections[0].id} className="space-y-3">
          {checklistSections.map((sec) => {
            const total = sec.items.length;
            const done = sec.items.filter((it) => insp.respostas?.[it.id] != null).length;
            return (
              <AccordionItem key={sec.id} value={sec.id} className="overflow-hidden rounded-lg border bg-card">
                <AccordionTrigger className="bg-primary px-4 py-3 text-left text-primary-foreground hover:no-underline">
                  <div className="flex w-full items-center justify-between gap-2 pr-2">
                    <span className="text-sm font-bold uppercase tracking-wide">{sec.title}</span>
                    <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[11px] font-medium">
                      {done}/{total}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  <ul className="divide-y">
                    {sec.items.map((item) => (
                      <li key={item.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 text-sm">
                          <span className="mr-2 font-mono text-xs font-semibold text-primary">{item.id}.</span>
                          {item.text}
                        </div>
                        <div className="flex gap-1.5">
                          {(["S", "N", "NA"] as const).map((opt) => {
                            const active = (insp.respostas?.[item.id] || null) === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setResposta(item.id, opt)}
                                className={cn(
                                  "h-9 min-w-[44px] rounded-md border px-3 text-xs font-semibold transition-colors",
                                  active && opt === "S" && "border-success bg-success text-success-foreground",
                                  active && opt === "N" && "border-destructive bg-destructive text-destructive-foreground",
                                  active && opt === "NA" && "border-muted-foreground bg-muted-foreground text-background",
                                  !active && "bg-background text-muted-foreground hover:bg-accent",
                                )}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t bg-muted/20 p-4">
                    <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Evidências Fotográficas do Tópico
                    </Label>
                    <div className="flex flex-wrap gap-3">
                      {insp.dados?.fotos?.[sec.id]?.map((foto: string, idx: number) => (
                        <div key={idx} className="group relative h-24 w-24 overflow-hidden rounded-lg border bg-background shadow-sm">
                          <img src={foto} className="h-full w-full object-cover" alt={`Foto ${idx + 1}`} />
                          <button
                            onClick={() => removeFoto(sec.id, idx)}
                            className="absolute right-0 top-0 rounded-bl-lg bg-destructive/90 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            title="Remover foto"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary">
                        <Camera className="h-7 w-7" />
                        <span className="mt-1.5 text-[11px] font-medium">Anexar Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const base64 = ev.target?.result as string;
                                addFoto(sec.id, base64);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
        })}
      </Accordion>
      <div className="mt-8 flex justify-end">
        <Button 
          onClick={() => {
            if (respondidosCount < totalItems) {
               toast.error(`Ainda faltam itens no Apêndice A (${respondidosCount}/${totalItems})`);
               return;
            }
            onComplete();
          }}
          className="gap-2"
          variant={respondidosCount < totalItems ? "outline" : "default"}
        >
          Próximo: Apêndice B <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
  } catch (err) {
    console.error("Erro na renderização do Apêndice A:", err);
    return <div className="p-4 border rounded bg-destructive/10 text-destructive text-sm font-medium">Erro ao carregar lista de verificação (Apêndice A).</div>;
  }
}

const PERG_FUNCIONARIO = [
  { k: "q12", t: "Tem alguma noção sobre análise de alimentos?" },
  { k: "q13", t: "Por que os alimentos estragam?" },
  { k: "q14", t: "Quais alimentos estragam mais rapidamente?" },
  { k: "q15", t: "O que você considera falta de higiene?" },
  { k: "q16", t: "Quais as consequências da falta de higiene?" },
  { k: "q17", t: "Há alimentos que podem ser perigosos? Quais?" },
  { k: "q18", t: "O que você conhece sobre bactérias?" },
  { k: "q19", t: "Qual uniforme você recebeu?" },
  { k: "q20", t: "Recebeu orientação sobre higiene pessoal?" },
  { k: "q21", t: "Recebeu material sobre Boas Práticas?" },
  { k: "q22", t: "Realiza atividades além da manipulação?" },
  { k: "q23", t: "Tem dúvidas no trabalho? Quais?" },
];

const UNIFORME_ITENS = ["Touca", "Boné", "Jaleco", "Calçado", "Camisa", "Calça", "Máscara", "Luvas"];

function ApendiceB({ insp, persist }: { insp: Inspecao; persist: (u: (i: Inspecao) => Inspecao) => void }) {
  const q = insp.dados?.questionario;
  if (!q) return null;
  const setQ = <K extends keyof typeof q>(k: K, v: (typeof q)[K]) => {
    persist((i) => ({ ...i, dados: { ...i.dados, questionario: { ...(i.dados?.questionario || {}), [k]: v } } }));
  };
  const toggleUniforme = (item: string) => {
    const has = q.uniformeItens.includes(item);
    setQ("uniformeItens", has ? q.uniformeItens.filter((x: string) => x !== item) : [...q.uniformeItens, item]);
  };

  const addFunc = () => persist((i) => ({ ...i, dados: { ...i.dados, funcionarios: [...(i.dados?.funcionarios || []), emptyFuncionario()] } }));
  const updateFunc = (idx: number, patch: Partial<Funcionario>) =>
    persist((i) => ({
      ...i,
      dados: { ...i.dados, funcionarios: (i.dados?.funcionarios || []).map((f: Funcionario, k: number) => (k === idx ? { ...f, ...patch } : f)) }
    }));
  const removeFunc = (idx: number) =>
    persist((i) => ({ ...i, dados: { ...i.dados, funcionarios: (i.dados?.funcionarios || []).filter((_: any, k: number) => k !== idx) } }));

  try {
    return (
      <div className="space-y-4">
        <Card className="p-4">
            <h2 className="text-base font-bold mb-4">Dados do Responsável / Estabelecimento</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField label="1. Receptividade" value={q.receptividade} onChange={(v) => setQ("receptividade", v)} options={["Elevada", "Média", "Baixa"]} />
              <SelectField label="2. Número de trabalhadores" value={q.numTrabalhadores} onChange={(v) => setQ("numTrabalhadores", v)} options={["1-5", "6-10", "11-20", "21-50", "Mais de 50"]} />
              <TextField label="3. Refeições oferecidas por período" value={q.refeicoesPeriodo} onChange={(v) => setQ("refeicoesPeriodo", v)} />
              <TextField label="4. Alimentos predominantes no cardápio" value={q.alimentosCardapio} onChange={(v) => setQ("alimentosCardapio", v)} className="sm:col-span-2" />
              <SelectField label="5. Instruções aos funcionários" value={q.instrucoesFuncionarios} onChange={(v) => setQ("instrucoesFuncionarios", v)} options={["Sim", "Não"]} />
              <TextField label="5.1 Qual?" value={q.instrucoesQual} onChange={(v) => setQ("instrucoesQual", v)} />
              <SelectField label="6. Cursos e treinamentos (frequência)" value={q.cursosTreinamentos} onChange={(v) => setQ("cursosTreinamentos", v)} options={["Nunca", "Anual", "Semestral", "Trimestral", "Mensal"]} />
              <SelectField label="7. Avaliação pós-treinamento" value={q.avaliacaoPos} onChange={(v) => setQ("avaliacaoPos", v)} options={["Sim", "Não"]} />
              <SelectField label="8. Fornecimento de uniforme (frequência)" value={q.fornecimentoUniformeFreq} onChange={(v) => setQ("fornecimentoUniformeFreq", v)} options={["Nunca", "Anual", "Semestral", "Trimestral", "Mensal"]} />
              <div className="sm:col-span-2">
                <Label className="mb-2 block text-xs font-medium text-muted-foreground">8.1 Itens fornecidos</Label>
                <div className="flex flex-wrap gap-3">
                  {UNIFORME_ITENS.map((it) => (
                    <label key={it} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={q.uniformeItens.includes(it)} onCheckedChange={() => toggleUniforme(it)} />
                      {it}
                    </label>
                  ))}
                </div>
              </div>
              <SelectField label="9. Remuneração por comissão" value={q.comissao} onChange={(v) => setQ("comissao", v)} options={["Sim", "Não"]} />
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">10. Alterações desejadas no estabelecimento</Label>
                <Textarea rows={3} value={q.alteracoesDesejadas} onChange={(e) => setQ("alteracoesDesejadas", e.target.value)} />
              </div>
            </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">Dados dos Funcionários</h2>
            <Button size="sm" variant="secondary" onClick={addFunc} className="gap-1">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
          <div className="space-y-3">
            {insp.dados?.funcionarios?.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
            )}
            <Accordion type="multiple" className="space-y-2">
              {insp.dados?.funcionarios?.map((f: Funcionario, idx: number) => (
                <AccordionItem key={idx} value={`f-${idx}`} className="rounded-lg border bg-background">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <span className="text-sm font-medium">
                      {f.nome || `Funcionário ${idx + 1}`}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 px-4 pb-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <TextField label="Nome" value={f.nome} onChange={(v) => updateFunc(idx, { nome: v })} />
                      <TextField label="Idade" value={f.idade} onChange={(v) => updateFunc(idx, { idade: v })} />
                      <SelectField
                        label="Escolaridade"
                        value={f.escolaridade}
                        onChange={(v) => updateFunc(idx, { escolaridade: v })}
                        options={[
                          "A - Analfabeto",
                          "B - Fundamental incompleto",
                          "C - Fundamental completo",
                          "D - Médio incompleto",
                          "E - Médio completo",
                          "F - Superior",
                        ]}
                      />
                      <SelectField label="Carteira assinada" value={f.carteiraAssinada} onChange={(v) => updateFunc(idx, { carteiraAssinada: v })} options={["Sim", "Não"]} />
                      <SelectField label="Curso de Boas Práticas (BMP)" value={f.cursoBMP} onChange={(v) => updateFunc(idx, { cursoBMP: v })} options={["Sim", "Não"]} />
                      <div className="space-y-3 border-t pt-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Questionário (12–26)
                        </div>
                        {PERG_FUNCIONARIO.map((p) => (
                          <div key={p.k}>
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{p.t}</Label>
                            <Textarea
                              rows={2}
                              value={f.respostas?.[p.k] || ""}
                              onChange={(e) => {
                                const newRespostas = { ...(f.respostas || {}), [p.k]: e.target.value };
                                updateFunc(idx, { respostas: newRespostas });
                              }}
                              className="text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button variant="ghost" size="sm" onClick={() => removeFunc(idx)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4 mr-2" /> Remover Funcionário
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Card>
      </div>
    );
  } catch (err) {
    console.error("Erro na renderização do Apêndice B:", err);
    return <div className="p-4 border rounded bg-destructive/10 text-destructive text-sm font-medium">Erro ao carregar questionário (Apêndice B).</div>;
  }
}

function TextField({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: string[]; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">Selecione...</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
