import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformStubPage } from "@/components/platform/PlatformStubPage";

export const Route = createFileRoute("/plataforma/consumo")({
  head: () => ({ meta: [{ title: "Google Places · Administração da Plataforma · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <PlatformStubPage
          titulo="Consumo — Google Places"
          descricao="Consumo global e por tenant, chave RDCheck vs. BYO key, erros e rate limit."
        />
      </PlatformLayout>
    </ProtectedRoute>
  ),
});
