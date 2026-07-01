import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/perfil")({ component: PerfilPage });

function PerfilPage() {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.from("profiles").select("nome").eq("id", user.id).single().then(({ data }) => { if (data) setNome(data.nome || ""); });
    });
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ nome, force_password_change: false }).eq("id", user.id);
      if (senha) await supabase.auth.updateUser({ password: senha });
      toast.success("Perfil atualizado com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    } finally { setLoading(false); }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <h1 className="text-2xl font-semibold mb-6">Meu Perfil</h1>
        <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md space-y-4">
          <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
          <div className="space-y-2"><Label>Nova senha (opcional)</Label><Input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Deixe em branco para manter" /></div>
          <Button onClick={handleSave} disabled={loading} className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white w-full">Salvar alterações</Button>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
