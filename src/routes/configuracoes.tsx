import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";

export const Route = createFileRoute("/configuracoes")({ component: ConfiguracoesPage });

function ConfiguracoesPage() {
  return (
    <ProtectedRoute allowedProfiles={["admin"]}>
      <AppShell>
        <h1 className="text-2xl font-semibold mb-6">Configurações</h1>
        <p className="text-slate-500">Configurações do sistema — em breve.</p>
      </AppShell>
    </ProtectedRoute>
  );
}
