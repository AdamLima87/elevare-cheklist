import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CalendarClock, PlayCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import {
  useCancelarProgramacaoReinspecao,
  useIniciarReinspecao,
  useReagendarProgramacaoReinspecao,
  type ReinspecaoProgramacao,
} from "@/hooks/useReinspecaoProgramacoes";
import { loadInspecao, saveRascunho } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { useChecklistModelosDisponiveis } from "@/hooks/useChecklistModelosDisponiveis";
import { recomendarModelo } from "@/lib/checklist-modelo-recomendacao";

/** Fase 9.D — recalcula a recomendação com o contexto da inspeção de origem
 * e avisa (sem trocar nada sozinho) quando ela diverge do modelo que a
 * reinspeção vai herdar. `iniciar_reinspecao` continua herdando o modelo da
 * origem incondicionalmente — este aviso é só informativo. */
function useAvisoDivergenciaModelo(inspecaoOrigemId: string) {
  const { data: modelos } = useChecklistModelosDisponiveis();
  const { data: origem } = useQuery({
    queryKey: ["reinspecao-origem-contexto", inspecaoOrigemId],
    queryFn: async () => {
      const { data } = await supabase
        .from("inspecoes")
        .select("checklist_modelo_versao_id, dados")
        .eq("id", inspecaoOrigemId)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(inspecaoOrigemId),
  });

  if (!modelos || !origem) return null;

  const uf: string | null =
    origem.dados?.recomendacaoLegislacao?.ufConsiderada ?? origem.dados?.estabelecimento?.uf ?? null;
  const atividades: string[] = origem.dados?.recomendacaoLegislacao?.atividadesConsideradas ?? [];

  const resultado = recomendarModelo({
    ufConsiderada: uf,
    atividadesConsideradas: atividades,
    dataInspecao: new Date().toISOString(),
    modelosDisponiveis: modelos.map((m) => ({
      modeloVersaoId: m.modeloVersaoId,
      codigo: m.codigo,
      vigenteDesde: m.vigenteDesde,
    })),
  });

  if (resultado.tipo !== "unica") return null;
  if (resultado.modeloRecomendadoId === origem.checklist_modelo_versao_id) return null;

  const nomeRecomendado = modelos.find((m) => m.modeloVersaoId === resultado.modeloRecomendadoId)?.nome;
  return `A legislação recomendada hoje para este estabelecimento (${nomeRecomendado ?? "outro modelo"}) é diferente da usada na inspeção original. A reinspeção vai herdar o modelo original — se preferir aplicar a legislação atualmente recomendada, inicie uma inspeção nova em vez desta reinspeção.`;
}

const STATUS_LABEL: Record<ReinspecaoProgramacao["status"], string> = {
  programada: "Programada",
  reagendada: "Reagendada",
  iniciada: "Em andamento",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

const STATUS_TONE: Record<ReinspecaoProgramacao["status"], string> = {
  programada: "bg-blue-100 text-blue-700",
  reagendada: "bg-amber-100 text-amber-700",
  iniciada: "bg-primary/10 text-primary",
  realizada: "bg-green-100 text-green-700",
  cancelada: "bg-muted text-muted-foreground",
};

/** Mostra a programação de reinspeção de uma inspeção de origem, com ações
 * condicionadas ao status atual — reaproveitado em ResultadoShell.tsx e na
 * aba "Reinspeções" do hub do cliente. */
export function ReinspecaoCard({ programacao }: { programacao: ReinspecaoProgramacao }) {
  const navigate = useNavigate();
  const [reagendando, setReagendando] = useState(false);
  const [novaData, setNovaData] = useState(programacao.data_prevista);
  const reagendar = useReagendarProgramacaoReinspecao();
  const cancelar = useCancelarProgramacaoReinspecao();
  const iniciar = useIniciarReinspecao();

  const podeGerenciar = programacao.status === "programada" || programacao.status === "reagendada";
  const avisoDivergencia = useAvisoDivergenciaModelo(programacao.inspecao_origem_id);

  const handleReagendar = () => {
    if (!novaData) return;
    reagendar.mutate(
      { programacaoId: programacao.id, novaData },
      {
        onSuccess: () => {
          toast.success("Reinspeção reagendada.");
          setReagendando(false);
        },
        onError: (err) => {
          console.error(err);
          toast.error("Não foi possível reagendar.");
        },
      },
    );
  };

  const handleCancelar = () => {
    cancelar.mutate(
      { programacaoId: programacao.id },
      {
        onSuccess: () => toast.success("Programação cancelada."),
        onError: (err) => {
          console.error(err);
          toast.error("Não foi possível cancelar.");
        },
      },
    );
  };

  const handleIniciar = () => {
    iniciar.mutate(
      { programacaoId: programacao.id },
      {
        onSuccess: async (novaInspecaoId) => {
          // /checklist é a rota legada de slot único (sem noção de id via
          // URL, ver checklist.tsx) — carrega a reinspeção recém-criada como
          // rascunho local antes de navegar, mesmo padrão já usado em
          // "Continuar" no hub do cliente (clientes/$id.tsx).
          try {
            const loaded = await loadInspecao(novaInspecaoId);
            if (loaded) {
              await saveRascunho(loaded.insp, loaded.context);
            }
          } catch (err) {
            console.error("Falha ao carregar reinspeção recém-criada:", err);
          }
          toast.success("Reinspeção iniciada.");
          navigate({ to: "/checklist" });
        },
        onError: (err) => {
          console.error(err);
          toast.error("Não foi possível iniciar a reinspeção.");
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" /> Reinspeção
        </CardTitle>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[programacao.status]}`}>
          {STATUS_LABEL[programacao.status]}
        </span>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {reagendando ? (
          <div className="flex items-center gap-2">
            <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="h-9" />
            <Button size="sm" onClick={handleReagendar} disabled={reagendar.isPending}>
              {reagendar.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReagendando(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Data prevista: {new Date(programacao.data_prevista + "T00:00:00").toLocaleDateString("pt-BR")}
          </p>
        )}
        {programacao.observacao && <p className="text-xs text-muted-foreground">{programacao.observacao}</p>}

        {avisoDivergencia && podeGerenciar && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{avisoDivergencia}</AlertDescription>
          </Alert>
        )}

        {podeGerenciar && !reagendando && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={handleIniciar} disabled={iniciar.isPending} className="gap-1.5">
              {iniciar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
              Iniciar Reinspeção
            </Button>
            <Button size="sm" variant="outline" onClick={() => setReagendando(true)}>
              Reagendar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelar}
              disabled={cancelar.isPending}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancelar
            </Button>
          </div>
        )}

        {programacao.status === "iniciada" && programacao.inspecao_criada_id && (
          <Button
            size="sm"
            variant="link"
            className="h-auto p-0"
            onClick={async () => {
              try {
                const loaded = await loadInspecao(programacao.inspecao_criada_id as string);
                if (loaded) await saveRascunho(loaded.insp, loaded.context);
              } catch (err) {
                console.error("Falha ao carregar reinspeção:", err);
              }
              navigate({ to: "/checklist" });
            }}
          >
            Ver reinspeção em andamento
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
