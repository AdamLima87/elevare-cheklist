import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVisitas, useUpdateVisitaStatus } from "@/hooks/useVisitas";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda · Elevare" },
      { name: "description", content: "Calendário de visitas agendadas." },
    ],
  }),
  component: AgendaPage,
});

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function AgendaPage() {
  const navigate = useNavigate();
  const { data: visitas = [], isLoading } = useVisitas();
  const updateStatus = useUpdateVisitaStatus();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const datasComVisita = useMemo(
    () => visitas.map((v) => new Date(v.data_hora)),
    [visitas],
  );

  const visitasDoDia = useMemo(() => {
    if (!selectedDate) return [];
    return visitas
      .filter((v) => sameDay(new Date(v.data_hora), selectedDate))
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());
  }, [visitas, selectedDate]);

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-sm text-muted-foreground">Visitas agendadas de todos os clientes.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
            <Card className="w-fit">
              <CardContent className="p-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  modifiers={{ hasVisit: datasComVisita }}
                  modifiersClassNames={{
                    hasVisit: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
                  }}
                  className="rounded-md"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedDate
                    ? `Visitas em ${selectedDate.toLocaleDateString("pt-BR")} (${visitasDoDia.length})`
                    : `Todas as visitas (${visitas.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {visitasDoDia.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" /> Nenhuma visita agendada para este dia.
                  </p>
                ) : (
                  visitasDoDia.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-md border p-3 text-sm"
                    >
                      <div>
                        <button
                          className="font-medium hover:underline"
                          onClick={() => navigate({ to: "/clientes/$id", params: { id: v.cliente_id } })}
                        >
                          {v.clientes?.nome ?? "Cliente"}
                        </button>
                        <div className="text-xs text-muted-foreground">
                          {new Date(v.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
