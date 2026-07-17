import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// Distinto de ProtectedRoute de propósito: exige só uma sessão Auth válida,
// sem exigir que `profiles` exista para o usuário. Usado exclusivamente por
// /concluir-cadastro — o único ponto do app acessível por alguém autenticado
// que ainda não tem profile/empresa (chegou ali via magic link, provando
// controle da conta, mas o provisionamento do tenant ainda não rodou).
// ProtectedRoute redireciona/desloga nesse estado; este componente não pode
// ter esse comportamento, senão a própria tela que resolve o estado nunca
// seria alcançável.
export function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      setAuthorized(true);
      setLoading(false);
    }

    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}
