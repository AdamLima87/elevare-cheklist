import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CODIGO_RDC_275,
  JUSTIFICATIVA_OPCOES,
  type DecisaoMultiplosEscopos,
  type JustificativaCodigo,
  type ResultadoRecomendacao,
  type Sugestao,
} from "@/lib/checklist-modelo-recomendacao";
import { resolverDecisaoMultiplosEscopos } from "@/lib/multiplos-escopos-decisao";
import type { ChecklistModeloDisponivel } from "@/hooks/useChecklistModelosDisponiveis";

export interface DecisaoMultiplosEscoposPayload {
  modeloVersaoId: string;
  decisao: DecisaoMultiplosEscopos;
  modeloSelecionadoParaInspecaoAtual: string;
  modeloOuEscopoNaoInspecionado: string | null;
  modelosSugeridos: Sugestao[];
  justificativaCodigo: JustificativaCodigo | null;
  justificativaTexto: string | null;
  segundoEscopoPendente: boolean;
}

/**
 * Fase 9.G — quando o motor de recomendação detecta múltiplos escopos
 * regulatórios (comércio/serviço + produção/industrialização), o sistema
 * nunca escolhe uma norma sozinho E não deixa o consultor simplesmente
 * ignorar o alerta: uma das 4 opções abaixo precisa ser resolvida (com
 * confirmação e/ou justificativa estruturada, conforme a opção) antes do
 * botão "Continuar" habilitar. Nunca funde CVS 3/2026 com RDC 275/2002 numa
 * única inspeção — cada decisão resulta em exatamente um modeloVersaoId.
 */
