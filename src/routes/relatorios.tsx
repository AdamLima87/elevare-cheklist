import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";

export const Route = createFileRoute("/relatorios")({ component: RelatoriosPage });

function RelatoriosPage() {
  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <h1 className="text-2xl font-semibold mb-6">Relatórios</h1>
        <p className="text-slate-500">Em breve — lista completa de inspeções concluídas com filtros e exportação.</p>
      </AppShell>
    </ProtectedRoute>
  );
}
