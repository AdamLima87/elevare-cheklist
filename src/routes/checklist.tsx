import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ChecklistShell } from "@/components/elevare/ChecklistShell";
import { draftKey } from "@/lib/storage";

const CONTEXT = { kind: "cliente" as const };

export const Route = createFileRoute("/checklist")({
  head: () => ({
    meta: [{ title: "Checklist · RDCheck" }, { name: "description", content: "Lista de Verificação Higiênico-Sanitária e Questionário Socioeconômico." }],
  }),
  component: ChecklistPage,
});

function ChecklistPage() {
  const navigate = useNavigate();
  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <ChecklistShell
          context={CONTEXT}
          draftKey={draftKey(CONTEXT)}
          onBackToIdentificacao={() => navigate({ to: "/nova-inspecao" })}
          onFinalizar={() => navigate({ to: "/resultado" })}
        />
      </AppShell>
    </ProtectedRoute>
  );
}
