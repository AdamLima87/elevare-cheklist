import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/nova-inspecao")({ component: NovaInspecaoPage });

function NovaInspecaoPage() {
  const navigate = useNavigate();
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ cnpj: "", razaoSocial: "", nomeFantasia: "", atividade: "", endereco: "", bairro: "", email: "", dataHora: new Date().toISOString().slice(0,16), respLegalNome: "", respLegalEmail: "", respTecNome: "", respTecConselho: "", respTecRegistro: "" });

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const formatCNPJ = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  };

  const handleCnpjBlur = async () => {
    const digits = form.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setLoadingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm(f => ({ ...f, razaoSocial: data.razao_social || f.razaoSocial, nomeFantasia: data.nome_fantasia || data.razao_social || f.nomeFantasia, atividade: data.cnae_fiscal_descricao || f.atividade, endereco: [data.logradouro, data.numero].filter(Boolean).join(", ") || f.endereco, bairro: data.bairro || f.bairro }));
      toast.success("Dados carregados automaticamente!");
    } catch { toast.error("CNPJ não encontrado. Preencha manualmente."); }
    finally { setLoadingCnpj(false); }
  };

  const handleIniciar = async () => {
    if (!form.razaoSocial || !form.nomeFantasia || !form.cnpj || !form.respLegalNome) { toast.error("Preencha os campos obrigatórios."); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const { data: num } = await supabase.from("numeracao_inspecoes").select("*").eq("id", 1).single();
      const proximo = (num?.numeros_disponiveis?.length > 0) ? num.numeros_disponiveis[0] : (num?.ultimo_numero || 0) + 1;
      const novosDisponiveis = num?.numeros_disponiveis?.length > 0 ? num.numeros_disponiveis.slice(1) : [];
      await supabase.from("numeracao_inspecoes").update({ ultimo_numero: Math.max(proximo, num?.ultimo_numero || 0), numeros_disponiveis: novosDisponiveis }).eq("id", 1);
      const { data: insp, error } = await supabase.from("inspecoes").insert({ numero_sequencial: proximo, consultor_id: session.user.id, estabelecimento_nome: form.nomeFantasia || form.razaoSocial, cnpj: form.cnpj.replace(/\D/g, ""), status: "em_andamento", progresso: 0, dados: { estabelecimento: form }, respostas: {} }).select().single();
      if (error) throw error;
      localStorage.setItem("elevare_inspecao_ativa", JSON.stringify(insp));
      navigate({ to: "/checklist" });
    } catch (e: any) { toast.error(e.message || "Erro ao iniciar."); }
    finally { setLoading(false); }
  };

  const Field = ({ label, k, type = "text", placeholder = "" }: { label: string; k: string; type?: string; placeholder?: string }) => (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      <Input type={type} value={(form as any)[k]} onChange={e => update(k, k === "cnpj" ? formatCNPJ(e.target.value) : e.target.value)} onBlur={k === "cnpj" ? handleCnpjBlur : undefined} placeholder={placeholder} />
      {k === "cnpj" && loadingCnpj && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
    </div>
  );

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <h1 className="text-2xl font-semibold mb-6">Nova Inspeção</h1>
        <div className="space-y-4 max-w-3xl">
          <Card><CardHeader><CardTitle className="text-base">Dados do Estabelecimento</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="CNPJ *" k="cnpj" placeholder="00.000.000/0000-00" />
              <Field label="Razão Social *" k="razaoSocial" />
              <Field label="Nome Fantasia *" k="nomeFantasia" />
              <Field label="Atividade" k="atividade" />
              <Field label="Endereço" k="endereco" />
              <Field label="Bairro" k="bairro" />
              <Field label="E-mail do estabelecimento" k="email" type="email" />
              <Field label="Data e hora da inspeção *" k="dataHora" type="datetime-local" />
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="text-base">Responsável Legal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome *" k="respLegalNome" />
              <Field label="E-mail" k="respLegalEmail" type="email" />
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="text-base">Responsável Técnico</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome" k="respTecNome" />
              <Field label="Conselho" k="respTecConselho" />
              <Field label="Nº de Registro" k="respTecRegistro" />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleIniciar} disabled={loading} className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowRight className="h-4 w-4" />Iniciar Checklist</>}
            </Button>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
