import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
type Profile = "admin" | "consultor" | "cliente";
export function ProtectedRoute({ children, allowedProfiles }: { children: React.ReactNode; allowedProfiles?: Profile[] }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/login" }); return; }
      if (allowedProfiles) {
        const { data: profile } = await supabase.from("profiles").select("perfil, ativo").eq("id", session.user.id).single();
        if (!profile || !profile.ativo) { navigate({ to: "/login" }); return; }
        if (!allowedProfiles.includes(profile.perfil as Profile)) { navigate({ to: "/acesso-negado" }); return; }
      }
      setChecking(false);
    }
    check();
  }, [navigate, allowedProfiles]);
  if (checking) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a4d2e]" /></div>;
  return <>{children}</>;
}
