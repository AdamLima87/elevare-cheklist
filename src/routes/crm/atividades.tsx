import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useCrmTiposAtividade } from "@/hooks/useCrmCatalogos";
import { useCrmAtividadesTodas, useConcluirCrmAtividade, type CrmAtividade } from "@/hooks/useCrmAtividades";
import { isProximaAcaoObrigatoriaError } from "@/hooks/useCrmOportunidades";
import { NextActionRequiredDialog } from "@/components/crm/NextActionRequiredDialog";

export const Route = createFileRoute("/crm/atividades")({
  head: () => ({
    meta: [
      { title: "Atividades · CRM Comercial · RDCheck" },
      { name: "description", content: "Todas as atividades pendentes e concluídas do CRM Comercial." },
    ],
  }),
  component: CrmAtividadesPage,
});

function CrmAtividadesPage() {
  const { data: atividades = [], isLoading } = useCrmAtividadesTodas();
  const { data: tiposAtividade = [] } = useCrmTiposAtividade();
  const concluirAtividade = useConcluirCrmAtividade();
  const [concluindoId, setConcluindoId] = useState<string | null>(null);

  const handleConcluir = async (atividade: CrmAtividade) => {
    try {
      await concluirAtividade.mutateAsync({ id: atividade.id, resultado: "Concluída" });
      toast.success("Atividade concluída!");
    } catch (error: any) {
      if (isProximaAcaoObrigatoriaError(error)) {
        setConcluindoId(atividade.id);
        return;
      }
      toast.error(error.message || "Erro ao concluir atividade");
    }
  };

  const handleConfirmarProximaAcao = async (tipoId: string, vencimentoIso: string) => {
    if (!concluindoId) return;
    try {
      await concluirAtividade.mutateAsync({
        id: concluindoId,
        resultado: "Concluída",
        nova_atividade_tipo_id: tipoId,
        nova_atividade_vencimento: vencimentoIso,
      });
      toast.success("Atividade concluída e próxima agendada!");
      setConcluindoId(null);
    } catch (error: any) {
      toast.error(error.message || "Erro ao concluir atividade");
    }
  };

  const agora = Date.now();
  const pendentes = atividades.filter((a) => a.status === "pendente");
  const atrasadas = pendentes.filter((a) => new Date(a.vencimento).getTime() < agora);
  const aVencer = pendentes.filter((a) => new Date(a.vencimento).getTime() >= agora);
  const historico = atividades.filter((a) => a.status !== "pendente").slice(0, 30);

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Atividades</h1>
          <p className="text-sm text-muted-foreground">
            Todas as atividades do CRM Comercial, de todas as Contas.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : atividades.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma atividade agendada ainda.</p>
        ) : (
          <div className="space-y-6">
            {atrasadas.length > 0 && (
              <AtividadesGrupo titulo="Atrasadas" atividades={atrasadas} onConcluir={handleConcluir} atrasado />
            )}
            {aVencer.length > 0 && (
              <AtividadesGrupo titulo="Pendentes" atividades={aVencer} onConcluir={handleConcluir} />
            )}
            {historico.length > 0 && <AtividadesGrupo titulo="Histórico recente" atividades={historico} />}
          </div>
        )}

        <NextActionRequiredDialog
          open={!!concluindoId}
          onOpenChange={(v) => !v && setConcluindoId(null)}
          tiposAtividade={tiposAtividade}
          onConfirm={handleConfirmarProximaAcao}
          isPending={concluirAtividade.isPending}
          title="Agende a próxima ação"
          description="Esta é a última atividade pendente de uma oportunidade em aberto. Agende a próxima antes de concluir."
        />
      </AppShell>
    </ProtectedRoute>
  );
}

function AtividadesGrupo({
  titulo,
  atividades,
  onConcluir,
  atrasado,
}: {
  titulo: string;
  atividades: (CrmAtividade & { crm_empresas?: { razao_social: string } | null })[];
  onConcluir?: (atividade: CrmAtividade) => void;
  atrasado?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{titulo}</p>
      <div className="space-y-2">
        {atividades.map((atividade) => (
          <Card key={atividade.id} className={atividade.status !== "pendente" ? "opacity-70" : undefined}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{atividade.crm_tipos_atividade?.nome}</p>
                  {atrasado && <Badge variant="destructive">Atrasada</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {atividade.crm_empresas?.razao_social && (
                    <Link to="/crm/empresas/$id" params={{ id: atividade.crm_empresa_id }} className="hover:underline">
                      {atividade.crm_empresas.razao_social}
                    </Link>
                  )}
                  {" · "}
                  {new Date(atividade.vencimento).toLocaleString("pt-BR")}
                  {atividade.observacoes ? ` · ${atividade.observacoes}` : ""}
                  {atividade.resultado ? ` · ${atividade.resultado}` : ""}
                </p>
              </div>
              {onConcluir ? (
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => onConcluir(atividade)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                </Button>
              ) : (
                <Badge variant="outline" className="shrink-0">
                  {atividade.status === "concluida" ? "Concluída" : "Cancelada"}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
