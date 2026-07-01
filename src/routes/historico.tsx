import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AllInspections } from "@/components/admin/AllInspections";
import { SyncStatus } from "@/components/elevare/SyncStatus";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [{ title: "Histórico · Elevare" }, { name: "description", content: "Histórico de inspeções sanitárias realizadas." }],
  }),
  component: HistoricoPage,
});

function HistoricoPage() {
  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Histórico de Inspeções</h1>
            <p className="text-sm text-muted-foreground">Visualize e gerencie todas as inspeções realizadas.</p>
          </div>
          <SyncStatus />
        </div>
        <AllInspections />
      </AppShell>
    </ProtectedRoute>
  );
}
