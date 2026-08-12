import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ChecklistShell } from "@/components/elevare/ChecklistShell";
import { DiagnosticoNaoEncontrado } from "@/components/elevare/DiagnosticoNaoEncontrado";
import { draftKey, loadInspecao, type Inspecao } from "@/lib/storage";
import type { InspectionContext } from "@/lib/inspection-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/crm/oportunidades/$id_/diagnostico/checklist")({
  validateSearch: (search: Record<string, unknown>) => ({
    inspecaoId: String(search.inspecaoId ?? ""),
  }),
  head: () => ({ meta: [{ title: "Diagnóstico Inicial · CRM Comercial · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <CrmDiagnosticoChecklistPage />
    </ProtectedRoute>
  ),
});

function CrmDiagnosticoChecklistPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/crm/oportunidades/$id_/diagnostico/checklist" });
  const { inspecaoId } = useSearch({ from: "/crm/oportunidades/$id_/diagnostico/checklist" });

  const [status, setStatus] = useState<"loading" | "ok" | "erro">("loading");
  const [insp, setInsp] = useState<Inspecao | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!inspecaoId) {
        if (!cancelled) setStatus("erro");
        return;
      }
      const loaded = await loadInspecao(inspecaoId);
      // Nunca confia só no inspecaoId da URL: exige que a inspeção seja
      // realmente um diagnóstico E pertença à oportunidade desta rota.
      if (
        cancelled ||
        !loaded ||
        loaded.context.kind !== "diagnostico_crm" ||
        loaded.context.crmOportunidadeId !== id
      ) {
        if (!cancelled) setStatus("erro");
        return;
      }
      setInsp(loaded.insp);
      setStatus("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [id, inspecaoId]);

  const context: InspectionContext = { kind: "diagnostico_crm", crmOportunidadeId: id };
  const voltarOportunidade = () => navigate({ to: "/crm/oportunidades/$id", params: { id } });

  return (
    <AppShell>
      {status === "loading" && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {status === "erro" && <DiagnosticoNaoEncontrado onVoltar={voltarOportunidade} />}
      {status === "ok" && insp && (
        <ChecklistShell
          context={context}
          draftKey={draftKey(context, inspecaoId)}
          preloaded={insp}
          onBackToIdentificacao={() =>
            navigate({ to: "/crm/oportunidades/$id/diagnostico/novo", params: { id } })
          }
          onFinalizar={(finalId) =>
            navigate({
              to: "/crm/oportunidades/$id/diagnostico/resultado",
              params: { id },
              search: { inspecaoId: finalId },
            })
          }
        />
      )}
    </AppShell>
  );
}
