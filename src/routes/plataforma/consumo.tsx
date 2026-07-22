import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { usePlatformGooglePlacesConsumo } from "@/hooks/usePlatform";

export const Route = createFileRoute("/plataforma/consumo")({
  head: () => ({ meta: [{ title: "Google Places · Administração da Plataforma · RDCheck" }] }),
  component: PlatformConsumoPage,
});

function PlatformConsumoPage() {
  const { data: linhas = [], isLoading } = usePlatformGooglePlacesConsumo();

  const totalLeadsImportados = linhas.reduce((acc, l) => acc + l.total_leads_importados, 0);
  const totalMesAtual = linhas.reduce((acc, l) => acc + l.mes_atual_leads_importados, 0);
  const usandoChaveRdcheck = linhas.filter((l) => l.credencial_origem === "rdcheck").length;
  const usandoChavePropria = linhas.filter((l) => l.credencial_origem === "tenant").length;

  return (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Google Places — Consumo</h1>
          <p className="text-sm text-muted-foreground">
            Consumo global e por tenant do Buscar Leads. Chaves nunca são expostas aqui.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Metric titulo="Leads importados (total)" valor={totalLeadsImportados} />
              <Metric titulo="Leads importados (mês atual)" valor={totalMesAtual} />
              <Metric titulo="Usando chave do RDCheck" valor={usandoChaveRdcheck} />
              <Metric titulo="Usando chave própria (BYO)" valor={usandoChavePropria} />
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Empresa</TableHead>
                        <TableHead className="font-bold">Plano</TableHead>
                        <TableHead className="font-bold">Credencial</TableHead>
                        <TableHead className="font-bold text-center">Trial (usado/limite)</TableHead>
                        <TableHead className="font-bold text-center">Mês atual</TableHead>
                        <TableHead className="font-bold text-center">Buscas (1h)</TableHead>
                        <TableHead className="font-bold text-center">Total leads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            Nenhuma empresa cadastrada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        linhas.map((l) => (
                          <TableRow key={l.empresa_id}>
                            <TableCell className="py-3 font-medium">{l.empresa_nome}</TableCell>
                            <TableCell className="text-sm capitalize">{l.plano}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant={l.credencial_origem === "tenant" ? "default" : "outline"}>
                                  {l.credencial_origem === "tenant" ? "BYO key" : "Chave RDCheck"}
                                </Badge>
                                {l.credencial_origem === "tenant" && (
                                  <Badge variant={l.credencial_status === "conectado" ? "outline" : "destructive"}>
                                    {l.credencial_status}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">
                              {l.trial_leads_usados}/{l.trial_leads_limite}
                            </TableCell>
                            <TableCell className="text-center text-sm">{l.mes_atual_leads_importados}</TableCell>
                            <TableCell className="text-center text-sm">{l.buscas_ultima_hora}</TableCell>
                            <TableCell className="text-center text-sm">{l.total_leads_importados}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </PlatformLayout>
    </ProtectedRoute>
  );
}

function Metric({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-2xl font-bold">{valor}</p>
        <p className="text-xs text-muted-foreground">{titulo}</p>
      </CardContent>
    </Card>
  );
}
