import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { PlatformStubPage } from "@/components/platform/PlatformStubPage";

export const Route = createFileRoute("/plataforma/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · Administração da Plataforma · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <PlatformStubPage
          titulo="Usuários da Plataforma"
          descricao="Contas com acesso de super_admin (equipe do RDCheck, não usuários de tenant)."
        />
      </PlatformLayout>
    </ProtectedRoute>
  ),
});
