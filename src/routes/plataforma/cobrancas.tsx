import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import {
  usePlatformBillingDashboard,
  usePlatformAssinaturas,
  useBloquearAssinatura,
  useDesbloquearAssinatura,
  useReprocessarWebhookEvento,
} from "@/hooks/usePlatform";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/plataforma/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças · Administração da Plataforma · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <CobrancasPage />
      </PlatformLayout>
    </ProtectedRoute>
  ),
});

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "outline" | "destructive" }> = {
  active: { label: "Ativo", variant: "default" },
  trialing: { label: "Trial", variant: "outline" },
  past_due: { label: "Em atraso", variant: "destructive" },
  blocked: { label: "Bloqueado", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "outline" },
};

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface WebhookEventoErro {
  id: string;
  event_type: string;
  error: string | null;
  created_at: string;
}

function useWebhookEventosComErro() {
  return useQuery({
    queryKey: ["platform", "webhook-eventos-erro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_webhook_eventos")
        .select("id, event_type, error, created_at")
        .eq("status", "erro")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as WebhookEventoErro[];
    },
  });
}

function Metric({ titulo, valor, destaque }: { titulo: string; valor: number; destaque?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className={`text-2xl font-bold ${destaque && valor > 0 ? "text-destructive" : ""}`}>{valor}</p>
        <p className="text-xs text-muted-foreground">{titulo}</p>
      </CardContent>
    </Card>
  );
}

function CobrancasPage() {
  const { data: dash, isLoading: dashLoading } = usePlatformBillingDashboard();
  const { data: assinaturas = [], isLoading: assinaturasLoading } = usePlatformAssinaturas();
  const { data: eventosErro = [], isLoading: eventosLoading } = useWebhookEventosComErro();
  const reprocessar = useReprocessarWebhookEvento();
  const [filtro, setFiltro] = useState<string>("atencao");
  const [acaoAlvo, setAcaoAlvo] = useState<{ empresaId: string; empresaNome: string; tipo: "bloquear" | "desbloquear" } | null>(null);

  const assinaturasFiltradas = assinaturas.filter((a) => {
    if (filtro === "todos") return true;
    if (filtro === "atencao") return ["past_due", "blocked"].includes(a.status);
    return a.status === filtro;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Cobranças</h1>
        <p className="text-sm text-muted-foreground">Visão global de assinaturas, inadimplência e eventos de pagamento.</p>
      </div>

      {dashLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : dash ? (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric titulo="Trials ativos" valor={dash.trials_ativos} />
          <Metric titulo="Trials expirando (3d)" valor={dash.trials_expirando_em_breve} />
          <Metric titulo="Trials expirados" valor={dash.trials_expirados} destaque />
          <Metric titulo="Assinaturas ativas" valor={dash.assinaturas_ativas} />
          <Metric titulo="Cancelados" valor={dash.cancelados} />
          <Metric titulo="Inadimplentes (1-6d)" valor={dash.inadimplentes_1_a_6} destaque />
          <Metric titulo="Inadimplentes (7-14d)" valor={dash.inadimplentes_7_a_14} destaque />
          <Metric titulo="Bloqueados" valor={dash.bloqueados} destaque />
          <Metric titulo="Falhas de webhook" valor={dash.webhooks_com_erro} destaque />
        </div>
      ) : null}

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Assinaturas</CardTitle>
          <div className="flex gap-1.5">
            {["atencao", "todos", "trialing", "active", "past_due", "blocked", "canceled"].map((f) => (
              <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} onClick={() => setFiltro(f)}>
                {f === "atencao" ? "Precisa atenção" : f === "todos" ? "Todos" : STATUS_LABEL[f]?.label ?? f}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {assinaturasLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Empresa</TableHead>
                    <TableHead className="font-bold">Plano</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold">Trial até</TableHead>
                    <TableHead className="font-bold">Próx. cobrança</TableHead>
                    <TableHead className="font-bold">Em atraso desde</TableHead>
                    <TableHead className="font-bold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assinaturasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Nenhuma assinatura neste filtro.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assinaturasFiltradas.map((a) => (
                      <TableRow key={a.empresa_id}>
                        <TableCell className="py-3 font-medium">{a.empresa_nome}</TableCell>
                        <TableCell className="text-sm capitalize">
                          {a.plano_codigo}
                          {a.periodicidade ? ` · ${a.periodicidade}` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_LABEL[a.status]?.variant ?? "outline"}>
                            {STATUS_LABEL[a.status]?.label ?? a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtData(a.trial_ends_at)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtData(a.current_period_end)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtData(a.past_due_since)}</TableCell>
                        <TableCell className="text-right">
                          {a.status === "blocked" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => setAcaoAlvo({ empresaId: a.empresa_id, empresaNome: a.empresa_nome, tipo: "desbloquear" })}
                            >
                              <Unlock className="h-3.5 w-3.5" /> Desbloquear
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 text-destructive hover:text-destructive"
                              onClick={() => setAcaoAlvo({ empresaId: a.empresa_id, empresaNome: a.empresa_nome, tipo: "bloquear" })}
                            >
                              <Lock className="h-3.5 w-3.5" /> Bloquear
                            </Button>
                          )}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Falhas de webhook aguardando reprocessamento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {eventosLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Quando</TableHead>
                    <TableHead className="font-bold">Evento</TableHead>
                    <TableHead className="font-bold">Erro</TableHead>
                    <TableHead className="font-bold text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventosErro.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                        Nenhuma falha pendente.
                      </TableCell>
                    </TableRow>
                  ) : (
                    eventosErro.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{e.event_type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">{e.error}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={reprocessar.isPending}
                            onClick={async () => {
                              try {
                                await reprocessar.mutateAsync(e.id);
                                toast.success("Evento reprocessado com sucesso.");
                              } catch (err: any) {
                                toast.error(err.message || "Falha ao reprocessar. Veja o erro atualizado na lista.");
                              }
                            }}
                          >
                            {reprocessar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Reprocessar
                          </Button>
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

      <AcaoBloqueioDialog acao={acaoAlvo} onOpenChange={(v) => !v && setAcaoAlvo(null)} />
    </div>
  );
}

function AcaoBloqueioDialog({
  acao,
  onOpenChange,
}: {
  acao: { empresaId: string; empresaNome: string; tipo: "bloquear" | "desbloquear" } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const bloquear = useBloquearAssinatura();
  const desbloquear = useDesbloquearAssinatura();
  const [motivo, setMotivo] = useState("");

  if (!acao) return null;
  const pending = bloquear.isPending || desbloquear.isPending;

  const handleConfirmar = async () => {
    if (!motivo.trim()) return;
    try {
      if (acao.tipo === "bloquear") {
        await bloquear.mutateAsync({ empresaId: acao.empresaId, motivo: motivo.trim() });
        toast.success("Empresa bloqueada.");
      } else {
        await desbloquear.mutateAsync({ empresaId: acao.empresaId, motivo: motivo.trim() });
        toast.success("Empresa desbloqueada.");
      }
      setMotivo("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao aplicar a ação.");
    }
  };

  return (
    <Dialog open={!!acao} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{acao.tipo === "bloquear" ? "Bloquear" : "Desbloquear"} {acao.empresaNome}</DialogTitle>
          <DialogDescription>Toda ação manual de bloqueio/desbloqueio exige motivo e fica registrada na Auditoria.</DialogDescription>
        </DialogHeader>
        <Input placeholder="Motivo (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <DialogFooter>
          <Button onClick={handleConfirmar} disabled={!motivo.trim() || pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
