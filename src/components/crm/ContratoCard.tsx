import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useCrmPropostaAtual } from "@/hooks/useCrmPropostas";
import { useCrmContratoAtual, useObterOuCriarContrato, type CrmContratoStatus } from "@/hooks/useCrmContratos";
import { toast } from "sonner";

const STATUS_LABEL: Record<CrmContratoStatus, string> = {
  rascunho: "Rascunho",
  gerado: "Gerado",
  enviado: "Aguardando assinatura",
  assinado: "Assinado",
  cancelado: "Cancelado",
};

const STATUS_VARIANT: Record<CrmContratoStatus, "default" | "secondary" | "outline" | "destructive"> = {
  rascunho: "outline",
  gerado: "secondary",
  enviado: "secondary",
  assinado: "default",
  cancelado: "destructive",
};

export function ContratoCard({ oportunidadeId }: { oportunidadeId: string }) {
  const navigate = useNavigate();
  const { data: proposta } = useCrmPropostaAtual(oportunidadeId);
  const { data: contrato, isLoading } = useCrmContratoAtual(oportunidadeId);
  const obterOuCriar = useObterOuCriarContrato();

  const propostaAceitaId = proposta?.status === "aceita" ? proposta.id : undefined;

  const handleCriarOuAbrir = async () => {
    if (!propostaAceitaId) return;
    try {
      const { contratoId } = await obterOuCriar.mutateAsync({ propostaId: propostaAceitaId, oportunidadeId });
      navigate({ to: "/crm/oportunidades/$id/contrato/visualizar", params: { id: oportunidadeId }, search: { contratoId } });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao abrir contrato");
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
        <CardTitle className="text-base">Contrato</CardTitle>
      </CardHeader>
      <CardContent>
        {!contrato && !propostaAceitaId && (
          <p className="text-sm text-muted-foreground">
            O contrato só pode ser gerado depois que a proposta comercial for aceita pelo cliente.
          </p>
        )}
        {!contrato && propostaAceitaId && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Proposta aceita — pronto para gerar o contrato.</p>
            <Button size="sm" onClick={handleCriarOuAbrir} disabled={obterOuCriar.isPending}>
              {obterOuCriar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Contrato"}
            </Button>
          </div>
        )}
        {contrato && (
          <div className="space-y-3 text-sm">
            <Badge variant={STATUS_VARIANT[contrato.status]}>{STATUS_LABEL[contrato.status]}</Badge>
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate({ to: "/crm/oportunidades/$id/contrato/visualizar", params: { id: oportunidadeId }, search: { contratoId: contrato.id } })}
              >
                {contrato.status === "rascunho" ? "Editar" : "Visualizar"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
