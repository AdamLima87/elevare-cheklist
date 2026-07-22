import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthenticatedRoute } from "@/components/auth/AuthenticatedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAccessStatus } from "@/hooks/useTenantAccessStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/elevare/Logo";
import { Loader2, Lock, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/plano-bloqueado")({
  head: () => ({ meta: [{ title: "Plano e Cobrança · RDCheck" }] }),
  component: () => (
    <AuthenticatedRoute>
      <PlanoBloqueadoPage />
    </AuthenticatedRoute>
  ),
});

interface FaturaAberta {
  invoice_url: string | null;
}

function PlanoBloqueadoPage() {
  const navigate = useNavigate();
  const { data: status, isLoading } = useTenantAccessStatus();
  const [fatura, setFatura] = useState<FaturaAberta | null>(null);
  const [iniciandoCheckout, setIniciandoCheckout] = useState<"mensal" | "anual" | null>(null);

  useEffect(() => {
    async function loadFatura() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("id", session.user.id).maybeSingle();
      if (!profile?.empresa_id) return;
      const { data } = await supabase
        .from("saas_pagamentos")
        .select("invoice_url")
        .eq("empresa_id", profile.empresa_id)
        .in("status", ["pendente", "atrasado"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setFatura(data as FaturaAberta | null);
    }
    loadFatura();
  }, []);

  const handleAssinar = async (periodicidade: "mensal" | "anual") => {
    setIniciandoCheckout(periodicidade);
    try {
      const { data, error } = await supabase.functions.invoke("criar-checkout", { body: { periodicidade } });
      if (error || !data?.checkoutUrl) throw error || new Error("Sem URL de checkout");
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      toast.error(err.message || "Não foi possível iniciar o pagamento. Tente novamente.");
      setIniciandoCheckout(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const trialExpirado = status?.status === "trial_expired";

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.32_0.07_155_/_0.08),transparent_60%)]" />
      <Card className="w-full max-w-lg shadow-lg border-slate-200 overflow-hidden">
        <CardHeader className="space-y-4 flex flex-col items-center pb-6">
          <div className="mb-2">
            <Logo />
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <Lock className="h-8 w-8 text-red-500" />
          </div>
          <div className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold text-slate-800">
              {trialExpirado ? "Sua demonstração acabou" : "Acesso bloqueado por atraso no pagamento"}
            </CardTitle>
            <CardDescription className="text-slate-500">
              {trialExpirado
                ? "Escolha um plano para continuar usando o RDCheck."
                : "Regularize o pagamento para liberar o acesso ao sistema imediatamente."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#184878]" />
            </div>
          ) : trialExpirado ? (
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => handleAssinar("mensal")}
                disabled={iniciandoCheckout !== null}
                className="w-full bg-[#184878] hover:bg-[#184878]/90 text-white font-semibold py-6 h-auto"
              >
                {iniciandoCheckout === "mensal" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar mensal — R$ 120/mês"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAssinar("anual")}
                disabled={iniciandoCheckout !== null}
                className="w-full"
              >
                {iniciandoCheckout === "anual" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar anual — R$ 1.250 (à vista ou até 10x)"}
              </Button>
            </div>
          ) : fatura?.invoice_url ? (
            <Button asChild className="w-full bg-[#184878] hover:bg-[#184878]/90 text-white font-semibold py-6 h-auto gap-2">
              <a href={fatura.invoice_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Ver e pagar fatura
              </a>
            </Button>
          ) : (
            <p className="text-center text-sm text-slate-500">
              Não encontramos uma fatura em aberto. Se você já pagou, aguarde alguns instantes e atualize a página.
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
