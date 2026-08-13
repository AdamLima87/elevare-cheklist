import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Download, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useCrmProposta,
  useCrmPropostaItens,
  useCrmPropostasHistorico,
  useMarcarPropostaEnviada,
  useRegistrarAceiteProposta,
  useCriarRevisaoProposta,
  type CrmPropostaAceiteForma,
} from "@/hooks/useCrmPropostas";
import { useCrmOportunidade } from "@/hooks/useCrmOportunidades";
import { useGerarLinkDocumento } from "@/hooks/useCrmDocumentosLinks";
import { gerarPdfProposta } from "@/lib/pdf-proposta";
import { enviarEmailComercial } from "@/lib/enviar-email-comercial";

export const Route = createFileRoute("/crm/oportunidades/$id_/proposta/visualizar")({
  validateSearch: (search: Record<string, unknown>) => ({ propostaId: String(search.propostaId ?? "") }),
  head: () => ({ meta: [{ title: "Proposta · CRM Comercial · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <PropostaVisualizarPage />
    </ProtectedRoute>
  ),
});

function formatMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PropostaVisualizarPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/crm/oportunidades/$id_/proposta/visualizar" });
  const { propostaId } = useSearch({ from: "/crm/oportunidades/$id_/proposta/visualizar" });

  const { data: oportunidade } = useCrmOportunidade(id);
  const { data: proposta, isLoading } = useCrmProposta(propostaId);
  const { data: itens } = useCrmPropostaItens(propostaId);
  const { data: historico } = useCrmPropostasHistorico(id);
  const marcarEnviada = useMarcarPropostaEnviada();
  const registrarAceite = useRegistrarAceiteProposta();
  const criarRevisao = useCriarRevisaoProposta();
  const gerarLink = useGerarLinkDocumento();

  const [aceiteForma, setAceiteForma] = useState<CrmPropostaAceiteForma>("email");
  const [aceiteObs, setAceiteObs] = useState("");
  const [aceiteOpen, setAceiteOpen] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);

  const clienteNome = oportunidade?.crm_empresas?.nome_fantasia || oportunidade?.crm_empresas?.razao_social || "";

  const handleBaixarPdf = async () => {
    if (!proposta || !itens) return;
    const blob = await gerarPdfProposta({
      numeroRevisao: proposta.numero_revisao,
      clienteNome,
      itens: itens.map((i) => ({ nome: i.nome, descricao: i.descricao, valor: i.valor })),
      valorTotal: proposta.valor_total,
      status: proposta.status,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Proposta_Revisao${proposta.numero_revisao}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEnviar = async () => {
    // window.prompt pode não estar disponível em todo contexto (ex.: alguns
    // navegadores headless/sandboxed) — nunca deixar isso quebrar a transição
    // de estado real (marcarEnviada), que é o que importa de verdade aqui.
    let emailCliente: string | null = null;
    try {
      emailCliente = window.prompt("E-mail do cliente para enviar a proposta (deixe em branco para só marcar como enviada, sem e-mail):");
    } catch {
      emailCliente = null;
    }
    try {
      if (emailCliente && emailCliente.trim()) {
        const { url } = await gerarLink.mutateAsync({ tipo: "proposta", id: propostaId });
        const resultado = await enviarEmailComercial({
          templateName: "proposta-disponivel",
          recipientEmail: emailCliente.trim(),
          templateData: { cliente_nome: clienteNome, numero_revisao: proposta?.numero_revisao, link_documento: url },
        });
        if (!resultado.success) toast.error(`Não foi possível enviar o e-mail: ${resultado.reason}`);
      }
      await marcarEnviada.mutateAsync({ propostaId, oportunidadeId: id, canal: emailCliente ? "email" : null });
      toast.success("Proposta marcada como enviada!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao marcar como enviada");
    }
  };

  const handleAceite = async () => {
    try {
      await registrarAceite.mutateAsync({ propostaId, oportunidadeId: id, forma: aceiteForma, observacao: aceiteObs || null });
      toast.success("Aceite registrado!");
      setAceiteOpen(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao registrar aceite");
    }
  };

  const handleNovaRevisao = async () => {
    try {
      const { novaPropostaId } = await criarRevisao.mutateAsync({ propostaId, oportunidadeId: id });
      navigate({ to: "/crm/oportunidades/$id/proposta/editar", params: { id }, search: { propostaId: novaPropostaId } });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar revisão");
    }
  };

  const handleGerarLink = async () => {
    try {
      const { url } = await gerarLink.mutateAsync({ tipo: "proposta", id: propostaId });
      setLinkGerado(url);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar link");
    }
  };

  if (isLoading || !proposta) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/crm/oportunidades/$id", params: { id } })} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar à Oportunidade
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Proposta — Revisão {proposta.numero_revisao}</h1>
          <Badge>{proposta.status}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {itens?.map((item) => (
              <div key={item.id} className="flex justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="font-medium">{item.nome}</p>
                  {item.descricao && <p className="text-xs text-muted-foreground">{item.descricao}</p>}
                </div>
                <p>{formatMoeda(item.valor)}</p>
              </div>
            ))}
            <p className="pt-2 text-right text-lg font-semibold">Total: {formatMoeda(proposta.valor_total)}</p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleBaixarPdf} className="gap-1.5">
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
          {proposta.status === "gerada" && (
            <Button onClick={handleEnviar} disabled={marcarEnviada.isPending}>
              {marcarEnviada.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Marcar como enviada"}
            </Button>
          )}
          {(proposta.status === "gerada" || proposta.status === "enviada") && (
            <>
              <Dialog open={aceiteOpen} onOpenChange={setAceiteOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">Registrar aceite</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar aceite da proposta</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Forma</Label>
                      <Select value={aceiteForma} onValueChange={(v) => setAceiteForma(v as CrmPropostaAceiteForma)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="assinatura_da_proposta">Assinatura da proposta</SelectItem>
                          <SelectItem value="verbal_registrado">Verbal registrado</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Observação (opcional)</Label>
                      <Textarea value={aceiteObs} onChange={(e) => setAceiteObs(e.target.value)} />
                    </div>
                    <Button onClick={handleAceite} disabled={registrarAceite.isPending} className="w-full">
                      {registrarAceite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar aceite"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={handleNovaRevisao} disabled={criarRevisao.isPending}>
                Criar nova revisão
              </Button>
              <Button variant="outline" onClick={handleGerarLink} disabled={gerarLink.isPending} className="gap-1.5">
                <LinkIcon className="h-4 w-4" /> Gerar link público
              </Button>
            </>
          )}
        </div>

        {linkGerado && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="font-medium">Link gerado (copie agora — não será mostrado de novo):</p>
            <p className="break-all text-xs">{linkGerado}</p>
          </div>
        )}

        {historico && historico.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de revisões</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {historico.map((h) => (
                <button
                  key={h.id}
                  className="flex w-full items-center justify-between rounded border p-2 text-left hover:bg-muted"
                  onClick={() => navigate({ to: "/crm/oportunidades/$id/proposta/visualizar", params: { id }, search: { propostaId: h.id } })}
                >
                  <span>Revisão {h.numero_revisao}</span>
                  <Badge variant="outline">{h.status}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
