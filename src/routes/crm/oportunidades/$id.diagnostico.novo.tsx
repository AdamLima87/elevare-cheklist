import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { NovaInspecaoForm } from "@/components/elevare/NovaInspecaoForm";
import { DiagnosticoNaoEncontrado } from "@/components/elevare/DiagnosticoNaoEncontrado";
import { useCrmOportunidade, useObterOuCriarDiagnostico } from "@/hooks/useCrmOportunidades";
import { useCrmEmpresa, type CrmEmpresa } from "@/hooks/useCrmEmpresas";
import { loadInspecao, type Estabelecimento, type Inspecao } from "@/lib/storage";
import { describeInspectionSaveError } from "@/lib/inspection-error";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/crm/oportunidades/$id/diagnostico/novo")({
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
  const { id } = useParams({ from: "/crm/oportunidades/$id/diagnostico/novo" });
  const { data: oportunidade, isLoading: loadingOportunidade } = useCrmOportunidade(id);
  const { data: conta } = useCrmEmpresa(oportunidade?.crm_empresa_id);
  const obterOuCriar = useObterOuCriarDiagnostico();

  const [status, setStatus] = useState<"loading" | "form" | "erro">("loading");
  const [inspecaoId, setInspecaoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resultado = await obterOuCriar.mutateAsync(id);
        if (cancelled) return;

        // Se a identificação já foi preenchida antes (retomando um
        // diagnóstico existente), pula direto pro checklist — este form é
        // só a etapa de identificação, não deve reaparecer sempre.
        const loaded = await loadInspecao(resultado.inspecao_id);
        if (cancelled) return;
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
        if (!cancelled) setStatus("erro");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
        <p className="text-sm text-muted-foreground">Checklist atual do RDCheck — identificação do estabelecimento.</p>
      </div>

      {(status === "loading" || loadingOportunidade) && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
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
