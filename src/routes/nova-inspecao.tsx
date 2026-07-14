import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/elevare/AppShell";
import { NovaInspecaoForm } from "@/components/elevare/NovaInspecaoForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncFromCloud } from "@/lib/sync";
import { ClipboardCheck, Search, Building2, ArrowLeft, Loader2 } from "lucide-react";
import { SyncStatus } from "@/components/elevare/SyncStatus";
import { useClientes, type Cliente } from "@/hooks/useClientes";

export const Route = createFileRoute("/nova-inspecao")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      edit: Boolean(search.edit),
    };
  },
  head: () => ({
    meta: [
      { title: "Nova Inspeção · Elevare" },
      { name: "description", content: "Inicie um novo diagnóstico sanitário." },
    ],
  }),
  component: IndexPageWrapper,
});

function IndexPageWrapper() {
  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <IndexPage />
    </ProtectedRoute>
  );
}

function IndexPage() {
  const { edit } = Route.useSearch();
  const [syncing, setSyncing] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    handleSync(true); // silent na entrada

    const syncInterval = setInterval(() => {
      handleSync(true);
    }, 300000); // 5 minutos — reduz consumo passivo de compute

    return () => clearInterval(syncInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async (silent = true) => {
    if (syncing) return;
    if (!silent) setSyncing(true);
    try {
      await syncFromCloud(silent);
      if (!silent) toast.success("Dados sincronizados com a nuvem!");
    } catch (err) {
      console.error("Sync error:", err);
      if (!silent) toast.error("Erro na sincronização");
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Diagnóstico Sanitário
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Identificação do Estabelecimento
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha os dados antes de iniciar o checklist higiênico-sanitário.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SyncStatus />
        </div>
      </div>

      {edit ? (
        <NovaInspecaoForm editFromUrl />
      ) : selectedCliente ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 gap-1.5"
            onClick={() => setSelectedCliente(null)}
          >
            <ArrowLeft className="h-4 w-4" /> Trocar cliente
          </Button>
          <NovaInspecaoForm
            clienteId={selectedCliente.id}
            prefill={{
              razaoSocial: selectedCliente.nome,
              nomeFantasia: selectedCliente.nome,
              cnpj: selectedCliente.cnpj ?? "",
              atividade: selectedCliente.categoria ?? "",
            }}
          />
        </>
      ) : (
        <ClientePicker onSelect={setSelectedCliente} />
      )}
    </AppShell>
  );
}

function ClientePicker({ onSelect }: { onSelect: (cliente: Cliente) => void }) {
  const [search, setSearch] = useState("");
  const { data: clientes = [], isLoading } = useClientes(search || undefined, "ativo");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Selecione o cliente</CardTitle>
        <CardDescription>
          Só é possível iniciar uma inspeção para um cliente já cadastrado. Se o
          cliente ainda não existe, cadastre-o primeiro em "Clientes".
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : clientes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {clientes.map((cliente) => (
              <li key={cliente.id}>
                <button
                  type="button"
                  onClick={() => onSelect(cliente)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{cliente.nome}</div>
                    {cliente.cnpj && (
                      <div className="text-xs text-muted-foreground">{cliente.cnpj}</div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
