import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/elevare/AppShell";
import { UserAccountForm } from "@/components/auth/UserAccountForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("force_password_change")
          .eq("id", user.id)
          .single();
        setMustChange(!!data?.force_password_change);
      }
    }
    checkStatus();
  }, []);

  return (
    <AppShell>
      <div className="max-w-md mx-auto space-y-6">
        {mustChange && (
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg mb-6 animate-pulse">
            <h2 className="text-primary font-bold text-lg mb-1">Ação Necessária</h2>
            <p className="text-primary/80 text-sm font-medium">
              Sua conta está usando uma senha temporária. Por segurança, você deve alterá-la antes de continuar usando o sistema.
            </p>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie seus dados de acesso ao sistema.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados da Conta</CardTitle>
            <CardDescription>
              Atualize seu e-mail ou altere sua senha de acesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserAccountForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
