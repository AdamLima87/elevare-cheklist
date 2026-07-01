import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { UserManagement } from "@/components/admin/UserManagement";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  return (
    <ProtectedRoute allowedProfiles={["admin"]}>
      <AppShell>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie usuários e permissões do sistema.</p>
        </div>

        <div className="space-y-6">
          <UserManagement />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
