import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { AllInspections } from "@/components/admin/AllInspections";
import { SyncStatus } from "@/components/elevare/SyncStatus";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [{ title: "Histórico · Elevare" }, { name: "description", content: "Histórico de inspeções sanitárias realizadas." }],
  }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const navigate = useNavigate();
  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Histórico de Inspeções</h1>
            <p className="text-sm text-slate-500">Visualize e gerencie todas as inspeções realizadas.</p>
          </div>
          <div className="flex items-center gap-3">
            <SyncStatus />
            <Button onClick={() => navigate({ to: "/nova-inspecao" })} className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white">
              Nova Inspeção
            </Button>
          </div>
        </div>
        <AllInspections />
      </AppShell>
    </ProtectedRoute>
  );
}
