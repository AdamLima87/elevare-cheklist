import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformStubPage } from "@/components/platform/PlatformStubPage";

// Fase 1: esqueleto/placeholder. Fase 2 substitui isto pela gestão global
// de tenants de verdade (extraída de configuracoes.tsx, com métricas por
// empresa e ações auditadas).
export const Route = createFileRoute("/plataforma/empresas")({
  head: () => ({ meta: [{ title: "Empresas · Administração da Plataforma · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <PlatformStubPage titulo="Empresas" descricao="Gestão global de tenants." />
      </PlatformLayout>
    </ProtectedRoute>
  ),
});
