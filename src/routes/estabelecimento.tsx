import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
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
import { contarNCCriticas } from "@/lib/checklist-data";
import { toTrendPoints } from "@/lib/compliance-trend";
import { ComplianceTrendChart } from "@/components/elevare/ComplianceTrendChart";
import { useInspecoesQuery } from "@/hooks/useInspecoesQuery";

export const Route = createFileRoute("/estabelecimento")({
  head: () => ({
    meta: [
      { title: "Histórico do Estabelecimento · Elevare" },
      {
        name: "description",
        content: "Evolução da conformidade de um estabelecimento ao longo do tempo.",
      },
    ],
  }),
  component: EstabelecimentoPage,
});

function EstabelecimentoPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/estabelecimento" }) as { cnpj?: string };

  const { data, isLoading } = useInspecoesQuery({
    cnpj: search.cnpj,
    status: "concluida",
    orderBy: "data_conclusao",
    page: 0,
    pageSize: 100,
  });

  const rows = data?.rows ?? [];
  const mostRecent = rows[0] as any;

  if (!search.cnpj) {
    return (
      <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
        <AppShell>
          <p className="text-sm text-muted-foreground">Nenhum estabelecimento informado.</p>
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/relatorios" })}
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
              <h1 className="text-2xl font-semibold">
                {mostRecent?.estabelecimento_nome || "Estabelecimento"}
              </h1>
              <p className="text-sm text-muted-foreground">CNPJ: {search.cnpj}</p>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Evolução da conformidade</CardTitle>
                <CardDescription>
                  Pontuação ao longo de todas as inspeções concluídas neste estabelecimento.
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
                      {rows.map((insp: any) => {
                        const cls = classificacao(Number(insp.conformidade), contarNCCriticas(insp.respostas));
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
                                  navigate({
                                    to: "/resultado",
                                    search: { id: insp.id, readonly: true },
                                  })
                                }
                                title="Ver relatório"
                                className="h-8 w-8 p-0"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
