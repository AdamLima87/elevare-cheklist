import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowRight, ClipboardCheck } from "lucide-react";
import {
  emptyEstabelecimento,
  emptyQuestionario,
  createNewInspecao,
  saveRascunho,
  loadRascunho,
  type Estabelecimento,
  type Inspecao,
} from "@/lib/storage";

export const Route = createFileRoute("/nova-inspecao")({
  validateSearch: (search: Record<string, unknown>) => ({ edit: Boolean(search.edit) }),
  head: () => ({
    meta: [{ title: "Nova Inspeção · Elevare" }, { name: "description", content: "Inicie um novo diagnóstico sanitário." }],
  }),
  component: NovaInspecaoWrapper,
});

function NovaInspecaoWrapper() {
  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <NovaInspecaoPage />
    </ProtectedRoute>
  );
}

function NovaInspecaoPage() {
  const navigate = useNavigate();
  const { edit } = Route.useSearch();
  const [estab, setEstab] = useState<Estabelecimento>(emptyEstabelecimento());
  const [rascunho, setRascunho] = useState<Inspecao | null>(null);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (edit) {
      const r = loadRascunho();
      if (r) {
        setRascunho(r);
        if (r.dados?.estabelecimento) setEstab(r.dados.estabelecimento);
      }
    } else {
      setEstab(emptyEstabelecimento());
      setRascunho(null);
    }
  }, [edit]);

  const formatCNPJ = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  };

  const update = (k: keyof Estabelecimento, v: string) => {
    setEstab(s => ({ ...s, [k]: k === "cnpj" ? formatCNPJ(v) : v }));
  };

  const handleCnpjBlur = async () => {
    const digits = estab.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setLoadingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEstab(s => ({
        ...s,
        razaoSocial: data.razao_social || s.razaoSocial,
        nomeFantasia: data.nome_fantasia || data.razao_social || s.nomeFantasia,
        atividade: data.cnae_fiscal_descricao || s.atividade,
        endereco: [data.logradouro, data.numero, data.complemento].filter(Boolean).join(", ") || s.endereco,
        bairro: data.bairro || s.bairro,
        cep: data.cep || s.cep,
        municipio: data.municipio || s.municipio,
        uf: data.uf || s.uf,
      }));
      toast.success("Dados do estabelecimento carregados!");
    } catch {
      toast.error("CNPJ não encontrado. Preencha os dados manualmente.");
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleIniciar = async () => {
    const required: (keyof Estabelecimento)[] = ["razaoSocial", "nomeFantasia", "cnpj", "respLegalNome", "dataHora"];
    const missing = required.filter(k => !estab[k]);
    if (missing.length) { toast.error("Preencha os campos obrigatórios (*)"); return; }
    if (!estab.respLegalEmail && !estab.email) {
      toast.warning("Adicione o e-mail do responsável para criar o acesso do cliente.");
    }
    setLoading(true);
    try {
      let insp: Inspecao;
      if (rascunho) {
        insp = { ...rascunho, estabelecimento: estab.nomeFantasia || estab.razaoSocial, dados: { ...rascunho.dados, estabelecimento: estab } };
      } else {
        insp = await createNewInspecao();
        insp.dados.estabelecimento = estab;
        insp.dados.questionario = emptyQuestionario();
        insp.estabelecimento = estab.nomeFantasia || estab.razaoSocial;
      }
      await saveRascunho(insp);
      const emailCliente = estab.respLegalEmail || estab.email;
      if (emailCliente && estab.cnpj) {
        const cleanCnpj = estab.cnpj.replace(/\D/g, "");
        supabase.functions.invoke("admin-manage-users", {
          body: { action: "create_client", userData: { email: emailCliente, password: cleanCnpj, nome: estab.nomeFantasia || estab.razaoSocial, perfil: "cliente", cnpj: cleanCnpj } }
        }).then(({ data }) => {
          if (data && !data.error) toast.info("Acesso do cliente garantido", { duration: 3000 });
        });
      }
      navigate({ to: "/checklist" });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar dados.");
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, k, type = "text", placeholder = "", className = "" }: { label: string; k: keyof Estabelecimento; type?: string; placeholder?: string; className?: string }) => (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs text-slate-500">{label}</Label>
      <div className="relative">
        <Input type={type} value={estab[k] as string} onChange={e => update(k, e.target.value)} onBlur={k === "cnpj" ? handleCnpjBlur : undefined} placeholder={placeholder} />
        {k === "cnpj" && loadingCnpj && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#1a4d2e]/10 px-3 py-1 text-xs font-medium text-[#1a4d2e]">
          <ClipboardCheck className="h-3.5 w-3.5" />
          Diagnóstico Sanitário
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Identificação do Estabelecimento</h1>
        <p className="mt-1 text-sm text-slate-500">Preencha os dados antes de iniciar o checklist higiênico-sanitário.</p>
      </div>

      <div className="space-y-4 max-w-3xl">
        <Card>
          <CardHeader><CardTitle className="text-base">Dados do Estabelecimento</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="CNPJ *" k="cnpj" placeholder="00.000.000/0000-00" />
            <Field label="Razão Social *" k="razaoSocial" />
            <Field label="Nome Fantasia *" k="nomeFantasia" />
            <Field label="Atividade" k="atividade" />
            <Field label="Endereço" k="endereco" className="sm:col-span-2" />
            <Field label="Bairro" k="bairro" />
            <Field label="Município / UF" k="municipio" />
            <Field label="E-mail do Estabelecimento *" k="email" type="email" placeholder="contato@exemplo.com" />
            <Field label="Data e Hora da Inspeção *" k="dataHora" type="datetime-local" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Responsável Legal</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome *" k="respLegalNome" />
            <Field label="CPF" k="respLegalCpf" placeholder="000.000.000-00" />
            <Field label="E-mail do Responsável" k="respLegalEmail" type="email" placeholder="responsavel@exemplo.com" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Responsável Técnico</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome" k="respTecNome" />
            <Field label="CPF" k="respTecCpf" />
            <Field label="Conselho Regional" k="respTecConselho" placeholder="Ex: CRN, CRMV..." />
            <Field label="Nº de Registro" k="respTecRegistro" />
          </CardContent>
        </Card>

        <div className="flex justify-end pb-6">
          <Button size="lg" onClick={handleIniciar} disabled={loading} className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{rascunho ? "Salvar e Continuar" : "Iniciar Checklist"} <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
