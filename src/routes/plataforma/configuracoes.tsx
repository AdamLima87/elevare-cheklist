import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformStubPage } from "@/components/platform/PlatformStubPage";

export const Route = createFileRoute("/plataforma/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · Administração da Plataforma · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <PlatformStubPage
          titulo="Configurações da Plataforma"
          descricao="Catálogo de feature flags e informações de sistema."
        />
      </PlatformLayout>
    </ProtectedRoute>
  ),
});
