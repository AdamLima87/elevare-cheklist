import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Download, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useCrmContrato,
  useMarcarContratoGerado,
  useMarcarContratoEnviado,
  useMarcarContratoAssinado,
  useCancelarContrato,
} from "@/hooks/useCrmContratos";
import { useCrmOportunidade } from "@/hooks/useCrmOportunidades";
import { useGerarLinkDocumento } from "@/hooks/useCrmDocumentosLinks";
import { gerarPdfContrato } from "@/lib/pdf-contrato";
import { enviarEmailComercial } from "@/lib/enviar-email-comercial";

export const Route = createFileRoute("/crm/oportunidades/$id_/contrato/visualizar")({
  validateSearch: (search: Record<string, unknown>) => ({ contratoId: String(search.contratoId ?? "") }),
  head: () => ({ meta: [{ title: "Contrato · CRM Comercial · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <ContratoVisualizarPage />
    </ProtectedRoute>
  ),
});

function ContratoVisualizarPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/crm/oportunidades/$id_/contrato/visualizar" });
  const { contratoId } = useSearch({ from: "/crm/oportunidades/$id_/contrato/visualizar" });

  const { data: oportunidade } = useCrmOportunidade(id);
  const { data: contrato, isLoading } = useCrmContrato(contratoId);
  const marcarGerado = useMarcarContratoGerado();
  const marcarEnviado = useMarcarContratoEnviado();
  const marcarAssinado = useMarcarContratoAssinado();
  const cancelar = useCancelarContrato();
  const gerarLink = useGerarLinkDocumento();

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [assinarOpen, setAssinarOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);

  const clienteNome = oportunidade?.crm_empresas?.nome_fantasia || oportunidade?.crm_empresas?.razao_social || "";

  const handleBaixarPdf = async () => {
    if (!contrato?.dados) return;
    const blob = await gerarPdfContrato({
      clienteNome,
      secoes: contrato.dados.conteudo_renderizado,
      status: contrato.status,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Contrato_${clienteNome || "cliente"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGerar = async () => {
    try {
      await marcarGerado.mutateAsync({ contratoId, oportunidadeId: id });
      toast.success("Contrato gerado — conteúdo congelado a partir de agora.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar contrato");
    }
  };

  const handleEnviar = async () => {
    let emailCliente: string | null = null;
    try {
      emailCliente = window.prompt("E-mail do cliente para enviar o contrato (deixe em branco para só marcar como enviado, sem e-mail):");
    } catch {
      emailCliente = null;
    }
    try {
      if (emailCliente && emailCliente.trim()) {
        const { url } = await gerarLink.mutateAsync({ tipo: "contrato", id: contratoId });
        const resultado = await enviarEmailComercial({
          templateName: "contrato-disponivel",
          recipientEmail: emailCliente.trim(),
          templateData: { cliente_nome: clienteNome, link_documento: url },
        });
        if (!resultado.success) toast.error(`Não foi possível enviar o e-mail: ${resultado.reason}`);
      }
      await marcarEnviado.mutateAsync({ contratoId, oportunidadeId: id });
      toast.success("Contrato marcado como enviado (aguardando assinatura).");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao marcar como enviado");
    }
  };

  const handleAssinar = async () => {
    if (!arquivo && !justificativa.trim()) {
      toast.error("Envie o arquivo assinado ou informe uma justificativa.");
      return;
    }
    setEnviando(true);
    try {
      let arquivoPath: string | null = null;
      if (arquivo && contrato) {
        arquivoPath = `${contrato.empresa_id}/contratos/${contrato.id}/assinados/${Date.now()}_${arquivo.name}`;
        const { error: uploadError } = await supabase.storage.from("crm-comercial-anexos").upload(arquivoPath, arquivo);
        if (uploadError) throw uploadError;
      }
      await marcarAssinado.mutateAsync({ contratoId, oportunidadeId: id, arquivoPath, justificativa: justificativa || null });
      toast.success("Contrato marcado como assinado!");
      setAssinarOpen(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao marcar como assinado");
    } finally {
      setEnviando(false);
    }
  };

  const handleCancelar = async () => {
    try {
      await cancelar.mutateAsync({ contratoId, oportunidadeId: id, motivo: "Cancelado pelo consultor" });
      toast.success("Contrato cancelado.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao cancelar contrato");
    }
  };

  const handleGerarLink = async () => {
    try {
      const { url } = await gerarLink.mutateAsync({ tipo: "contrato", id: contratoId });
      setLinkGerado(url);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar link");
    }
  };

  if (isLoading || !contrato) {
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
          <h1 className="text-2xl font-semibold">Contrato</h1>
          <Badge>{contrato.status === "enviado" ? "Aguardando assinatura" : contrato.status}</Badge>
        </div>

        {contrato.dados?.conteudo_renderizado && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conteúdo do contrato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {contrato.dados.conteudo_renderizado.map((secao, i) => (
                <div key={i}>
                  <p className="font-semibold">{secao.titulo}</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{secao.corpo}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleBaixarPdf} className="gap-1.5">
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
          {contrato.status === "rascunho" && (
            <Button onClick={handleGerar} disabled={marcarGerado.isPending}>
              {marcarGerado.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar Contrato"}
            </Button>
          )}
          {contrato.status === "gerado" && (
            <Button onClick={handleEnviar} disabled={marcarEnviado.isPending}>
              {marcarEnviado.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Marcar como enviado"}
            </Button>
          )}
          {contrato.status === "enviado" && (
            <Dialog open={assinarOpen} onOpenChange={setAssinarOpen}>
              <DialogTrigger asChild>
                <Button>Marcar como assinado</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Marcar contrato como assinado</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Arquivo assinado (opcional se houver justificativa)</Label>
                    <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="text-sm" />
                  </div>
                  <div>
                    <Label>Justificativa (opcional se houver arquivo)</Label>
                    <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Ex: assinatura física, arquivo será anexado depois" />
                  </div>
                  <Button onClick={handleAssinar} disabled={enviando} className="w-full">
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar assinatura"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {contrato.status !== "assinado" && contrato.status !== "cancelado" && (
            <Button variant="destructive" onClick={handleCancelar} disabled={cancelar.isPending}>
              Cancelar contrato
            </Button>
          )}
          {contrato.status !== "rascunho" && (
            <Button variant="outline" onClick={handleGerarLink} disabled={gerarLink.isPending} className="gap-1.5">
              <LinkIcon className="h-4 w-4" /> Gerar link público
            </Button>
          )}
        </div>

        {linkGerado && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="font-medium">Link gerado (copie agora — não será mostrado de novo):</p>
            <p className="break-all text-xs">{linkGerado}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
