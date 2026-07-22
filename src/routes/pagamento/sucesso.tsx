import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthenticatedRoute } from "@/components/auth/AuthenticatedRoute";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/elevare/Logo";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/pagamento/sucesso")({
  head: () => ({ meta: [{ title: "Confirmando pagamento · RDCheck" }] }),
  component: () => (
    <AuthenticatedRoute>
      <PagamentoSucessoPage />
    </AuthenticatedRoute>
  ),
});

const POLL_INTERVAL_MS = 4000;
const MAX_TENTATIVAS = 20; // ~80s antes de sugerir suporte

function PagamentoSucessoPage() {
  const navigate = useNavigate();
  const [tentativas, setTentativas] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      // O retorno de sucesso do checkout NUNCA é prova de pagamento — só
      // o webhook confirma. Aqui só checamos se o provisionamento (que só
      // acontece depois do webhook) já aconteceu: profile existe = tenant
      // pago já foi criado.
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, empresa_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelado) return;

      if (profile) {
        navigate({ to: "/onboarding" });
        return;
      }

      setTentativas((t) => t + 1);
      timerRef.current = setTimeout(verificar, POLL_INTERVAL_MS);
    }

    verificar();
    return () => {
      cancelado = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const demorando = tentativas >= MAX_TENTATIVAS;

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.32_0.07_155_/_0.08),transparent_60%)]" />
      <Card className="w-full max-w-lg shadow-lg border-slate-200 overflow-hidden">
        <CardHeader className="space-y-4 flex flex-col items-center pb-6">
          <div className="mb-2">
            <Logo />
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#184878]/10">
            <Loader2 className="h-8 w-8 text-[#184878] animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold text-slate-800">Estamos confirmando seu pagamento</CardTitle>
            <CardDescription className="text-slate-500">
              Isso costuma levar só alguns segundos. Não feche esta página.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {demorando && (
            <p className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              Isso está demorando mais que o normal. Se o pagamento foi concluído e esta tela não avançar, fale com
              o suporte informando seu e-mail de cadastro.
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
