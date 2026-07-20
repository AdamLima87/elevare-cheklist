import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import {
  useCrmMotivosPerda,
  useUpsertCrmMotivoPerda,
  useDeleteCrmMotivoPerda,
  useCrmTiposAtividade,
  useUpsertCrmTipoAtividade,
  useDeleteCrmTipoAtividade,
  useCrmOrigensLead,
  useUpsertCrmOrigemLead,
  useDeleteCrmOrigemLead,
  type CrmCatalogoItem,
} from "@/hooks/useCrmCatalogos";

export const Route = createFileRoute("/crm/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações do CRM · RDCheck" }],
  }),
  component: CrmConfiguracoesPage,
});

function CrmConfiguracoesPage() {
  return (
    <ProtectedRoute allowedProfiles={["admin"]}>
      <AppShell>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Configurações do CRM</h1>
          <p className="text-sm text-muted-foreground">
            Catálogos usados nas Oportunidades — só administradores editam.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <CatalogoCard
            titulo="Motivos de Perda"
            descricao="Usados ao marcar uma oportunidade como perdida."
            useList={useCrmMotivosPerda}
            useUpsert={useUpsertCrmMotivoPerda}
            useDelete={useDeleteCrmMotivoPerda}
          />
          <CatalogoCard
            titulo="Tipos de Atividade"
            descricao="Ligação, WhatsApp, Reunião etc."
            useList={useCrmTiposAtividade}
            useUpsert={useUpsertCrmTipoAtividade}
            useDelete={useDeleteCrmTipoAtividade}
          />
          <CatalogoCard
            titulo="Origens de Lead"
            descricao="De onde vieram as Contas."
            useList={useCrmOrigensLead}
            useUpsert={useUpsertCrmOrigemLead}
            useDelete={useDeleteCrmOrigemLead}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function CatalogoCard({
  titulo,
  descricao,
  useList,
  useUpsert,
  useDelete,
}: {
  titulo: string;
  descricao: string;
  useList: () => { data?: CrmCatalogoItem[]; isLoading: boolean };
  useUpsert: () => { mutateAsync: (input: any) => Promise<any>; isPending: boolean };
  useDelete: () => { mutateAsync: (id: string) => Promise<any>; isPending: boolean };
}) {
  const { data: profile } = useCurrentProfile();
  const { data: itens = [], isLoading } = useList();
  const upsert = useUpsert();
  const del = useDelete();
  const [novoNome, setNovoNome] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id || !novoNome.trim()) return;
    try {
      await upsert.mutateAsync({
        empresa_id: profile.empresa_id,
        nome: novoNome.trim(),
        ordem: itens.length,
      });
      setNovoNome("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar item");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await del.mutateAsync(id);
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover item");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-1.5">
            {itens.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm"
              >
                <span>{item.nome}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {itens.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">Nenhum item cadastrado.</p>
            )}
          </div>
        )}

        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="Novo item..."
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <Button type="submit" size="icon" disabled={upsert.isPending || !novoNome.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
