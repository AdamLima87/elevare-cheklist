import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/elevare/Logo";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({ error: (search.error as string) || undefined }),
  component: LoginPage,
});

function LoginPage() {
  const { error: searchError } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"selection" | "credentials">("selection");
  const [userType, setUserType] = useState<"consultor" | "cliente" | null>(null);

  useEffect(() => {
    if (searchError) {
      const msgs: Record<string, string> = {
        account_disabled: "Sua conta está desativada.",
        profile_not_found: "Perfil não encontrado.",
        insufficient_permissions: "Você não tem permissão para acessar esta área.",
      };
      if (msgs[searchError]) toast.error(msgs[searchError]);
      navigate({ to: "/login", replace: true });
    }
  }, [searchError, navigate]);

  const handlePasswordChange = (value: string) => {
    if (userType === "cliente") setPassword(value.replace(/\D/g, "").slice(0, 14));
    else setPassword(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (userType === "cliente") {
      const allowed = ["Backspace","Delete","Tab","Enter","ArrowLeft","ArrowRight"];
      if (!/^[0-9]$/.test(e.key) && !allowed.includes(e.key) && !e.metaKey && !e.ctrlKey) e.preventDefault();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile } = await supabase.from("profiles").select("perfil, ativo, force_password_change").eq("id", data.user.id).single();
      if (!profile?.ativo) { await supabase.auth.signOut(); throw new Error("Sua conta está desativada."); }
      if (userType === "cliente" && profile.perfil !== "cliente") { await supabase.auth.signOut(); throw new Error("Acesso restrito para Clientes."); }
      if (userType === "consultor" && profile.perfil === "cliente") { await supabase.auth.signOut(); throw new Error("Acesso restrito para Consultores e Administradores."); }
      if (profile.force_password_change) { navigate({ to: "/perfil" }); toast.info("Por favor, altere sua senha."); return; }
      await supabase.from("profiles").update({ ultimo_acesso: new Date().toISOString() }).eq("id", data.user.id);
      toast.success("Login realizado com sucesso!");
      if (profile.perfil === "admin") navigate({ to: "/dashboard" });
      else if (profile.perfil === "consultor") navigate({ to: "/historico" });
      else navigate({ to: "/meu-resultado" });
    } catch (error: any) {
      const msg = error.message?.includes("Invalid login credentials") ? "E-mail ou senha incorretos." : error.message || "Erro ao fazer login.";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg border-slate-200">
        <CardHeader className="flex flex-col items-center pb-6 space-y-4">
          <Logo />
          <div className="text-center">
            <CardTitle className="text-2xl font-bold text-slate-800">
              {step === "selection" ? "Selecione seu Perfil" : "Acesso ao Sistema"}
            </CardTitle>
            <CardDescription>
              {step === "selection" ? "Escolha como deseja acessar a plataforma" : "Entre com suas credenciais para continuar"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {step === "selection" ? (
            <div className="grid grid-cols-2 gap-4 py-4">
              {[{ type: "consultor" as const, emoji: "🔍", title: "Consultor / Admin", sub: "Acesso para equipe Elevare" }, { type: "cliente" as const, emoji: "🏪", title: "Cliente", sub: "Acesso para estabelecimentos" }].map(({ type, emoji, title, sub }) => (
                <button key={type} onClick={() => { setUserType(type); setStep("credentials"); }}
                  className="flex flex-col items-center p-8 rounded-xl border-2 border-slate-100 bg-white hover:border-[#1a4d2e] hover:bg-[#1a4d2e]/5 transition-all space-y-3">
                  <span className="text-3xl">{emoji}</span>
                  <div><h3 className="font-semibold text-slate-800">{title}</h3><p className="text-xs text-slate-500">{sub}</p></div>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5 py-2">
              <button type="button" onClick={() => { setStep("selection"); setEmail(""); setPassword(""); }} className="text-sm text-slate-500 hover:text-[#1a4d2e]">← Voltar para seleção</button>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="exemplo@email.com" required />
              </div>
              {userType === "cliente" && <p className="text-xs text-slate-500 bg-slate-100 p-2 rounded">Dica: Sua senha é o CNPJ do estabelecimento (somente números)</p>}
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type={userType === "cliente" ? "text" : "password"} value={password} onChange={e => handlePasswordChange(e.target.value)} onKeyDown={handleKeyDown} placeholder={userType === "cliente" ? "CNPJ (somente números)" : "Sua senha"} required />
                {userType === "cliente" && <p className="text-right text-[10px] text-slate-400">{password.length}/14 dígitos</p>}
              </div>
              <Button type="submit" className="w-full bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white py-6 h-auto" disabled={loading || (userType === "cliente" && password.length !== 14)}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
              <div className="text-center"><button type="button" className="text-sm text-[#1a4d2e] hover:underline">Esqueci minha senha</button></div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
