import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { ResultadoShell } from "@/components/elevare/ResultadoShell";
import { DiagnosticoNaoEncontrado } from "@/components/elevare/DiagnosticoNaoEncontrado";
import { draftKey, loadInspecao, type Inspecao } from "@/lib/storage";
import type { InspectionContext } from "@/lib/inspection-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/crm/oportunidades/$id/diagnostico/resultado")({
  validateSearch: (search: Record<string, unknown>) => ({
    inspecaoId: String(search.inspecaoId ?? ""),
  }),
  head: () => ({ meta: [{ title: "Diagnóstico Inicial · CRM Comercial · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <CrmDiagnosticoResultadoPage />
    </ProtectedRoute>
  ),
});

const AVISO_DIAGNOSTICO = (
  <p className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
    Este é um diagnóstico pré-venda. Ele não é publicado automaticamente no portal do cliente — mesmo após a
    conversão da oportunidade, o perfil de cliente não tem acesso a diagnósticos pré-venda. O compartilhamento do
    relatório com o prospect/cliente poderá ganhar um fluxo dedicado em uma fase futura; por ora, use os botões de
    PDF/WhatsApp/e-mail manual acima.
  </p>
);

function CrmDiagnosticoResultadoPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/crm/oportunidades/$id/diagnostico/resultado" });
  const { inspecaoId } = useSearch({ from: "/crm/oportunidades/$id/diagnostico/resultado" });

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
        <>
          <ResultadoShell
            context={context}
            draftKey={draftKey(context, inspecaoId)}
            search={{ id: inspecaoId, readonly: insp.status === "concluida" }}
            preloaded={insp}
            titulo="Diagnóstico Inicial"
            avisoExtra={insp.status !== "concluida" ? AVISO_DIAGNOSTICO : undefined}
            footerActions={
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    navigate({
                      to: "/crm/oportunidades/$id/diagnostico/checklist",
                      params: { id },
                      search: { inspecaoId },
                    })
                  }
                >
                  Voltar ao checklist
                </Button>
                <Button variant="outline" onClick={voltarOportunidade}>Voltar à oportunidade</Button>
              </div>
            }
            onVoltarChecklist={() =>
              navigate({
                to: "/crm/oportunidades/$id/diagnostico/checklist",
                params: { id },
                search: { inspecaoId },
              })
            }
            onNovaInspecao={voltarOportunidade}
          />
          {insp.status === "concluida" && (
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={voltarOportunidade}>Voltar à oportunidade</Button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
