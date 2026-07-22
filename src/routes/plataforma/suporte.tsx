import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformStubPage } from "@/components/platform/PlatformStubPage";

export const Route = createFileRoute("/plataforma/suporte")({
  head: () => ({ meta: [{ title: "Suporte · Administração da Plataforma · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <PlatformStubPage titulo="Suporte" descricao="Tickets de suporte — fora de escopo por enquanto." />
      </PlatformLayout>
    </ProtectedRoute>
  ),
});
