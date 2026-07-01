import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/elevare/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calcularPercentual,
  classificacao,
  clearRascunho,
  loadRascunho,
  saveToHistorico,
  type Inspecao,
} from "@/lib/storage";
import { checklistSections } from "@/lib/checklist-data";
import { FileDown, MessageCircle, Mail, Save, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { gerarPDF } from "@/lib/pdf";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/resultado")({
  head: () => ({
    meta: [{ title: "Resultado · Elevare" }, { name: "description", content: "Resultado da inspeção sanitária com pontuação, gráfico e não conformidades." }],
  }),
  component: ResultadoPage,
});

function ResultadoPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/resultado" }) as { id?: string; readonly?: boolean };
  const [insp, setInsp] = useState<Inspecao | null>(null);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    async function loadData() {
      if (search.readonly && search.id) {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from("inspecoes")
            .select("*")
            .eq("id", search.id)
            .single();

          if (error) throw error;
          
          if (data) {
            const mapped: Inspecao = {
              id: data.id,
              numero_sequencial: data.numero_sequencial,
              status: data.status as any,
              estabelecimento: data.estabelecimento_nome || "",
              dataInicio: data.data_inicio,
              dataConclusao: data.data_conclusao,
              progresso: data.progresso,
              conformidade: data.conformidade ? Number(data.conformidade) : null,
              dados: data.dados as any,
              respostas: data.respostas as any,
            };
            setInsp(mapped);
          }
        } catch (err) {
          toast.error("Erro ao carregar inspeção");
        } finally {
          setLoading(false);
        }
        return;
      }

      const r = loadRascunho();
      if (!r || !r.dados.estabelecimento.razaoSocial) {
        navigate({ to: "/nova-inspecao" });
        return;
      }
      
      // The "concluida" status will only be set when the user clicks "Salvar"
      const score = calcularPercentual(r.respostas);
      const finalInsp: Inspecao = { 
        ...r, 
        status: r.status, 
        conformidade: score.percentual,
        dataConclusao: r.dataConclusao || new Date().toISOString()
      };
      
      setInsp(finalInsp);
    }
    
    loadData();
  }, [navigate, search.id, search.readonly]);


  const score = useMemo(() => (insp ? calcularPercentual(insp.respostas) : null), [insp]);
  const cls = score ? classificacao(score.percentual) : null;

  const chartData = useMemo(() => {
    if (!insp) return [];
    return checklistSections.map((sec) => {
      const itens = sec.items.map((i) => insp.respostas[i.id]);
      const itensAplicaveis = itens.filter((r) => r === "S" || r === "N");
      const totalAplicaveis = itensAplicaveis.length;
      const s = itensAplicaveis.filter((r) => r === "S").length;
      const pct = totalAplicaveis === 0 ? 0 : Math.round((s / totalAplicaveis) * 100);
      return { secao: sec.title.split(",")[0].slice(0, 18), pct };
    });
  }, [insp]);

  const naoConformidades = useMemo(() => {
    if (!insp) return [];
    const out: { id: string; text: string; secao: string }[] = [];
    checklistSections.forEach((sec) => {
      sec.items.forEach((it) => {
        if (insp.respostas[it.id] === "N") out.push({ id: it.id, text: it.text, secao: sec.title });
      });
    });
    return out;
  }, [insp]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!insp || !score || !cls) return null;


  const finalInsp = insp;

  const salvar = async () => {
    setLoading(true);
    try {
      const updatedInsp: Inspecao = {
        ...finalInsp,
        status: "concluida"
      };
      
      await saveToHistorico(updatedInsp);
      setInsp(updatedInsp);
      
      // Enviar e-mail automático e garantir acesso do cliente
      const email = updatedInsp.dados?.estabelecimento?.respLegalEmail || updatedInsp.dados?.estabelecimento?.email;
      const cnpj = updatedInsp.dados?.estabelecimento?.cnpj?.replace(/\D/g, "") || "";
      const nomeLegal = updatedInsp.dados?.estabelecimento?.respLegalNome || updatedInsp.estabelecimento;
      
      console.log("Iniciando processos pós-conclusão para:", email);

      if (email && cnpj) {
        try {
          // 1. Garantir que o cliente tem um usuário no sistema
          const clientResponse = await supabase.functions.invoke("admin-manage-users", {
            body: {
              action: "create_client",
              userData: {
                email,
                password: cnpj,
                nome: nomeLegal,
                perfil: "cliente",
                cnpj
              }
            }
          });

          if (clientResponse.error) {
            console.error("Erro ao criar/atualizar cliente:", clientResponse.error);
          } else {
            console.log("Acesso do cliente garantido");
          }

          // 2. Enviar e-mail
          const response = await fetch('/lovable/email/transactional/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              templateName: "inspection",
              recipientEmail: email,
              templateData: {
                email_cliente: email,
                nome_estabelecimento: updatedInsp.estabelecimento,
                cnpj: cnpj,
                data_inspecao: updatedInsp.dataInicio,
                conformidade: updatedInsp.conformidade,
                classificacaoLabel: cls.label,
                classificacaoTone: cls.tone,
                link_resultado: `${window.location.origin}/meu-resultado`
              }
            })
          });
          
          if (!response.ok) throw new Error('Falha ao enviar e-mail');
          toast.success(`Relatório enviado por e-mail para ${email}`);
        } catch (emailErr) {
          console.error("Erro nos processos pós-conclusão:", emailErr);
          toast.error("Não foi possível processar todos os envios automáticos.");
        }
      }
      
      
    } catch (err) {
      console.error("Erro ao salvar:", err);
      toast.error("Erro ao salvar inspeção.");
    } finally {
      setLoading(false);
    }
  };

  const novaInspecao = () => {
    clearRascunho();
    navigate({ to: "/nova-inspecao" });
  };

  const compartilharWhats = () => {
    const msg = `*Checklist Elevare*%0A${insp.estabelecimento}%0APontuação: ${score.percentual.toFixed(2)}%25 - ${cls.label}%0ANão conformidades: ${naoConformidades.length}`;
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const enviarEmail = () => {
    const subject = encodeURIComponent(`Inspeção sanitária — ${insp.estabelecimento}`);
    const body = encodeURIComponent(
      `Estabelecimento: ${insp.dados.estabelecimento.razaoSocial}\nPontuação: ${score.percentual.toFixed(2)}% — ${cls.label}\nNão conformidades: ${naoConformidades.length}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const baixarPDF = () => {
    try {
      gerarPDF(finalInsp);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PDF.");
    }
  };

  return (
    <AppShell>
      <Toaster richColors position="top-center" />
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Resultado da Inspeção</div>
        <h1 className="text-2xl font-semibold">{insp.estabelecimento}</h1>
        <p className="text-sm text-muted-foreground">{insp.dados.estabelecimento.razaoSocial}</p>
      </div>

      <Card className={cn("border-2", cls.tone === "success" && "border-success/40", cls.tone === "warning" && "border-warning/50", cls.tone === "destructive" && "border-destructive/40")}>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Pontuação geral</div>
              <div className="mt-1 text-5xl font-bold tracking-tight">{score.percentual.toFixed(2)}%</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {score.sim} conformes · {score.nao} não conformes · {score.na} não se aplica
              </div>
            </div>
            <div
              className={cn(
                "rounded-xl px-6 py-4 text-center",
                cls.tone === "success" && "bg-success text-success-foreground",
                cls.tone === "warning" && "bg-warning text-warning-foreground",
                cls.tone === "destructive" && "bg-destructive text-destructive-foreground",
              )}
            >
              <div className="text-3xl">{cls.emoji}</div>
              <div className="mt-1 text-lg font-bold">{cls.label}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!search.readonly && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button onClick={baixarPDF} className="gap-1.5"><FileDown className="h-4 w-4" /> PDF</Button>
          <Button onClick={compartilharWhats} variant="secondary" className="gap-1.5"><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
          <Button onClick={enviarEmail} variant="secondary" className="gap-1.5"><Mail className="h-4 w-4" /> E-mail</Button>
          <Button onClick={salvar} variant="outline" className="gap-1.5"><Save className="h-4 w-4" /> Salvar</Button>
        </div>
      )}
      
      {search.readonly && (
        <div className="mt-4 flex gap-2">
          <Button onClick={baixarPDF} className="gap-1.5"><FileDown className="h-4 w-4" /> Baixar PDF</Button>
        </div>
      )}


      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Desempenho por seção</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="secao" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Bar dataKey="pct" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Não conformidades ({naoConformidades.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {naoConformidades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma não conformidade identificada.</p>
          ) : (
            <ul className="space-y-2">
              {naoConformidades.map((nc) => (
                <li key={nc.id} className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-destructive">{nc.secao}</div>
                  <div className="mt-1"><span className="font-mono text-xs">{nc.id}.</span> {nc.text}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!search.readonly && (
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/checklist" })}>Voltar ao checklist</Button>
          <Button onClick={novaInspecao} className="gap-1.5"><RotateCcw className="h-4 w-4" /> Nova inspeção</Button>
        </div>
      )}

    </AppShell>
  );
}
