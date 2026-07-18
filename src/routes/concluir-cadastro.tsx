import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthenticatedRoute } from "@/components/auth/AuthenticatedRoute";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/elevare/Logo";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/concluir-cadastro")({
  head: () => ({
    meta: [{ title: "Conclua seu cadastro · RDCheck" }],
  }),
  component: () => (
    <AuthenticatedRoute>
      <ConcluirCadastroPage />
    </AuthenticatedRoute>
  ),
});

function ConcluirCadastroPage() {
  const navigate = useNavigate();
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("complete-provisioning", {
        body: { nomeCompleto, whatsapp, empresaNome },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Não foi possível concluir seu cadastro. Tente novamente.");
        setLoading(false);
        return;
      }

      toast.success("Cadastro concluído!");
      navigate({ to: "/onboarding" });
    } catch (err) {
      console.error("Erro ao concluir cadastro:", err);
      toast.error("Não foi possível concluir seu cadastro. Tente novamente.");
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
            <CardTitle className="text-2xl font-bold text-slate-800">Falta pouco</CardTitle>
            <CardDescription className="text-slate-500">
              Confirmamos seu e-mail — agora complete os dados da sua consultoria para começar.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nomeCompleto">Nome completo</Label>
              <Input id="nomeCompleto" required value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresaNome">Nome da empresa ou consultoria</Label>
              <Input id="empresaNome" required value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-[#184878] hover:bg-[#184878]/90 text-white font-semibold py-6 h-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Concluir cadastro"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
