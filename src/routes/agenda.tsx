import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVisitas, useUpdateVisitaStatus } from "@/hooks/useVisitas";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda · Elevare" },
      { name: "description", content: "Próximas visitas agendadas." },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const navigate = useNavigate();
  const { data: visitas = [], isLoading } = useVisitas({ onlyUpcoming: true });
  const updateStatus = useUpdateVisitaStatus();

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-sm text-muted-foreground">Próximas visitas agendadas.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visitas ({visitas.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : visitas.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" /> Nenhuma visita agendada.
              </p>
            ) : (
              visitas.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div>
                    <button
                      className="font-medium hover:underline"
                      onClick={() => navigate({ to: "/clientes/$id", params: { id: v.cliente_id } })}
                    >
                      {v.clientes?.nome ?? "Cliente"}
                    </button>
                    <div className="text-xs text-muted-foreground">
                      {new Date(v.data_hora).toLocaleString("pt-BR")}
                    </div>
                    {v.observacoes && <div className="text-xs text-muted-foreground">{v.observacoes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        v.status === "agendada" && "bg-blue-100 text-blue-700",
                        v.status === "realizada" && "bg-green-100 text-green-700",
                        v.status === "cancelada" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {v.status}
                    </span>
                    {v.status === "agendada" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: v.id, status: "realizada" })}
                        >
                          Marcar realizada
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: v.id, status: "cancelada" })}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </AppShell>
    </ProtectedRoute>
  );
}
