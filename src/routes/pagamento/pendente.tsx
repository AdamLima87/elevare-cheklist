import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthenticatedRoute } from "@/components/auth/AuthenticatedRoute";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/elevare/Logo";
import { toast } from "sonner";
import { Loader2, Clock } from "lucide-react";

export const Route = createFileRoute("/pagamento/pendente")({
  head: () => ({ meta: [{ title: "Contratação pendente · RDCheck" }] }),
  component: () => (
    <AuthenticatedRoute>
      <PagamentoPendentePage />
    </AuthenticatedRoute>
  ),
});

interface IntencaoAberta {
  id: string;
  periodicidade: "mensal" | "anual";
  status: string;
}

const PERIODICIDADE_LABEL: Record<string, string> = {
  mensal: "Plano Mensal — R$ 120/mês",
  anual: "Plano Anual — R$ 1.250 (à vista ou em até 10x)",
};

function PagamentoPendentePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [intencao, setIntencao] = useState<IntencaoAberta | null>(null);

  useEffect(() => {
    async function loadIntencao() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      const { data } = await supabase
        .from("saas_checkout_intencoes")
        .select("id, periodicidade, status")
        .eq("auth_user_id", session.user.id)
        .in("status", ["pendente", "aguardando_pagamento"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setIntencao(data as IntencaoAberta | null);
      setLoading(false);
    }
    loadIntencao();
  }, [navigate]);

  const handleIrParaPagamento = async () => {
    setRedirecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-checkout", { body: {} });
      if (error || !data?.checkoutUrl) {
        throw error || new Error("Sem URL de checkout");
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("Erro ao criar checkout:", err);
      toast.error("Não foi possível iniciar o pagamento. Tente novamente.");
      setRedirecting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.32_0.07_155_/_0.08),transparent_60%)]" />
      <Card className="w-full max-w-lg shadow-lg border-slate-200 overflow-hidden">
        <CardHeader className="space-y-4 flex flex-col items-center pb-6">
          <div className="mb-2">
            <Logo />
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#184878]/10">
            <Clock className="h-8 w-8 text-[#184878]" />
          </div>
          <div className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold text-slate-800">Confirmamos seu e-mail</CardTitle>
            <CardDescription className="text-slate-500">
              Falta só o pagamento para liberar sua conta.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#184878]" />
            </div>
          ) : intencao ? (
            <>
              <p className="text-center text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-3">
                {PERIODICIDADE_LABEL[intencao.periodicidade] ?? "Plano selecionado"}
              </p>
              <Button
                onClick={handleIrParaPagamento}
                disabled={redirecting}
                className="w-full bg-[#184878] hover:bg-[#184878]/90 text-white font-semibold py-6 h-auto"
              >
                {redirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ir para o pagamento"}
              </Button>
              <p className="text-center text-xs text-slate-400">
                Você será redirecionado para o ambiente seguro de pagamento do Asaas.
              </p>
            </>
          ) : (
            <p className="text-center text-sm text-slate-500">
              Não encontramos uma contratação pendente para esta conta. Se você já pagou, aguarde alguns instantes
              e atualize a página.
            </p>
          )}

          <Button onClick={handleLogout} variant="outline" className="w-full">
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
