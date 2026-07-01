import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/elevare/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Search, FileText, Download } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { classificacao, type Inspecao } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/meu-resultado")({
  component: ClientePage,
});

function ClientePage() {
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadClientData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate({ to: "/login" });
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("cnpj")
          .eq("id", user.id)
          .single();

        if (!profile?.cnpj) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("inspecoes")
          .select("*")
          .eq("cnpj", profile.cnpj)
          .eq("status", "concluida")
          .order("data_conclusao", { ascending: false });

        if (error) throw error;
        setInspections(data || []);
      } catch (error: any) {
        console.error("Erro ao buscar inspeções:", error);
        toast.error("Erro ao carregar seus resultados.");
      } finally {
        setLoading(false);
      }
    }

    loadClientData();
  }, [navigate]);

  const verRelatorio = (insp: any) => {
    // Redirect to result page with read-only view logic
    // We'll need to mock the storage if necessary or just pass the ID
    navigate({ to: "/resultado", search: { id: insp.id, readonly: true } });
  };

  return (
    <ProtectedRoute allowedProfiles={["cliente", "admin"]}>
      <AppShell>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Meus Resultados</h1>
          <p className="text-muted-foreground">Consulte os relatórios de inspeção do seu estabelecimento.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" />
          </div>
        ) : (
          <div className="space-y-4">
            {inspections.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground italic text-lg">Nenhuma inspeção disponível para o seu estabelecimento.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {inspections.map((insp) => {
                  const conf = Number(insp.conformidade);
                  const cls = classificacao(conf);
                  return (
                    <Card key={insp.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="font-medium text-lg">{insp.estabelecimento_nome}</h3>
                          <p className="text-sm text-muted-foreground">
                            Concluída em: {new Date(insp.data_conclusao).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold uppercase",
                            cls.tone === "success" && "bg-success/15 text-success",
                            cls.tone === "warning" && "bg-warning/15 text-warning",
                            cls.tone === "destructive" && "bg-destructive/15 text-destructive"
                          )}>
                            {cls.emoji} {conf.toFixed(0)}% {cls.label}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => verRelatorio(insp)} className="gap-2">
                            <FileText className="h-4 w-4" /> Relatório
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
