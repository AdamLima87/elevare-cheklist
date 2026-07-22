import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthenticatedRoute } from "@/components/auth/AuthenticatedRoute";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/elevare/Logo";
import { XCircle } from "lucide-react";

export const Route = createFileRoute("/pagamento/falhou")({
  head: () => ({ meta: [{ title: "Pagamento não concluído · RDCheck" }] }),
  component: () => (
    <AuthenticatedRoute>
      <PagamentoFalhouPage />
    </AuthenticatedRoute>
  ),
});

function PagamentoFalhouPage() {
  const navigate = useNavigate();

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
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold text-slate-800">O checkout expirou</CardTitle>
            <CardDescription className="text-slate-500">
              Não houve cobrança. Você pode gerar um novo link de pagamento a qualquer momento.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => navigate({ to: "/pagamento/pendente" })}
            className="w-full bg-[#184878] hover:bg-[#184878]/90 text-white font-semibold py-6 h-auto"
          >
            Tentar novamente
          </Button>
          <Button onClick={handleLogout} variant="outline" className="w-full">
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
