import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { UFS } from "@/hooks/useIbgeLocalidades";
import { useAtividadeTags } from "@/hooks/useAtividadeTags";
import { useChecklistModelosDisponiveis } from "@/hooks/useChecklistModelosDisponiveis";
import { recomendarModelo, type ResultadoRecomendacao } from "@/lib/checklist-modelo-recomendacao";
import { ChecklistModeloPicker } from "@/components/elevare/ChecklistModeloPicker";
import type { DecisaoMultiplosEscoposPayload } from "@/components/elevare/MultiplosEscoposDecisao";
import type { RecomendacaoLegislacaoSnapshot } from "@/lib/storage";

/** O que este componente já sabe calcular — `modeloEscolhidoId`/`seguiuRecomendacao`
 * só existem depois que `NovaInspecaoForm` sabe qual modelo foi de fato criado. */
export type ContextoRecomendacaoSnapshot = Omit<
  RecomendacaoLegislacaoSnapshot,
  "modeloEscolhidoId" | "seguiuRecomendacao"
>;

const VERSAO_REGRA = "9.D-v1";
const VERSAO_REGRA_DECISAO = "9.G-v1";

/**
 * Fase 9.D — bloco de contexto (UF + atividades desta inspeção) + picker de
 * legislação com recomendação. UF/atividades nunca são persistidas em
 * `clientes` (Fase 9.A/9.B: nada garante 1 unidade física por cliente) — só
 * existem aqui, nesta sessão, e viram snapshot histórico dentro da própria
 * inspeção. A sugestão da inspeção anterior do mesmo cliente é só um ponto
 * de partida ajustável, nunca uma decisão automática.
 */
export function ContextoLegislacaoPicker({
  clienteId,
  ufPrefillCrm,
  onSelecionar,
}: {
  clienteId?: string;
  /** UF vinda de CrmEmpresa.estado, no fluxo de Diagnóstico do CRM. */
  ufPrefillCrm?: string | null;
  onSelecionar: (modeloVersaoId: string, snapshot: ContextoRecomendacaoSnapshot) => void;
}) {
  const { data: atividadeTags } = useAtividadeTags();
  const { data: modelos } = useChecklistModelosDisponiveis();

  const { data: inspecaoAnterior } = useQuery({
    queryKey: ["inspecao-anterior-contexto", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data } = await supabase
        .from("inspecoes")
        .select("dados")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { dados: any } | null;
    },
    enabled: Boolean(clienteId),
    staleTime: 60_000,
  });

  const [uf, setUf] = useState<string | null>(null);
  const [ufOrigem, setUfOrigem] = useState<ContextoRecomendacaoSnapshot["ufOrigem"]>(null);
  const [atividades, setAtividades] = useState<string[]>([]);
  const [atividadesOrigem, setAtividadesOrigem] =
    useState<ContextoRecomendacaoSnapshot["atividadesOrigem"]>(null);
  const [ajustadoManualmente, setAjustadoManualmente] = useState(false);

  // Prefill não-decisório: só roda uma vez, quando os dados de sugestão
  // chegam, e nunca sobrescreve o que o consultor já tiver ajustado.
  useEffect(() => {
    if (ajustadoManualmente) return;
    if (uf === null && ufPrefillCrm) {
      setUf(ufPrefillCrm);
      setUfOrigem("crm_conta");
    }
    const anteriorUf = inspecaoAnterior?.dados?.estabelecimento?.uf;
    if (uf === null && !ufPrefillCrm && anteriorUf) {
      setUf(anteriorUf);
      setUfOrigem("sugestao_inspecao_anterior_ajustada");
    }
    const anteriorAtividades: string[] | undefined =
      inspecaoAnterior?.dados?.recomendacaoLegislacao?.atividadesConsideradas;
    if (atividades.length === 0 && anteriorAtividades?.length) {
      setAtividades(anteriorAtividades);
      setAtividadesOrigem("sugestao_inspecao_anterior_ajustada");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspecaoAnterior, ufPrefillCrm]);

  const toggleAtividade = (codigo: string, marcado: boolean) => {
    setAjustadoManualmente(true);
    setAtividadesOrigem("inspecao_atual");
    setAtividades((prev) => (marcado ? [...prev, codigo] : prev.filter((c) => c !== codigo)));
  };

  const handleUfChange = (value: string) => {
    setAjustadoManualmente(true);
    setUf(value);
    setUfOrigem("inspecao_atual");
  };

  const resultado = useMemo<ResultadoRecomendacao>(() => {
    if (!modelos) return { tipo: "nenhuma" };
    return recomendarModelo({
      ufConsiderada: uf,
      atividadesConsideradas: atividades,
      dataInspecao: new Date().toISOString(),
      modelosDisponiveis: modelos.map((m) => ({
        modeloVersaoId: m.modeloVersaoId,
        codigo: m.codigo,
        vigenteDesde: m.vigenteDesde,
      })),
    });
  }, [modelos, uf, atividades]);

  const handleSelecionarModelo = (modeloVersaoId: string, decisaoMultiplosEscopos?: DecisaoMultiplosEscoposPayload) => {
    onSelecionar(modeloVersaoId, {
      ufConsiderada: uf,
      ufOrigem,
      atividadesConsideradas: atividades,
      atividadesOrigem,
      resultado,
      dataCalculo: new Date().toISOString(),
      versaoRegra: VERSAO_REGRA,
      ...(decisaoMultiplosEscopos
        ? {
            multiplosEscoposIdentificados: true,
            escoposIdentificados: atividades.filter((a) =>
              ["servico_alimentacao", "comercio_alimentos", "producao_industrializacao"].includes(a),
            ),
            decisaoMultiplosEscopos: decisaoMultiplosEscopos.decisao,
            modeloSelecionadoParaInspecaoAtual: decisaoMultiplosEscopos.modeloSelecionadoParaInspecaoAtual,
            modelosSugeridos: decisaoMultiplosEscopos.modelosSugeridos,
            modeloOuEscopoNaoInspecionado: decisaoMultiplosEscopos.modeloOuEscopoNaoInspecionado,
            justificativaCodigo: decisaoMultiplosEscopos.justificativaCodigo,
            justificativaTexto: decisaoMultiplosEscopos.justificativaTexto,
            segundoEscopoPendente: decisaoMultiplosEscopos.segundoEscopoPendente,
            segundaInspecaoId: null,
            decisaoDataHora: new Date().toISOString(),
            versaoRegraDecisao: VERSAO_REGRA_DECISAO,
          }
        : {}),
    });
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Localização e atividades (opcional)</CardTitle>
          <CardDescription>
            Ajuda a recomendar a legislação aplicável. Você pode pular e escolher manualmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              UF do estabelecimento
            </Label>
            <Select value={uf ?? undefined} onValueChange={handleUfChange}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Selecione a UF" />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((u) => (
                  <SelectItem key={u.sigla} value={u.sigla}>
                    {u.sigla} — {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {atividadeTags && atividadeTags.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Atividades exercidas neste estabelecimento
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {atividadeTags.map((tag) => (
                  <label key={tag.codigo} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={atividades.includes(tag.codigo)}
                      onCheckedChange={(checked) => toggleAtividade(tag.codigo, checked === true)}
                    />
                    {tag.nome}
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ChecklistModeloPicker onSelecionar={handleSelecionarModelo} recomendacao={resultado} />
    </div>
  );
}
