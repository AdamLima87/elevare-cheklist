import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, FileText, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { classificacao } from "@/lib/storage";
import { toTrendPoints } from "@/lib/compliance-trend";
import { ComplianceTrendChart } from "@/components/elevare/ComplianceTrendChart";
import { useCliente } from "@/hooks/useClientes";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Histórico do Cliente · Elevare" },
      { name: "description", content: "Evolução da conformidade de um cliente ao longo do tempo." },
    ],
  }),
  component: ClienteDetailPage,
});

function ClienteDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/clientes/$id" });
  const { data: cliente, isLoading: loadingCliente } = useCliente(id);

  const { data: rows = [], isLoading: loadingInspecoes } = useQuery({
    queryKey: ["inspecoes-por-cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecoes")
        .select("*")
        .eq("cliente_id", id)
        .eq("status", "concluida")
        .order("data_conclusao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const isLoading = loadingCliente || loadingInspecoes;

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/clientes" })}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">{cliente?.nome || "Cliente"}</h1>
              <p className="text-sm text-muted-foreground">
                {cliente?.cnpj ? `CNPJ: ${cliente.cnpj}` : "Sem CNPJ cadastrado"}
                {cliente?.categoria ? ` · ${cliente.categoria}` : ""}
              </p>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Evolução da conformidade</CardTitle>
                <CardDescription>
                  Pontuação ao longo de todas as inspeções concluídas deste cliente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ComplianceTrendChart data={toTrendPoints(rows)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inspeções ({rows.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Conformidade</TableHead>
                        <TableHead>Classificação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            Nenhuma inspeção concluída para este cliente ainda.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((insp: any) => {
                          const cls = classificacao(Number(insp.conformidade));
                          return (
                            <TableRow key={insp.id}>
                              <TableCell className="text-sm">
                                {new Date(insp.data_conclusao).toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell className="text-sm font-bold text-primary">
                                {Number(insp.conformidade).toFixed(1)}%
                              </TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                    cls.tone === "success" && "bg-green-100 text-green-700",
                                    cls.tone === "warning" && "bg-yellow-100 text-yellow-700",
                                    cls.tone === "destructive" && "bg-red-100 text-red-700",
                                  )}
                                >
                                  {cls.label}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    navigate({ to: "/resultado", search: { id: insp.id, readonly: true } })
                                  }
                                  title="Ver relatório"
                                  className="h-8 w-8 p-0"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
