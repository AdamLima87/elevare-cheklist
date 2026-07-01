import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({ component: IndexPage });

function IndexPage() {
  const navigate = useNavigate();
  useEffect(() => {
    async function redirect() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/login" }); return; }
      const { data: profile } = await supabase.from("profiles").select("perfil").eq("id", session.user.id).single();
      if (profile?.perfil === "admin") navigate({ to: "/dashboard" });
      else if (profile?.perfil === "consultor") navigate({ to: "/historico" });
      else if (profile?.perfil === "cliente") navigate({ to: "/meu-resultado" });
      else navigate({ to: "/login" });
    }
    redirect();
  }, [navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a4d2e]" />
    </div>
  );
}
