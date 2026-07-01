import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/elevare/AppShell";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/meu-resultado")({ component: MeuResultadoPage });

function MeuResultadoPage() {
  const [inspecoes, setInspecoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const { data: profile } = await supabase.from("profiles").select("cnpj").eq("id", user.id).single();
      if (!profile?.cnpj) { setLoading(false); return; }
      const { data } = await supabase.from("inspecoes").select("*").eq("cnpj", profile.cnpj).eq("status", "concluida").order("data_conclusao", { ascending: false });
      setInspecoes(data || []);
      setLoading(false);
    }
    load();
  }, [navigate]);

  const badge = (v: number) => v >= 76 ? "✅ BOM" : v >= 51 ? "⚠️ REGULAR" : "❌ RUIM";
  const badgeClass = (v: number) => v >= 76 ? "bg-green-100 text-green-700" : v >= 51 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">Meus Resultados</h1>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div>
      ) : inspecoes.length === 0 ? (
        <p className="text-center text-slate-400 py-12">Nenhuma inspeção disponível para o seu estabelecimento.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y">
          {inspecoes.map(i => (
            <div key={i.id} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50" onClick={() => navigate({ to: "/resultado", search: { id: i.id, readonly: true } })}>
              <div>
                <p className="font-medium text-sm">{i.estabelecimento_nome}</p>
                <p className="text-xs text-slate-500">{new Date(i.data_conclusao || i.data_inicio).toLocaleDateString("pt-BR")}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${badgeClass(Number(i.conformidade))}`}>
                {badge(Number(i.conformidade))} · {Number(i.conformidade).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
