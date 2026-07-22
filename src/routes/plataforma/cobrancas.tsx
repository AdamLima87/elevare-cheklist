import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformStubPage } from "@/components/platform/PlatformStubPage";

export const Route = createFileRoute("/plataforma/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças · Administração da Plataforma · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <PlatformStubPage titulo="Cobranças" descricao="Billing/faturamento — fora de escopo por enquanto." />
      </PlatformLayout>
    </ProtectedRoute>
  ),
});
