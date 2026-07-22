import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformStubPage } from "@/components/platform/PlatformStubPage";

export const Route = createFileRoute("/plataforma/logs")({
  head: () => ({ meta: [{ title: "Auditoria · Administração da Plataforma · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <PlatformStubPage titulo="Auditoria" descricao="Eventos administrativos globais (audit_log)." />
      </PlatformLayout>
    </ProtectedRoute>
  ),
});
