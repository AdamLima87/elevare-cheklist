import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/elevare/Logo";
import { Loader2, Building2, Users, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "Bem-vindo · RDCheck" }],
  }),
  component: () => (
    <ProtectedRoute>
      <OnboardingPage />
    </ProtectedRoute>
  ),
});

// Wizard simplificado: um passo obrigatório (dados da consultoria — os
// mesmos de Configurações) seguido de um resumo com atalhos para as telas
// que já cobrem o resto do backlog original (cadastrar o primeiro cliente,
// convidar a equipe) em vez de duplicar esses formulários aqui dentro.
function OnboardingPage() {
  const navigate = useNavigate();
  const { data: profile } = useCurrentProfile();
  const [step, setStep] = useState<"dados" | "resumo">("dados");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [telefone, setTelefone] = useState("");

  useEffect(() => {
    if (!profile?.empresa_id) return;
    supabase
      .from("empresas")
      .select("nome")
      .eq("id", profile.empresa_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nome) setNomeEmpresa(data.nome);
      });
  }, [profile?.empresa_id]);

  const handleSaveDados = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("configuracoes")
        .select("id")
        .eq("empresa_id", profile.empresa_id)
        .maybeSingle();

      const payload = { nome_empresa: nomeEmpresa, email_contato: emailContato, telefone };
      const { error } = existing
        ? await supabase.from("configuracoes").update(payload).eq("id", existing.id)
        : await supabase.from("configuracoes").insert({ ...payload, empresa_id: profile.empresa_id });
      if (error) throw error;
      setStep("resumo");
    } catch (err) {
      console.error("Erro ao salvar dados da consultoria:", err);
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!profile?.empresa_id) return;
    setLoading(true);
    try {
      // empresas não tem policy de UPDATE para o cliente (de propósito —
      // evita abrir escrita direta em colunas sensíveis como plano/status).
      // Uma RPC SECURITY DEFINER estreita faz só este UPDATE específico.
      const { error } = await supabase.rpc("complete_onboarding" as any);
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error("Erro ao concluir onboarding:", err);
      toast.error("Não foi possível concluir. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.32_0.07_155_/_0.08),transparent_60%)]" />
      <Card className="w-full max-w-lg shadow-lg border-slate-200 overflow-hidden">
        <CardHeader className="space-y-4 flex flex-col items-center pb-6">
          <div className="mb-2">
            <Logo />
          </div>
          <div className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold text-slate-800">
              {step === "dados" ? "Bem-vindo ao RDCheck" : "Tudo pronto!"}
            </CardTitle>
            <CardDescription className="text-slate-500">
              {step === "dados"
                ? "Confirme os dados da sua consultoria para personalizar seus relatórios."
                : "Sua conta está pronta. Você pode ajustar isso a qualquer momento em Configurações."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {step === "dados" ? (
            <form onSubmit={handleSaveDados} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nomeEmpresa">Nome da consultoria</Label>
                <Input id="nomeEmpresa" required value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailContato">E-mail de contato</Label>
                <Input id="emailContato" type="email" value={emailContato} onChange={(e) => setEmailContato(e.target.value)} placeholder="contato@suaempresa.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
              <Button type="submit" disabled={saving} className="w-full bg-[#184878] hover:bg-[#184878]/90 text-white font-semibold py-6 h-auto">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
                <Building2 className="h-5 w-5 text-[#184878] shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-slate-800">Cadastre seu primeiro cliente</p>
                  <p className="text-slate-500">Você pode fazer isso a qualquer momento em "Clientes".</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
                <Users className="h-5 w-5 text-[#184878] shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-slate-800">Convide sua equipe</p>
                  <p className="text-slate-500">Disponível em "Usuários" quando quiser adicionar consultores.</p>
                </div>
              </div>
              <Button onClick={handleFinish} disabled={loading} className="w-full bg-[#184878] hover:bg-[#184878]/90 text-white font-semibold py-6 h-auto gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Ir para o painel</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
