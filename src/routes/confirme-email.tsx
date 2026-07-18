import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/elevare/Logo";
import { Loader2, MailCheck } from "lucide-react";

export const Route = createFileRoute("/confirme-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: (search.email as string) || "",
    pending: Boolean(search.pending),
  }),
  head: () => ({
    meta: [{ title: "Confirme seu e-mail · RDCheck" }],
  }),
  component: ConfirmeEmailPage,
});

function ConfirmeEmailPage() {
  const { email, pending } = Route.useSearch();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      // action:"resend" — o backend nunca cria nada a partir daqui, só
      // reenvia confirmação para e-mails que já existem e não estão
      // confirmados. Não coleta nem envia senha/nome/empresa: essa tela
      // só tem o e-mail.
      const { data, error } = await supabase.functions.invoke("public-signup", {
        body: { action: "resend", email },
      });
      if (error) throw error;
      if (data?.success === false) {
        toast.info(data.error || "Não foi possível reenviar.");
      } else {
        setResent(true);
        toast.success("E-mail reenviado.");
      }
    } catch (err) {
      console.error("Erro ao reenviar confirmação:", err);
      toast.error("Não foi possível reenviar agora. Tente novamente em instantes.");
    } finally {
      setResending(false);
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
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#184878]/10">
            <MailCheck className="h-8 w-8 text-[#184878]" />
          </div>
          <div className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold text-slate-800">Verifique seu e-mail</CardTitle>
            <CardDescription className="text-slate-500">
              Enviamos um link de confirmação {email ? <>para <strong>{email}</strong></> : "para o e-mail que você cadastrou"}.
              Clique nele para ativar sua conta e continuar.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending && !resent && (
            <p className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              Estamos com uma instabilidade no envio agora — se o e-mail não chegar em alguns minutos, use o botão abaixo para reenviar.
            </p>
          )}

          <Button onClick={handleResend} disabled={resending || resent} variant="outline" className="w-full">
            {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : resent ? "E-mail reenviado" : "Reenviar e-mail de confirmação"}
          </Button>

          <p className="text-center text-sm text-slate-500">
            <Link to="/login" className="text-[#184878] hover:underline font-medium">
              Voltar para o login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
