import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { UserManagement } from "@/components/admin/UserManagement";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Save,
  Download,
  Building,
  Bell,
  Info,
  Database,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
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
  useCrmLeadsNichos,
  useUpsertCrmLeadsNicho,
  useDeleteCrmLeadsNicho,
  type CrmCatalogoItem,
} from "@/hooks/useCrmCatalogos";
import {
  useLeadFinderUsage,
  useSaveLeadFinderCredential,
  useTestLeadFinderCredential,
  useRemoveLeadFinderCredential,
} from "@/hooks/useLeadFinder";
import { useTenantAccessStatus } from "@/hooks/useTenantAccessStatus";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, ExternalLink } from "lucide-react";

// Só configuração do TENANT (empresa/consultoria) mora aqui. Gestão global
// de tenants ("Empresas") migrou pra Administração da Plataforma
// (/plataforma/empresas, só super_admin) — não é uma configuração de
// empresa, é gestão do SaaS.
const ABAS = ["geral", "crm", "usuarios", "cobranca"] as const;
type Aba = (typeof ABAS)[number];

export const Route = createFileRoute("/configuracoes")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: ABAS.includes(search.tab as Aba) ? (search.tab as Aba) : "geral",
  }),
  head: () => ({
    meta: [
      { title: "Configurações · RDCheck" },
      { name: "description", content: "Configurações do sistema, CRM e usuários." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();

  return (
    <ProtectedRoute allowedProfiles={["admin", "super_admin"]}>
      <AppShell>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground text-sm">Gerencie os dados da empresa, o CRM Comercial e usuários.</p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => navigate({ to: "/configuracoes", search: { tab: v as Aba } })}
        >
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="crm">CRM Comercial</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="cobranca">Plano e Cobrança</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-6">
            <GeralTab />
          </TabsContent>
          <TabsContent value="crm" className="mt-6">
            <CrmTab />
          </TabsContent>
          <TabsContent value="usuarios" className="mt-6">
            <UserManagement />
          </TabsContent>
          <TabsContent value="cobranca" className="mt-6">
            <CobrancaTab />
          </TabsContent>
        </Tabs>
      </AppShell>
    </ProtectedRoute>
  );
}

function GeralTab() {
  const { data: profile } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>({
    nome_empresa: "",
    email_contato: "",
    telefone: "",
    site: "",
    enviar_email_cliente: true,
    notificar_admin: false,
  });

  useEffect(() => {
    if (!profile?.empresa_id) return;

    async function fetchConfig(empresaId: string) {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("configuracoes")
          .select("*")
          .eq("empresa_id", empresaId)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setConfig(data);
        }
      } catch (error) {
        console.error("Error fetching config:", error);
        toast.error("Erro ao carregar configurações");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig(profile.empresa_id);
  }, [profile?.empresa_id]);

  const handleSave = async () => {
    if (!profile?.empresa_id) {
      toast.error("Seu usuário não está associado a uma empresa.");
      return;
    }
    setSaving(true);
    try {
      const { id, created_at, updated_at, ...updateData } = config;

      let error;
      if (id) {
        ({ error } = await supabase
          .from("configuracoes")
          .update(updateData)
          .eq("id", id));
      } else {
        ({ error } = await supabase
          .from("configuracoes")
          .insert([{ ...updateData, empresa_id: profile.empresa_id }]));
      }

      if (error) throw error;
      toast.success("Alterações salvas com sucesso!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      toast.loading("Preparando exportação...");
      const { data: inspections, error } = await supabase.from("inspecoes").select("*");

      if (error) throw error;

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(inspections, null, 2));
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `rdcheck_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      toast.dismiss();
      toast.success("Dados exportados com sucesso!");
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Erro ao exportar dados");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Sobre o Sistema</CardTitle>
          </div>
          <CardDescription>Informações gerais do RDCheck</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="font-semibold">Nome do App:</span>
            <span>RDCheck</span>
            <span className="font-semibold">Versão:</span>
            <span>1.0.0</span>
            <span className="font-semibold">Base Legal:</span>
            <span className="text-xs">RDC nº 275/2002 e RDC nº 216/2004 — ANVISA</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Notificações</CardTitle>
          </div>
          <CardDescription>Preferências de alertas e envios automáticos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>E-mail ao cliente</Label>
              <p className="text-xs text-muted-foreground">Enviar relatório ao concluir inspeção</p>
            </div>
            <Switch
              checked={config.enviar_email_cliente}
              onCheckedChange={(v) => setConfig({ ...config, enviar_email_cliente: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificar Admin</Label>
              <p className="text-xs text-muted-foreground">Avisar sobre novas inspeções concluídas</p>
            </div>
            <Switch
              checked={config.notificar_admin}
              onCheckedChange={(v) => setConfig({ ...config, notificar_admin: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Dados da Consultoria</CardTitle>
          </div>
          <CardDescription>
            Timbre da sua consultoria — usado no cabeçalho dos relatórios e nos e-mails ao cliente. Se ficar em
            branco, os relatórios usam a identidade do RDCheck.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome_empresa">Nome da Consultoria</Label>
            <Input
              id="nome_empresa"
              value={config.nome_empresa}
              placeholder="Ex: Sua Consultoria Ltda"
              onChange={(e) => setConfig({ ...config, nome_empresa: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email_contato">E-mail de Contato</Label>
            <Input
              id="email_contato"
              type="email"
              value={config.email_contato}
              onChange={(e) => setConfig({ ...config, email_contato: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={config.telefone}
              onChange={(e) => setConfig({ ...config, telefone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site">Site</Label>
            <Input id="site" value={config.site} onChange={(e) => setConfig({ ...config, site: e.target.value })} />
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t p-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar alterações
          </Button>
        </CardFooter>
      </Card>

      <Card className="md:col-span-2 border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Dados e Armazenamento</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium">Sincronização na Nuvem</p>
            <p className="text-muted-foreground">Todas as inspeções são armazenadas com segurança via Supabase.</p>
          </div>
          <Button variant="outline" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Exportar todos os dados (JSON)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CrmTab() {
  return (
    <div className="space-y-8">
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
        <CatalogoCard
          titulo="Nichos de Busca"
          descricao='Categorias usadas em "Buscar Leads" (ex: Restaurante, Padaria).'
          useList={useCrmLeadsNichos}
          useUpsert={useUpsertCrmLeadsNicho}
          useDelete={useDeleteCrmLeadsNicho}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Integrações</h2>
        <GooglePlacesIntegrationCard />
      </div>
    </div>
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
      toast.success('Chave salva. Clique em "Testar conexão" para validar.');
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar a chave.");
    }
  };

  const handleTest = async () => {
    try {
      const result = await test.mutateAsync();
      if (result.status === "conectado") toast.success("Conexão validada com sucesso.");
      else
        toast.error(
          "Não foi possível validar a chave. Verifique se ela está correta e com a Places API (New) habilitada.",
        );
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

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "outline" | "destructive" }> = {
  active: { label: "Ativo", variant: "default" },
  trialing: { label: "Em demonstração", variant: "outline" },
  trial_expired: { label: "Demonstração encerrada", variant: "destructive" },
  past_due_warning: { label: "Pagamento em atraso", variant: "destructive" },
  blocked: { label: "Bloqueado", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "outline" },
  no_subscription: { label: "Sem assinatura", variant: "outline" },
};

function fmtDataHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface PagamentoHistorico {
  id: string;
  valor_cobrado: number;
  forma_pagamento: string | null;
  status: string;
  paid_at: string | null;
  invoice_url: string | null;
  created_at: string;
}

function usePagamentosHistorico(empresaId: string | undefined) {
  return useQuery({
    queryKey: ["saas-pagamentos-historico", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_pagamentos")
        .select("id, valor_cobrado, forma_pagamento, status, paid_at, invoice_url, created_at")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PagamentoHistorico[];
    },
  });
}

function CobrancaTab() {
  const { data: profile } = useCurrentProfile();
  const { data: status, isLoading: statusLoading } = useTenantAccessStatus();
  const { data: pagamentos = [], isLoading: pagamentosLoading } = usePagamentosHistorico(profile?.empresa_id);
  const [iniciandoCheckout, setIniciandoCheckout] = useState<"mensal" | "anual" | null>(null);

  const handleAssinar = async (periodicidade: "mensal" | "anual") => {
    setIniciandoCheckout(periodicidade);
    try {
      const { data, error } = await supabase.functions.invoke("criar-checkout", {
        body: { periodicidade },
      });
      if (error || !data?.checkoutUrl) throw error || new Error("Sem URL de checkout");
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      toast.error(err.message || "Não foi possível iniciar o pagamento. Tente novamente.");
      setIniciandoCheckout(null);
    }
  };

  const ultimaFaturaAberta = pagamentos.find((p) => ["pendente", "atrasado"].includes(p.status));

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const badge = STATUS_LABEL[status?.status ?? "no_subscription"];
  const precisaContratar = status?.status === "trialing" || status?.status === "trial_expired" || status?.status === "no_subscription";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Plano atual</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {status?.plano_codigo && (
              <span className="text-sm text-muted-foreground">
                {status.plano_codigo === "trial" ? "Demonstração" : "Plano pago"}
                {status.periodicidade ? ` · ${status.periodicidade === "mensal" ? "Mensal" : "Anual"}` : ""}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {status?.trial_ends_at && (
              <div>
                <span className="font-medium">Fim da demonstração: </span>
                {fmtDataHora(status.trial_ends_at)}
              </div>
            )}
            {status?.current_period_end && (
              <div>
                <span className="font-medium">Próxima cobrança: </span>
                {fmtDataHora(status.current_period_end)}
              </div>
            )}
            {typeof status?.dias_atraso === "number" && status.dias_atraso > 0 && (
              <div className="text-destructive">
                <span className="font-medium">Dias em atraso: </span>
                {status.dias_atraso}
              </div>
            )}
            {typeof status?.dias_para_bloqueio === "number" && status.status === "past_due_warning" && (
              <div className="text-destructive">
                <span className="font-medium">Bloqueio em: </span>
                {status.dias_para_bloqueio} dia{status.dias_para_bloqueio === 1 ? "" : "s"}
              </div>
            )}
          </div>

          {(status?.status === "past_due_warning" || status?.status === "blocked") && ultimaFaturaAberta?.invoice_url && (
            <Button asChild variant="outline" className="gap-2">
              <a href={ultimaFaturaAberta.invoice_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Ver fatura em aberto
              </a>
            </Button>
          )}

          {precisaContratar && (
            <div className="space-y-2 rounded-md border border-border p-4">
              <p className="text-sm font-medium">
                {status?.status === "trial_expired" ? "Sua demonstração acabou — escolha um plano para continuar." : "Contratar um plano pago"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleAssinar("mensal")} disabled={iniciandoCheckout !== null}>
                  {iniciandoCheckout === "mensal" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar mensal — R$ 120/mês"}
                </Button>
                <Button variant="outline" onClick={() => handleAssinar("anual")} disabled={iniciandoCheckout !== null}>
                  {iniciandoCheckout === "anual" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar anual — R$ 1.250"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pagamentosLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Data</TableHead>
                    <TableHead className="font-bold">Valor</TableHead>
                    <TableHead className="font-bold">Forma</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold text-right">Fatura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                        Nenhum pagamento registrado ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagamentos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs text-muted-foreground">{fmtDataHora(p.paid_at ?? p.created_at)}</TableCell>
                        <TableCell className="text-sm">
                          {p.valor_cobrado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="text-sm">{p.forma_pagamento ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.invoice_url ? (
                            <a
                              href={p.invoice_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              Ver
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
          <Input placeholder="Novo item..." value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
          <Button type="submit" size="icon" disabled={upsert.isPending || !novoNome.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