export function MultiplosEscoposDecisao({
  recomendacao,
  modelos,
  onContinuar,
}: {
  recomendacao: Extract<ResultadoRecomendacao, { tipo: "multiplos_escopos" }>;
  modelos: ChecklistModeloDisponivel[];
  onContinuar: (payload: DecisaoMultiplosEscoposPayload) => void;
}) {
  const sugestaoProducao = useMemo(
    () =>
      recomendacao.sugestoes.find(
        (s) => modelos.find((m) => m.modeloVersaoId === s.modeloId)?.codigo === CODIGO_RDC_275,
      ) ?? null,
    [recomendacao.sugestoes, modelos],
  );
  const sugestaoComercioServico = useMemo(
    () => recomendacao.sugestoes.find((s) => s.modeloId !== sugestaoProducao?.modeloId) ?? null,
    [recomendacao.sugestoes, sugestaoProducao],
  );

  const nomeModelo = (modeloId: string | null | undefined) =>
    modeloId ? (modelos.find((m) => m.modeloVersaoId === modeloId)?.nome ?? modeloId) : null;

  const [decisao, setDecisao] = useState<DecisaoMultiplosEscopos | null>(null);
  const [primeiroEscopoOpcao3, setPrimeiroEscopoOpcao3] = useState<"comercio_servico" | "producao" | null>(null);
  const [modeloManualOpcao4, setModeloManualOpcao4] = useState<string | null>(null);
  const [confirmacaoDelimitacao, setConfirmacaoDelimitacao] = useState(false);
  const [justificativaCodigo, setJustificativaCodigo] = useState<JustificativaCodigo | null>(null);
  const [justificativaTexto, setJustificativaTexto] = useState("");

  // Reseta os campos condicionais ao trocar de opção — evita carregar
  // confirmação/justificativa de uma opção anterior pra outra.
  const escolherDecisao = (d: DecisaoMultiplosEscopos) => {
    setDecisao(d);
    setPrimeiroEscopoOpcao3(null);
    setModeloManualOpcao4(null);
    setConfirmacaoDelimitacao(false);
    setJustificativaCodigo(null);
    setJustificativaTexto("");
  };

  const resolvido = resolverDecisaoMultiplosEscopos({
    decisao,
    modeloComercioServico: sugestaoComercioServico?.modeloId ?? null,
    modeloProducao: sugestaoProducao?.modeloId ?? null,
    primeiroEscopoOpcao3,
    modeloManualOpcao4,
    confirmacaoDelimitacao,
    justificativaCodigo,
    justificativaTexto,
  });
  const { podeContinuar, modeloSelecionado, modeloOuEscopoNaoInspecionado, exigeConfirmacao, exigeJustificativa } =
    resolvido;
  const escopoNaoInspecionadoLabel =
    decisao === "escopo_comercio_servico"
      ? "Produção ou industrialização"
      : decisao === "escopo_producao"
        ? "Comércio ou serviço de alimentação"
        : null;

  const handleContinuar = () => {
    if (!podeContinuar || !decisao || !modeloSelecionado) return;
    onContinuar({
      modeloVersaoId: modeloSelecionado,
      decisao,
      modeloSelecionadoParaInspecaoAtual: modeloSelecionado,
      modeloOuEscopoNaoInspecionado,
      modelosSugeridos: recomendacao.sugestoes,
      justificativaCodigo: exigeJustificativa ? justificativaCodigo : null,
      justificativaTexto: exigeJustificativa && justificativaCodigo === "outro" ? justificativaTexto.trim() : null,
      segundoEscopoPendente: resolvido.segundoEscopoPendente,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Selecione a legislação</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{recomendacao.titulo}</AlertTitle>
          <AlertDescription className="whitespace-pre-line">{recomendacao.alerta}</AlertDescription>
        </Alert>

        <p className="text-xs text-muted-foreground">
          A RDC 275/2002 e a CVS 3/2026 (ou a RDC 216/2004, fora de SP) fiscalizam recortes operacionais diferentes do
          mesmo estabelecimento — nenhuma norma substitui ou dispensa automaticamente a outra.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <EscopoCard
            titulo="Comércio ou serviço de alimentação"
            sugestao={sugestaoComercioServico}
            nomeModelo={nomeModelo}
          />
          <EscopoCard titulo="Produção ou industrialização" sugestao={sugestaoProducao} nomeModelo={nomeModelo} />
        </div>

        <RadioGroup value={decisao ?? undefined} onValueChange={(v) => escolherDecisao(v as DecisaoMultiplosEscopos)}>
          <OpcaoDecisao
            id="opcao-1"
            value="escopo_comercio_servico"
            titulo="Inspecionar agora somente o escopo de comércio ou serviço de alimentação"
            descricao="Em São Paulo: Portaria CVS nº 3/2026. Fora de São Paulo: RDC nº 216/2004, quando aplicável."
          />
          {decisao === "escopo_comercio_servico" && (
            <BlocoConfirmacaoEJustificativa
              modeloResolvido={nomeModelo(modeloSelecionado)}
              escopoNaoInspecionado={escopoNaoInspecionadoLabel}
              confirmacaoDelimitacao={confirmacaoDelimitacao}
              setConfirmacaoDelimitacao={setConfirmacaoDelimitacao}
              justificativaCodigo={justificativaCodigo}
              setJustificativaCodigo={setJustificativaCodigo}
              justificativaTexto={justificativaTexto}
              setJustificativaTexto={setJustificativaTexto}
            />
          )}

          <OpcaoDecisao
            id="opcao-2"
            value="escopo_producao"
            titulo="Inspecionar agora somente o escopo de produção ou industrialização"
            descricao="RDC nº 275/2002, quando aplicável."
          />
          {decisao === "escopo_producao" && (
            <BlocoConfirmacaoEJustificativa
              modeloResolvido={nomeModelo(modeloSelecionado)}
              escopoNaoInspecionado={escopoNaoInspecionadoLabel}
              confirmacaoDelimitacao={confirmacaoDelimitacao}
              setConfirmacaoDelimitacao={setConfirmacaoDelimitacao}
              justificativaCodigo={justificativaCodigo}
              setJustificativaCodigo={setJustificativaCodigo}
              justificativaTexto={justificativaTexto}
              setJustificativaTexto={setJustificativaTexto}
            />
          )}

          <OpcaoDecisao
            id="opcao-3"
            value="duas_inspecoes"
            titulo="Realizar inspeções separadas para os dois escopos"
            descricao="Inicia o primeiro checklist agora; o segundo fica registrado como pendente, com ação para iniciar depois. Os resultados nunca são fundidos."
          />
          {decisao === "duas_inspecoes" && (
            <div className="ml-6 grid gap-2 rounded-md border p-3">
              <Label className="text-xs font-medium text-muted-foreground">Qual escopo você vai inspecionar primeiro?</Label>
              <RadioGroup
                value={primeiroEscopoOpcao3 ?? undefined}
                onValueChange={(v) => setPrimeiroEscopoOpcao3(v as "comercio_servico" | "producao")}
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="comercio_servico" disabled={!sugestaoComercioServico} />
                  Comércio ou serviço de alimentação
                  {sugestaoComercioServico ? ` — ${nomeModelo(sugestaoComercioServico.modeloId)}` : " (sem legislação identificada automaticamente)"}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="producao" disabled={!sugestaoProducao} />
                  Produção ou industrialização
                  {sugestaoProducao ? ` — ${nomeModelo(sugestaoProducao.modeloId)}` : " (sem legislação identificada automaticamente)"}
                </label>
              </RadioGroup>
            </div>
          )}

          <OpcaoDecisao
            id="opcao-4"
            value="prosseguir_com_justificativa"
            titulo="Prosseguir com apenas um escopo mediante justificativa técnica"
            descricao="Exige escolher o modelo e registrar uma justificativa antes de liberar o avanço."
          />
          {decisao === "prosseguir_com_justificativa" && (
            <div className="ml-6 grid gap-3 rounded-md border p-3">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Modelo de checklist</Label>
                <Select value={modeloManualOpcao4 ?? undefined} onValueChange={setModeloManualOpcao4}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelos.map((m) => (
                      <SelectItem key={m.modeloVersaoId} value={m.modeloVersaoId}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <BlocoJustificativa
                justificativaCodigo={justificativaCodigo}
                setJustificativaCodigo={setJustificativaCodigo}
                justificativaTexto={justificativaTexto}
                setJustificativaTexto={setJustificativaTexto}
              />
            </div>
          )}
        </RadioGroup>

        <div className="flex justify-end">
          <Button onClick={handleContinuar} disabled={!podeContinuar}>
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EscopoCard({
  titulo,
  sugestao,
  nomeModelo,
}: {
  titulo: string;
  sugestao: Sugestao | null;
  nomeModelo: (id: string | null | undefined) => string | null;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">{titulo}</p>
      {sugestao ? (
        <>
          <Badge variant="secondary" className="mt-1">
            {nomeModelo(sugestao.modeloId)}
          </Badge>
          <p className="mt-1 text-xs text-muted-foreground">{sugestao.motivo}</p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">Nenhuma legislação identificada automaticamente para este escopo com os dados atuais.</p>
      )}
    </div>
  );
}

function OpcaoDecisao({
  id,
  value,
  titulo,
  descricao,
}: {
  id: string;
  value: DecisaoMultiplosEscopos;
  titulo: string;
  descricao: string;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <span>
        <span className="block font-medium">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{descricao}</span>
      </span>
    </label>
  );
}

function BlocoConfirmacaoEJustificativa({
  modeloResolvido,
  escopoNaoInspecionado,
  confirmacaoDelimitacao,
  setConfirmacaoDelimitacao,
  justificativaCodigo,
  setJustificativaCodigo,
  justificativaTexto,
  setJustificativaTexto,
}: {
  modeloResolvido: string | null;
  escopoNaoInspecionado: string | null;
  confirmacaoDelimitacao: boolean;
  setConfirmacaoDelimitacao: (v: boolean) => void;
  justificativaCodigo: JustificativaCodigo | null;
  setJustificativaCodigo: (v: JustificativaCodigo) => void;
  justificativaTexto: string;
  setJustificativaTexto: (v: string) => void;
}) {
  return (
    <div className="ml-6 grid gap-3 rounded-md border p-3">
      {!modeloResolvido && (
        <p className="text-xs text-destructive">
          Nenhuma legislação foi identificada automaticamente para este escopo com os dados informados (verifique a
          UF). Ajuste a localização/atividades acima para liberar esta opção.
        </p>
      )}
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={confirmacaoDelimitacao}
          onCheckedChange={(c) => setConfirmacaoDelimitacao(c === true)}
          className="mt-0.5"
        />
        <span>
          Confirmo que esta inspeção está deliberadamente limitada a este escopo
          {modeloResolvido ? ` (${modeloResolvido})` : ""}.
        </span>
      </label>
      <BlocoJustificativa
        label={`Por que não inspecionar "${escopoNaoInspecionado}" agora?`}
        justificativaCodigo={justificativaCodigo}
        setJustificativaCodigo={setJustificativaCodigo}
        justificativaTexto={justificativaTexto}
        setJustificativaTexto={setJustificativaTexto}
      />
    </div>
  );
}

function BlocoJustificativa({
  label = "Justificativa",
  justificativaCodigo,
  setJustificativaCodigo,
  justificativaTexto,
  setJustificativaTexto,
}: {
  label?: string;
  justificativaCodigo: JustificativaCodigo | null;
  setJustificativaCodigo: (v: JustificativaCodigo) => void;
  justificativaTexto: string;
  setJustificativaTexto: (v: string) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={justificativaCodigo ?? undefined} onValueChange={(v) => setJustificativaCodigo(v as JustificativaCodigo)}>
        <SelectTrigger className="max-w-sm">
          <SelectValue placeholder="Selecione um motivo" />
        </SelectTrigger>
        <SelectContent>
          {JUSTIFICATIVA_OPCOES.map((o) => (
            <SelectItem key={o.codigo} value={o.codigo}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {justificativaCodigo === "outro" && (
        <Textarea
          className="mt-2 max-w-sm"
          placeholder="Descreva o motivo (obrigatório)"
          value={justificativaTexto}
          onChange={(e) => setJustificativaTexto(e.target.value)}
        />
      )}
    </div>
  );
}
