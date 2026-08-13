import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCrmServicosCatalogo } from "@/hooks/useCrmServicosCatalogo";
import { useCrmProposta, useCrmPropostaItens, useSalvarItensProposta, useMarcarPropostaGerada } from "@/hooks/useCrmPropostas";

export const Route = createFileRoute("/crm/oportunidades/$id_/proposta/editar")({
  validateSearch: (search: Record<string, unknown>) => ({ propostaId: String(search.propostaId ?? "") }),
  head: () => ({ meta: [{ title: "Editar Proposta · CRM Comercial · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <PropostaEditarPage />
    </ProtectedRoute>
  ),
});

interface ItemForm {
  servico_catalogo_id: string | null;
  nome: string;
  descricao: string;
  valor: number;
  ordem: number;
}

function formatMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PropostaEditarPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/crm/oportunidades/$id_/proposta/editar" });
  const { propostaId } = useSearch({ from: "/crm/oportunidades/$id_/proposta/editar" });

  const { data: proposta, isLoading: loadingProposta } = useCrmProposta(propostaId);
  const { data: itensSalvos, isLoading: loadingItens } = useCrmPropostaItens(propostaId);
  const { data: catalogo } = useCrmServicosCatalogo();
  const salvarItens = useSalvarItensProposta();
  const marcarGerada = useMarcarPropostaGerada();

  const [itens, setItens] = useState<ItemForm[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!carregado && itensSalvos) {
      setItens(
        itensSalvos.length
          ? itensSalvos.map((i) => ({ servico_catalogo_id: i.servico_catalogo_id, nome: i.nome, descricao: i.descricao ?? "", valor: i.valor, ordem: i.ordem }))
          : [],
      );
      setCarregado(true);
    }
  }, [itensSalvos, carregado]);

  const naoEditavel = proposta && proposta.status !== "rascunho";
  const valorTotal = itens.reduce((acc, i) => acc + (Number(i.valor) || 0), 0);

  const toggleServico = (servicoId: string, nome: string, valorPadrao: number | null, checked: boolean) => {
    if (checked) {
      setItens((prev) => [...prev, { servico_catalogo_id: servicoId, nome, descricao: "", valor: valorPadrao ?? 0, ordem: prev.length + 1 }]);
    } else {
      setItens((prev) => prev.filter((i) => i.servico_catalogo_id !== servicoId));
    }
  };

  const atualizarItem = (index: number, patch: Partial<ItemForm>) => {
    setItens((prev) => prev.map((i, idx) => (idx === index ? { ...i, ...patch } : i)));
  };

  const removerItemAvulso = (index: number) => setItens((prev) => prev.filter((_, idx) => idx !== index));

  const adicionarItemAvulso = () => setItens((prev) => [...prev, { servico_catalogo_id: null, nome: "", descricao: "", valor: 0, ordem: prev.length + 1 }]);

  const handleSalvar = async () => {
    try {
      await salvarItens.mutateAsync({ propostaId, oportunidadeId: id, itens: itens.filter((i) => i.nome.trim()) });
      toast.success("Itens salvos!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar itens");
    }
  };

  const handleGerar = async () => {
    try {
      await handleSalvar();
      await marcarGerada.mutateAsync({ propostaId, oportunidadeId: id });
      toast.success("Proposta gerada!");
      navigate({ to: "/crm/oportunidades/$id/proposta/visualizar", params: { id }, search: { propostaId } });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar proposta");
    }
  };

  const isLoading = loadingProposta || loadingItens;

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/crm/oportunidades/$id", params: { id } })} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar à Oportunidade
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : naoEditavel ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Esta proposta não está mais em rascunho e não pode ser editada. Use "Criar nova revisão" na tela de
            visualização para renegociar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Editar Proposta — Revisão {proposta?.numero_revisao}</h1>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Serviços do catálogo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {catalogo?.map((servico) => {
                const marcado = itens.some((i) => i.servico_catalogo_id === servico.id);
                return (
                  <label key={servico.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={marcado}
                      onCheckedChange={(checked) => toggleServico(servico.id, servico.nome, servico.valor_padrao, checked === true)}
                    />
                    {servico.nome}
                  </label>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens da proposta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {itens.map((item, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 rounded border p-3 sm:grid-cols-[1fr_1fr_140px_auto]">
                  <Input placeholder="Nome" value={item.nome} onChange={(e) => atualizarItem(index, { nome: e.target.value })} />
                  <Input placeholder="Descrição" value={item.descricao} onChange={(e) => atualizarItem(index, { descricao: e.target.value })} />
                  <Input
                    type="number"
                    placeholder="Valor"
                    value={item.valor}
                    onChange={(e) => atualizarItem(index, { valor: Number(e.target.value) })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removerItemAvulso(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={adicionarItemAvulso}>
                Adicionar item avulso
              </Button>
              <p className="text-right text-lg font-semibold">Total: {formatMoeda(valorTotal)}</p>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleSalvar} disabled={salvarItens.isPending}>
              {salvarItens.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar rascunho"}
            </Button>
            <Button onClick={handleGerar} disabled={marcarGerada.isPending || itens.length === 0}>
              {marcarGerada.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar Proposta"}
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
