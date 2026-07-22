import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
  validateSearch: (search: Record<string, unknown>) => {
    return {
      error: (search.error as string) || undefined,
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const { error: searchError } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [step, setStep] = useState<"selection" | "credentials">("selection");
  const [userType, setUserType] = useState<"consultor" | "cliente" | null>(null);

  useEffect(() => {
    if (searchError) {
      let msg = "";
      if (searchError === "account_disabled") msg = "Sua conta está desativada. Entre em contato com o suporte.";
      if (searchError === "profile_not_found") msg = "Perfil não encontrado. Verifique se seu cadastro foi concluído.";
      if (searchError === "insufficient_permissions") msg = "Você não tem permissão para acessar esta área.";
      
      if (msg) toast.error(msg);
      
      // Limpa a URL removendo o erro após mostrar o toast
      navigate({ to: "/login", replace: true });
    }
  }, [searchError, navigate]);

  const handlePasswordChange = (value: string) => {
    // Only allow numbers for clients
    if (userType === "cliente") {
      const filtered = value.replace(/\D/g, "").slice(0, 14);
      setPassword(filtered);
    } else {
      setPassword(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (userType === "cliente") {
      // Allow only numbers and control keys
      const allowedKeys = ["Backspace", "Delete", "Tab", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "v", "c"];
      const isNumber = /^[0-9]$/.test(e.key);
      const isControl = allowedKeys.includes(e.key);
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (!isNumber && !isControl && !isCmdOrCtrl) {
        e.preventDefault();
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!data.user) throw new Error("Usuário não encontrado");

      // Fetch profile to redirect correctly
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("perfil, ativo, force_password_change, cnpj")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error("Erro ao buscar perfil:", profileError);
        // Fallback for new users where trigger might be slow
        toast.info("Perfil sendo configurado, tentando novamente...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: retryProfile } = await supabase
          .from("profiles")
          .select("perfil, ativo, force_password_change, cnpj")
          .eq("id", data.user.id)
          .single();
        
        if (retryProfile) {
          validateAndRedirect(retryProfile);
          return;
        }
        throw new Error("Perfil não encontrado. Entre em contato com o suporte.");
      }

      if (!profile.ativo) {
        await supabase.auth.signOut();
        throw new Error("Sua conta está desativada.");
      }

      await validateAndRedirect(profile);
    } catch (error: any) {
      console.error("Erro no login:", error);
      
      let errorMessage = "Erro ao fazer login";
      
      if (error.message?.includes("Invalid login credentials") || error.status === 400) {
        errorMessage = "E-mail ou senha incorretos. Verifique suas credenciais.";
      } else if (error.message?.includes("Email not confirmed")) {
        errorMessage = "E-mail não confirmado. Verifique sua caixa de entrada.";
      } else if (error.message === "Sua conta está desativada.") {
        errorMessage = "Sua conta está desativada. Entre em contato com o administrador.";
      } else if (error.message === "Perfil não encontrado. Entre em contato com o suporte.") {
        errorMessage = "Perfil não encontrado. Verifique se seu cadastro foi concluído.";
      } else if (error.message === "CNPJ não corresponde ao seu cadastro.") {
        errorMessage = "CNPJ não corresponde ao seu cadastro.";
      } else if (error.status === 429) {
        errorMessage = "Muitas tentativas de login. Tente novamente mais tarde.";
      } else if (error.message?.includes("Database error") || error.code === "PGRST301") {
        errorMessage = "Erro de permissão no banco de dados. Contate o suporte técnico.";
      } else {
        errorMessage = error.message || "Ocorreu um erro inesperado ao tentar acessar o sistema.";
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const validateAndRedirect = async (profile: any) => {
    // Validar perfil selecionado vs perfil do banco
    if (userType === "cliente" && profile.perfil !== "cliente") {
      await supabase.auth.signOut();
      toast.error("Este acesso é restrito para Clientes.");
      return;
    }
    
    if (userType === "consultor" && profile.perfil === "cliente") {
      await supabase.auth.signOut();
      toast.error("Este acesso é restrito para Consultores e Administradores.");
      return;
    }

    // Validar CNPJ para clientes (ja validado pela senha e login auth)
    // if (userType === "cliente") {
    //   const cleanInputCnpj = password.replace(/\D/g, "");
    //   const cleanProfileCnpj = (profile.cnpj || "").replace(/\D/g, "");
    //   
    //   if (cleanInputCnpj !== cleanProfileCnpj) {
    //     await supabase.auth.signOut();
    //     throw new Error("CNPJ não corresponde ao seu cadastro.");
    //   }
    // }

    if (profile?.force_password_change) {
      navigate({ to: "/perfil" });
      toast.info("Por favor, altere sua senha para continuar.");
    } else {
      // Update last access
      await supabase
        .from("profiles")
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq("id", profile.id);

      if (profile?.perfil === "super_admin") {
        navigate({ to: "/escolha-acesso" });
      } else if (profile?.perfil === "admin") {
        navigate({ to: "/dashboard" });
      } else if (profile?.perfil === "consultor") {
        navigate({ to: "/clientes" });
      } else if (profile?.perfil === "cliente") {
        navigate({ to: "/meu-resultado" });
      } else {
        navigate({ to: "/login", search: { error: "insufficient_permissions" } });
      }
    }
    toast.success("Login realizado com sucesso!");
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error("Informe seu e-mail primeiro");
      return;
    }
    setResetLoading(true);
    try {
      // Chamando a Edge Function para gerar senha temporária
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "forgot_password",
          userData: { email }
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(data.message || "E-mail de recuperação enviado com sua senha temporária!");
      
      // Como ainda não temos o envio de e-mail real configurado (aguardando DNS), 
      // vou mostrar um alerta informativo se estivermos em desenvolvimento/preview
      if (window.location.hostname.includes('lovable') || window.location.hostname === 'localhost') {
        console.log("DEBUG: Resposta da função:", data);
      }
    } catch (error: any) {
      console.error("Erro ao recuperar senha:", error);
      toast.error(error.message || "Erro ao solicitar recuperação");
    } finally {
      setResetLoading(false);
    }
  };

  const selectUserType = (type: "consultor" | "cliente") => {
    setUserType(type);
    setStep("credentials");
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
              {step === "selection" ? "Selecione seu Perfil" : "Acesso ao Sistema"}
            </CardTitle>
            <CardDescription className="text-slate-500">
              {step === "selection" 
                ? "Escolha como deseja acessar a plataforma" 
                : "Entre com suas credenciais para continuar"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {step === "selection" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 animate-in fade-in duration-500">
              <button
                onClick={() => selectUserType("consultor")}
                className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-slate-100 bg-white hover:border-[#184878] hover:bg-[#184878]/5 transition-all group text-center space-y-3"
              >
                <div className="p-4 rounded-full bg-slate-50 group-hover:bg-[#184878]/10 transition-colors">
                  <span className="text-3xl" role="img" aria-label="Search">🔍</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Consultor / Admin</h3>
                  <p className="text-xs text-slate-500">Acesso para consultores e equipe</p>
                </div>
              </button>

              <button
                onClick={() => selectUserType("cliente")}
                className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-slate-100 bg-white hover:border-[#184878] hover:bg-[#184878]/5 transition-all group text-center space-y-3"
              >
                <div className="p-4 rounded-full bg-slate-50 group-hover:bg-[#184878]/10 transition-colors">
                  <span className="text-3xl" role="img" aria-label="Shop">🏪</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Cliente</h3>
                  <p className="text-xs text-slate-500">Acesso para estabelecimentos</p>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5 py-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <button
                type="button"
                onClick={() => {
                  setStep("selection");
                  setEmail("");
                  setPassword("");
                }}
                className="flex items-center text-sm font-medium text-slate-500 hover:text-[#184878] transition-colors mb-2"
              >
                <span className="mr-1">←</span> Voltar para seleção
              </button>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="exemplo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus-visible:ring-[#184878]"
                  required
                />
              </div>

              {userType === "cliente" && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 bg-slate-100 p-2 rounded border border-slate-200">
                    Dica: Sua senha é o CNPJ do estabelecimento (somente números)
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" title="Senha" className="text-slate-700">Senha</Label>
                </div>
                <Input
                  id="password"
                  type={userType === "cliente" ? "text" : "password"}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={userType === "cliente" ? "CNPJ (somente números)" : "Sua senha"}
                  className="focus-visible:ring-[#184878]"
                  required
                />
                {userType === "cliente" && (
                  <div className="flex justify-end">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {password.length}/14 dígitos
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full bg-[#184878] hover:bg-[#184878]/90 text-white font-semibold py-6 h-auto transition-colors" 
                  disabled={loading || (userType === "cliente" && password.length !== 14)}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Entrar"}
                </Button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="text-sm text-[#184878] hover:underline font-medium"
                >
                  Esqueci minha senha
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
