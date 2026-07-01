import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: RedirectPage,
});

function RedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleRedirect() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate({ to: "/login", replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("perfil")
        .eq("id", session.user.id)
        .single();

      if (!profile) {
        await supabase.auth.signOut();
        navigate({ to: "/login", replace: true });
        return;
      }

      if (profile.perfil === "admin") {
        navigate({ to: "/dashboard", replace: true });
      } else if (profile.perfil === "consultor") {
        navigate({ to: "/historico", replace: true });
      } else if (profile.perfil === "cliente") {
        navigate({ to: "/meu-resultado", replace: true });
      } else {
        navigate({ to: "/login", replace: true });
      }
    }

    handleRedirect();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
