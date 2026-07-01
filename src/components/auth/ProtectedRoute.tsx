import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedProfiles?: string[];
}

export function ProtectedRoute({ children, allowedProfiles }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("perfil, ativo")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        navigate({ 
          to: "/login",
          search: { error: "profile_not_found" }
        });
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

      if (allowedProfiles && !allowedProfiles.includes(profile.perfil)) {
        navigate({ to: "/acesso-negado" });
        return;
      }

      setAuthorized(true);
      setLoading(false);
    }

    checkAuth();
  }, [navigate, allowedProfiles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}
