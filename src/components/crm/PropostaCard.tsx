import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useCrmPropostaAtual, useObterOuCriarProposta, type CrmPropostaStatus } from "@/hooks/useCrmPropostas";
import { toast } from "sonner";

function formatMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<CrmPropostaStatus, string> = {
  rascunho: "Rascunho",
  gerada: "Gerada",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  substituida: "Substituída",
  cancelada: "Cancelada",
};

const STATUS_VARIANT: Record<CrmPropostaStatus, "default" | "secondary" | "outline" | "destructive"> = {
  rascunho: "outline",
  gerada: "secondary",
  enviada: "secondary",
  aceita: "default",
  recusada: "destructive",
  substituida: "outline",
  cancelada: "destructive",
};

export function PropostaCard({ oportunidadeId }: { oportunidadeId: string }) {
  const navigate = useNavigate();
  const { data: proposta, isLoading } = useCrmPropostaAtual(oportunidadeId);
  const obterOuCriar = useObterOuCriarProposta();

  const handleCriarOuAbrir = async () => {
    try {
      const { propostaId } = await obterOuCriar.mutateAsync(oportunidadeId);
      navigate({ to: "/crm/oportunidades/$id/proposta/editar", params: { id: oportunidadeId }, search: { propostaId } });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao abrir proposta");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proposta Comercial</CardTitle>
      </CardHeader>
      <CardContent>
        {!proposta && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Nenhuma proposta criada ainda para esta oportunidade.</p>
            <Button size="sm" onClick={handleCriarOuAbrir} disabled={obterOuCriar.isPending}>
              {obterOuCriar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Proposta"}
            </Button>
          </div>
        )}
        {proposta && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[proposta.status]}>{STATUS_LABEL[proposta.status]}</Badge>
              <span className="text-xs text-muted-foreground">Revisão {proposta.numero_revisao}</span>
            </div>
            <p className="text-lg font-semibold">{formatMoeda(proposta.valor_total)}</p>
            <div className="flex flex-wrap gap-2">
              {proposta.status === "rascunho" && (
                <Button
                  size="sm"
                  onClick={() => navigate({ to: "/crm/oportunidades/$id/proposta/editar", params: { id: oportunidadeId }, search: { propostaId: proposta.id } })}
                >
                  Editar
                </Button>
              )}
              {proposta.status !== "rascunho" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate({ to: "/crm/oportunidades/$id/proposta/visualizar", params: { id: oportunidadeId }, search: { propostaId: proposta.id } })}
                >
                  Visualizar
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
