import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ResultadoShell } from "@/components/elevare/ResultadoShell";

export const Route = createFileRoute("/resultado")({
  head: () => ({
    meta: [{ title: "Resultado · RDCheck" }, { name: "description", content: "Resultado da inspeção sanitária com pontuação, gráfico e não conformidades." }],
  }),
  component: ResultadoPage,
});

function ResultadoPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/resultado" }) as { id?: string; readonly?: boolean };

  return (
    <AppShell>
      <ResultadoShell
        search={search}
        onVoltarChecklist={() => navigate({ to: "/checklist" })}
        onNovaInspecao={() => navigate({ to: "/nova-inspecao" })}
      />
    </AppShell>
  );
}
