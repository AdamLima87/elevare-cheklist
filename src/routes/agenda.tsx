import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { DayButton } from "react-day-picker";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, CalendarDays, Plus } from "lucide-react";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useVisitas, useUpdateVisitaStatus, useCreateVisita } from "@/hooks/useVisitas";
import { useClientes } from "@/hooks/useClientes";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

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

// Dia com largura flexível (estica pra preencher a semana) e altura fixa e
// baixa — desacopla do aspect-square padrão do calendário pra caber largo e
// curto ao mesmo tempo.
function CompactDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={modifiers.selected}
      className={cn(
        "relative h-9 w-full min-w-9 flex-1 rounded-md font-normal leading-none data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}

function AgendaPage() {
  const navigate = useNavigate();
  const { data: profile } = useCurrentProfile();
  const { data: visitas = [], isLoading } = useVisitas();
  const updateStatus = useUpdateVisitaStatus();
  const createVisita = useCreateVisita();
  const { data: clientes = [] } = useClientes(undefined, "ativo");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clienteId: "", dataHora: "", observacoes: "" });

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id || !form.clienteId || !form.dataHora) return;
    try {
      await createVisita.mutateAsync({
        empresa_id: profile.empresa_id,
        cliente_id: form.clienteId,
        data_hora: new Date(form.dataHora).toISOString(),
        observacoes: form.observacoes || null,
      });
      toast.success("Visita agendada!");
      setOpen(false);
      setForm({ clienteId: "", dataHora: "", observacoes: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao agendar visita");
    }
  };

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Agenda</h1>
            <p className="text-sm text-muted-foreground">Visitas agendadas de todos os clientes.</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Agendar Visita</DialogTitle>
                  <DialogDescription>Escolha o cliente e a data/hora da visita.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Cliente</Label>
                    <Select
                      value={form.clienteId}
                      onValueChange={(v) => setForm({ ...form, clienteId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dataHora">Data e hora</Label>
                    <Input
                      id="dataHora"
                      type="datetime-local"
                      value={form.dataHora}
                      onChange={(e) => setForm({ ...form, dataHora: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Input
                      id="observacoes"
                      value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createVisita.isPending || !form.clienteId || !form.dataHora}
                    className="w-full"
                  >
                    {createVisita.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Agendar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-3 sm:p-6">
                <Calendar
                  mode="single"
                  locale={ptBR}
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  components={{ DayButton: CompactDayButton }}
                  classNames={{
                    root: "w-full",
                    week: "mt-1 flex w-full gap-1",
                    day: "group/day relative flex-1 select-none p-0 text-center",
                  }}
                  modifiers={{ hasVisit: datasComVisita }}
                  modifiersClassNames={{
                    hasVisit:
                      "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-[color:var(--amber-seal)]",
                  }}
                  className="w-full [--cell-size:2.75rem]"
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
