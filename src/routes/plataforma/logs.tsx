import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { usePlatformAuditLog } from "@/hooks/usePlatform";

export const Route = createFileRoute("/plataforma/logs")({
  head: () => ({ meta: [{ title: "Auditoria · Administração da Plataforma · RDCheck" }] }),
  component: PlatformLogsPage,
});

function PlatformLogsPage() {
  const { data: eventos = [], isLoading } = usePlatformAuditLog();
  const [filtroEvento, setFiltroEvento] = useState<string>("todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState("");

  const tiposEvento = useMemo(() => Array.from(new Set(eventos.map((e) => e.event_type))).sort(), [eventos]);

  const eventosFiltrados = eventos.filter((e) => {
    if (filtroEvento !== "todos" && e.event_type !== filtroEvento) return false;
    if (filtroEmpresa.trim() && !e.empresas?.nome?.toLowerCase().includes(filtroEmpresa.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Eventos administrativos globais (últimos 200).</p>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Select value={filtroEvento} onValueChange={setFiltroEvento}>
            <SelectTrigger className="sm:w-64">
              <SelectValue placeholder="Tipo de evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os eventos</SelectItem>
              {tiposEvento.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Filtrar por empresa..."
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
            className="sm:w-64"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Quando</TableHead>
                      <TableHead className="font-bold">Evento</TableHead>
                      <TableHead className="font-bold">Empresa</TableHead>
                      <TableHead className="font-bold">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventosFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Nenhum evento encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      eventosFiltrados.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(e.created_at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{e.event_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{e.empresas?.nome ?? "—"}</TableCell>
                          <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
                            {JSON.stringify(e.metadata)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </PlatformLayout>
    </ProtectedRoute>
  );
}
