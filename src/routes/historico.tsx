import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/historico")({ component: HistoricoPage });

function HistoricoPage() {
  const [inspecoes, setInspecoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from("profiles").select("perfil").eq("id", session.user.id).single();
      let query = supabase.from("inspecoes").select("*").order("data_inicio", { ascending: false });
      if (profile?.perfil !== "admin") query = query.eq("consultor_id", session.user.id);
      const { data } = await query;
      setInspecoes(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta inspeção?")) return;
    await supabase.from("inspecoes").delete().eq("id", id);
    setInspecoes(prev => prev.filter(i => i.id !== id));
    toast.success("Inspeção excluída.");
  };

  const badge = (v: number) => v >= 76 ? "bg-green-100 text-green-700" : v >= 51 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Histórico de Inspeções</h1>
          <Button onClick={() => navigate({ to: "/nova-inspecao" })} className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white">Nova Inspeção</Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div>
        ) : inspecoes.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhuma inspeção encontrada.</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y">
            {inspecoes.map(i => (
              <div key={i.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-sm">#{String(i.numero_sequencial).padStart(3,"0")} — {i.estabelecimento_nome}</p>
                  <p className="text-xs text-slate-500">{new Date(i.data_inicio).toLocaleDateString("pt-BR")} · {i.cnpj}</p>
                </div>
                <div className="flex items-center gap-2">
                  {i.status === "concluida" ? (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${badge(Number(i.conformidade))}`}>{Number(i.conformidade).toFixed(1)}%</span>
                  ) : (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">{i.progresso}% preenchido</span>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/resultado", search: { id: i.id, readonly: true } })}><FileText className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
