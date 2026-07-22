import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformStubPage } from "@/components/platform/PlatformStubPage";

export const Route = createFileRoute("/plataforma/planos")({
  head: () => ({ meta: [{ title: "Planos · Administração da Plataforma · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <PlatformStubPage titulo="Planos" descricao="Catálogo de planos e limites (saas_planos / saas_plano_limites)." />
      </PlatformLayout>
    </ProtectedRoute>
  ),
});
