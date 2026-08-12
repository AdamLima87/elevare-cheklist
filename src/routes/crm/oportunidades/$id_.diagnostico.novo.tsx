import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { NovaInspecaoForm } from "@/components/elevare/NovaInspecaoForm";
import {
  ContextoLegislacaoPicker,
  type ContextoRecomendacaoSnapshot,
} from "@/components/elevare/ContextoLegislacaoPicker";
import { DiagnosticoNaoEncontrado } from "@/components/elevare/DiagnosticoNaoEncontrado";
import { useCrmDiagnostico, useCrmOportunidade, useObterOuCriarDiagnostico } from "@/hooks/useCrmOportunidades";
import { useCrmEmpresa, type CrmEmpresa } from "@/hooks/useCrmEmpresas";
import { supabase } from "@/integrations/supabase/client";
import { loadInspecao, type Estabelecimento, type Inspecao } from "@/lib/storage";
import { describeInspectionSaveError } from "@/lib/inspection-error";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/crm/oportunidades/$id_/diagnostico/novo")({
  head: () => ({ meta: [{ title: "Diagnóstico Inicial · CRM Comercial · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <CrmDiagnosticoNovoPage />
    </ProtectedRoute>
  ),
});

// Snapshot pontual da Conta pro formulário — nunca atualiza a Conta de volta
// a partir da execução (decisão explícita da Fase 4, Etapa 4.6). Campos sem
// correspondência em CrmEmpresa (endereço, telefone) ficam em branco pra
// preenchimento manual — a Conta não tem esses campos hoje.
function crmEmpresaToEstabelecimentoPrefill(conta: CrmEmpresa): Partial<Estabelecimento> {
  return {
    razaoSocial: conta.razao_social,
    nomeFantasia: conta.nome_fantasia || conta.razao_social,
    atividade: conta.segmento || "",
    cnpj: conta.cnpj || "",
    municipio: conta.cidade || "",
    uf: conta.estado || "",
  };
}

function CrmDiagnosticoNovoPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/crm/oportunidades/$id_/diagnostico/novo" });
  const { data: oportunidade, isLoading: loadingOportunidade } = useCrmOportunidade(id);
  const { data: conta } = useCrmEmpresa(oportunidade?.crm_empresa_id);
  const { data: diagnosticoExistente, isLoading: loadingExistente } = useCrmDiagnostico(id);
  const obterOuCriar = useObterOuCriarDiagnostico();

  const [status, setStatus] = useState<"loading" | "modelo" | "form" | "erro">("loading");
  const [inspecaoId, setInspecaoId] = useState<string | null>(null);

  const obterOuCriarCom = async (
    checklistModeloVersaoId?: string,
    snapshot?: ContextoRecomendacaoSnapshot,
  ) => {
    try {
      const resultado = await obterOuCriar.mutateAsync({ crmOportunidadeId: id, checklistModeloVersaoId });

      // Fase 9.D — grava o snapshot de recomendação só na criação (nunca ao
      // retomar um diagnóstico existente, quando `snapshot` não é passado).
      if (snapshot) {
        const { data: atual } = await supabase
          .from("inspecoes")
          .select("dados")
          .eq("id", resultado.inspecao_id)
          .maybeSingle();
        if (atual) {
          await supabase
            .from("inspecoes")
            .update({
              dados: {
                ...(atual.dados as Record<string, unknown>),
                recomendacaoLegislacao: {
                  ...snapshot,
                  modeloEscolhidoId: checklistModeloVersaoId ?? null,
                  seguiuRecomendacao:
                    snapshot.resultado.tipo === "unica"
                      ? snapshot.resultado.modeloRecomendadoId === checklistModeloVersaoId
                      : null,
                },
              },
            })
            .eq("id", resultado.inspecao_id);
        }
      }

      // Se a identificação já foi preenchida antes (retomando um
      // diagnóstico existente), pula direto pro checklist — este form é
      // só a etapa de identificação, não deve reaparecer sempre.
      const loaded = await loadInspecao(resultado.inspecao_id);
      if (loaded?.insp.estabelecimento) {
        navigate({
          to: "/crm/oportunidades/$id/diagnostico/checklist",
          params: { id },
          search: { inspecaoId: resultado.inspecao_id },
          replace: true,
        });
        return;
      }

      setInspecaoId(resultado.inspecao_id);
      setStatus("form");
    } catch (error) {
      console.error("Erro ao obter/criar diagnóstico:", error);
      toast.error(describeInspectionSaveError(error));
      setStatus("erro");
    }
  };

  useEffect(() => {
    if (loadingExistente) return;
    // Diagnóstico já existe (retomando) — a RPC é idempotente e ignora o
    // modelo pra linhas já criadas, então não precisa escolher de novo.
    if (diagnosticoExistente && diagnosticoExistente.rows.length > 0) {
      obterOuCriarCom();
      return;
    }
    // Nenhum diagnóstico ainda — Fase 8.B: escolhe a legislação/modelo antes
    // de criar a inspeção (auto-seleciona sozinho se só houver 1 modelo).
    setStatus("modelo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadingExistente, diagnosticoExistente]);

  const voltarOportunidade = () => navigate({ to: "/crm/oportunidades/$id", params: { id } });

  return (
    <AppShell>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={voltarOportunidade} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar à oportunidade
        </Button>
      </div>

      <div className="mb-6">
        <span className="label-eyebrow text-primary">Diagnóstico Inicial</span>
        <h1 className="font-display text-2xl font-semibold mt-1">
          {oportunidade?.crm_empresas?.nome_fantasia || oportunidade?.crm_empresas?.razao_social || "Oportunidade"}
        </h1>
        <p className="text-sm text-muted-foreground">Identificação do estabelecimento para o diagnóstico.</p>
      </div>

      {(status === "loading" || loadingOportunidade) && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {status === "modelo" && (
        <ContextoLegislacaoPicker
          ufPrefillCrm={conta?.estado ?? null}
          onSelecionar={(modeloId, snapshot) => obterOuCriarCom(modeloId, snapshot)}
        />
      )}
      {status === "erro" && <DiagnosticoNaoEncontrado onVoltar={voltarOportunidade} />}
      {status === "form" && inspecaoId && (
        <NovaInspecaoForm
          crmContext={{ crmOportunidadeId: id, inspecaoId }}
          prefill={conta ? crmEmpresaToEstabelecimentoPrefill(conta) : undefined}
          onIniciado={(insp: Inspecao) =>
            navigate({
              to: "/crm/oportunidades/$id/diagnostico/checklist",
              params: { id },
              search: { inspecaoId: insp.id },
            })
          }
        />
      )}
    </AppShell>
  );
}
