import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
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
import {
  useLeadFinderUsage,
  useSaveLeadFinderCredential,
  useTestLeadFinderCredential,
  useRemoveLeadFinderCredential,
} from "@/hooks/useLeadFinder";

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

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Integrações</h2>
          <GooglePlacesIntegrationCard />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function GooglePlacesIntegrationCard() {
  const { data: usage, isLoading } = useLeadFinderUsage();
  const save = useSaveLeadFinderCredential();
  const test = useTestLeadFinderCredential();
  const remove = useRemoveLeadFinderCredential();
  const [apiKey, setApiKey] = useState("");

  const status = usage?.credencial?.status ?? "nao_configurado";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    try {
      await save.mutateAsync(apiKey.trim());
      setApiKey("");
      toast.success("Chave salva. Clique em \"Testar conexão\" para validar.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar a chave.");
    }
  };

  const handleTest = async () => {
    try {
      const result = await test.mutateAsync();
      if (result.status === "conectado") toast.success("Conexão validada com sucesso.");
      else toast.error("Não foi possível validar a chave. Verifique se ela está correta e com a Places API (New) habilitada.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao testar a chave.");
    }
  };

  const handleRemove = async () => {
    try {
      await remove.mutateAsync();
      toast.success("Chave removida. A busca de leads volta a usar a cota do RDCheck.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover a chave.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google Places (Buscar Leads)</CardTitle>
        <CardDescription>
          Conecte sua própria chave do Google Cloud pra deixar de usar a cota de leads do RDCheck.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            {status === "conectado" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {status === "invalido" && <XCircle className="h-4 w-4 text-destructive" />}
            {status === "nao_configurado" && <HelpCircle className="h-4 w-4 text-muted-foreground" />}
            <span>
              {status === "conectado" && "Conectado — usando sua própria chave."}
              {status === "invalido" && "Chave inválida — teste novamente ou substitua abaixo."}
              {status === "nao_configurado" && "Nenhuma chave própria configurada — usando a cota do RDCheck."}
            </span>
          </div>
        )}

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Como gerar sua chave:</p>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>Acesse o Google Cloud Console e crie (ou escolha) um projeto.</li>
            <li>Ative a faturamento do projeto, caso ainda não esteja ativo (exigido pelo Google).</li>
            <li>Em "APIs e Serviços", habilite a "Places API (New)".</li>
            <li>Em "Credenciais", crie uma nova chave de API.</li>
            <li>Restrinja a chave por "API restrictions" só à Places API (New).</li>
            <li>Cole a chave abaixo e clique em "Salvar" e depois em "Testar conexão".</li>
          </ol>
        </div>

        <form onSubmit={handleSave} className="flex gap-2">
          <Input
            type="password"
            placeholder="Cole sua chave de API aqui..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Button type="submit" disabled={save.isPending || !apiKey.trim()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </form>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={test.isPending || status === "nao_configurado"}>
            {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar conexão"}
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleRemove}
            disabled={remove.isPending || status === "nao_configurado"}
          >
            Remover
          </Button>
        </div>
      </CardContent>
    </Card>
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
