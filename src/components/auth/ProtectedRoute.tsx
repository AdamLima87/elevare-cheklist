import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedProfiles?: string[];
}

export function ProtectedRoute({ children, allowedProfiles }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      // maybeSingle (não single): precisamos distinguir "erro real de
      // query" de "sessão válida, mas ainda sem profile" — este segundo
      // caso não é um erro, é o estado normal de quem confirmou a conta
      // mas ainda não completou o provisionamento do tenant (fluxo
      // "conta confirmada sem tenant" do cadastro público).
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("perfil, ativo, empresa_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut();
        navigate({
          to: "/login",
          search: { error: "profile_not_found" }
        });
        return;
      }

      if (!profile) {
        // Sessão legítima (a pessoa provou controle do e-mail clicando no
        // magic link), só falta completar o cadastro — não desloga.
        if (location.pathname !== "/concluir-cadastro") {
          navigate({ to: "/concluir-cadastro" });
          return;
        }
        setAuthorized(true);
        setLoading(false);
        return;
      }

      if (!profile.ativo) {
        await supabase.auth.signOut();
        navigate({
          to: "/login",
          search: { error: "account_disabled" }
        });
        return;
      }

      if (
        profile.perfil !== "super_admin" &&
        allowedProfiles &&
        !allowedProfiles.includes(profile.perfil)
      ) {
        navigate({ to: "/acesso-negado" });
        return;
      }

      // Onboarding pendente: só força o admin dono, nunca convidados. Se a
      // empresa já existia antes desta feature, onboarding_completed_at
      // foi preenchido via backfill de migration — nunca força quem já
      // usava o sistema.
      if (profile.perfil === "admin" && location.pathname !== "/onboarding") {
        const { data: empresa } = await supabase
          .from("empresas")
          .select("onboarding_completed_at")
          .eq("id", profile.empresa_id)
          .maybeSingle();
        if (empresa && !empresa.onboarding_completed_at) {
          navigate({ to: "/onboarding" });
          return;
        }
      }

      setAuthorized(true);
      setLoading(false);
    }

    checkAuth();
  }, [navigate, allowedProfiles, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}
