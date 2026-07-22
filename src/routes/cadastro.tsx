import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Logo } from "@/components/elevare/Logo";
import { Loader2 } from "lucide-react";

type PlanoCadastro = "trial" | "mensal" | "anual";

const PLANO_CONTEUDO: Record<PlanoCadastro, { titulo: string; descricao: string; botao: string }> = {
  trial: {
    titulo: "Experimente grátis",
    descricao: "Crie sua conta e comece a usar o RDCheck agora mesmo.",
    botao: "Iniciar demonstração",
  },
  mensal: {
    titulo: "Plano Mensal",
    descricao: "R$ 120/mês — cobrança recorrente no cartão.",
    botao: "Continuar para pagamento",
  },
  anual: {
    titulo: "Plano Anual",
    descricao: "R$ 1.250 — à vista ou em até 10x no cartão.",
    botao: "Continuar para pagamento",
  },
};

export const Route = createFileRoute("/cadastro")({
  validateSearch: (search: Record<string, unknown>) => ({
    plano: (search.plano === "mensal" || search.plano === "anual" ? search.plano : "trial") as PlanoCadastro,
    utm_source: (search.utm_source as string) || undefined,
    utm_medium: (search.utm_medium as string) || undefined,
    utm_campaign: (search.utm_campaign as string) || undefined,
    utm_term: (search.utm_term as string) || undefined,
    utm_content: (search.utm_content as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Criar conta · RDCheck" },
      { name: "description", content: "Experimente grátis — crie sua conta no RDCheck." },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const conteudo = PLANO_CONTEUDO[search.plano];

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);
  // Honeypot — campo nunca visível para humanos; bots costumam preenchê-lo.
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (!aceiteTermos) {
      toast.error("É necessário aceitar os termos de uso e a política de privacidade.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-signup", {
        body: {
          nomeCompleto,
          email,
          whatsapp,
          empresaNome,
          password,
          website,
          plano: search.plano,
          utm: {
            utm_source: search.utm_source,
            utm_medium: search.utm_medium,
            utm_campaign: search.utm_campaign,
            utm_term: search.utm_term,
            utm_content: search.utm_content,
          },
        },
      });

      if (error) throw error;

      if (data?.success === false) {
        toast.error(data.error || "Não foi possível concluir o cadastro.");
        setLoading(false);
        return;
      }

      navigate({
        to: "/confirme-email",
        search: { email, pending: data?.email_status === "pending" },
      });
    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      toast.error("Não foi possível concluir o cadastro. Tente novamente.");
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
            <CardTitle className="text-2xl font-bold text-slate-800">{conteudo.titulo}</CardTitle>
            <CardDescription className="text-slate-500">{conteudo.descricao}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot — oculto via CSS, não display:none (alguns bots ignoram display:none) */}
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomeCompleto">Nome completo</Label>
              <Input id="nomeCompleto" required value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresaNome">Nome da empresa ou consultoria</Label>
              <Input id="empresaNome" required value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirme a senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="flex items-start gap-2">
              <Checkbox id="termos" checked={aceiteTermos} onCheckedChange={(v) => setAceiteTermos(v === true)} />
              <Label htmlFor="termos" className="text-xs font-normal text-slate-500 leading-relaxed">
                Li e aceito os termos de uso e a política de privacidade.
              </Label>
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-[#184878] hover:bg-[#184878]/90 text-white font-semibold py-6 h-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : conteudo.botao}
            </Button>

            <p className="text-center text-sm text-slate-500">
              Já tem uma conta?{" "}
              <Link to="/login" className="text-[#184878] hover:underline font-medium">
                Entrar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
