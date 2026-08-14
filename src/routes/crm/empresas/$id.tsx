import { useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, Plus, Trash2, CheckCircle2, Star, Save } from "lucide-react";
import { toast } from "sonner";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import {
  useCrmEmpresa,
  useUpsertCrmEmpresa,
  type CrmEmpresa,
  type CrmEmpresaStatus,
  type CrmEmpresaTipoPessoa,
} from "@/hooks/useCrmEmpresas";
import {
  useCrmRepresentantes,
  useUpsertCrmRepresentante,
  useMarcarRepresentantePrincipal,
  useRemoverCrmRepresentante,
} from "@/hooks/useCrmRepresentantes";
import { useCrmContatos, useUpsertCrmContato, useDeleteCrmContato } from "@/hooks/useCrmContatos";
import { useCrmTiposAtividade } from "@/hooks/useCrmCatalogos";
import {
  useCrmAtividadesPorConta,
  useCriarCrmAtividade,
  useConcluirCrmAtividade,
  type CrmAtividade,
} from "@/hooks/useCrmAtividades";
import { isProximaAcaoObrigatoriaError, useCrmOportunidadesPorConta } from "@/hooks/useCrmOportunidades";
import { NextActionRequiredDialog } from "@/components/crm/NextActionRequiredDialog";

const STATUS_LABEL: Record<CrmEmpresaStatus, string> = {
  lead: "Lead",
  prospect: "Prospect",
  ativa: "Ativa",
  inativa: "Inativa",
};

export const Route = createFileRoute("/crm/empresas/$id")({
  head: () => ({
    meta: [{ title: "Conta · CRM Comercial · RDCheck" }],
  }),
  component: CrmEmpresaDetailPage,
});

function CrmEmpresaDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/crm/empresas/$id" });
  const { data: conta, isLoading } = useCrmEmpresa(id);

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/crm/empresas" })} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{conta?.nome_fantasia || conta?.razao_social || "Conta"}</h1>
                {conta && <Badge variant="outline">{STATUS_LABEL[conta.status]}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {conta?.razao_social && conta.nome_fantasia ? `${conta.razao_social} · ` : ""}
                {conta?.cnpj ? `CNPJ: ${conta.cnpj}` : "Sem CNPJ cadastrado"}
                {conta?.cidade ? ` · ${conta.cidade}` : ""}
              </p>
            </div>

            <Tabs defaultValue="geral">
              <TabsList>
                <TabsTrigger value="geral">Visão Geral</TabsTrigger>
                <TabsTrigger value="contatos">Contatos</TabsTrigger>
                <TabsTrigger value="atividades">Atividades</TabsTrigger>
                <TabsTrigger value="contrato">Dados para Contrato</TabsTrigger>
              </TabsList>

              <TabsContent value="geral">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Dados da conta</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Segmento</p>
                      <p>{conta?.segmento || "---"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Número de unidades</p>
                      <p>{conta?.numero_unidades ?? "---"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Site</p>
                      <p>{conta?.site || "---"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">WhatsApp</p>
                      <p>{conta?.whatsapp || "---"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Instagram</p>
                      <p>{conta?.instagram || "---"}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">Observações</p>
                      <p className="whitespace-pre-wrap">{conta?.observacoes || "---"}</p>
                    </div>
                  </CardContent>
                </Card>

                <OportunidadesDaContaCard crmEmpresaId={id} />
              </TabsContent>

              <TabsContent value="contatos">
                <ContatosTab crmEmpresaId={id} />
              </TabsContent>

              <TabsContent value="atividades">
                <AtividadesTab crmEmpresaId={id} />
              </TabsContent>

              <TabsContent value="contrato">
                {conta && <DadosContratoTab conta={conta} />}
              </TabsContent>
            </Tabs>
          </>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}

function OportunidadesDaContaCard({ crmEmpresaId }: { crmEmpresaId: string }) {
  const navigate = useNavigate();
  const { data: oportunidades = [], isLoading } = useCrmOportunidadesPorConta(crmEmpresaId);

  if (isLoading || oportunidades.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Oportunidades desta Conta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {oportunidades.map((op) => (
          <button
            key={op.id}
            type="button"
            onClick={() => navigate({ to: "/crm/oportunidades/$id", params: { id: op.id } })}
            className="flex w-full items-center justify-between rounded-md border p-2 text-left text-sm hover:bg-accent"
          >
            <span>{op.nome}</span>
            {op.fechada_em && <Badge variant="outline">fechada</Badge>}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function ContatosTab({ crmEmpresaId }: { crmEmpresaId: string }) {
  const { data: profile } = useCurrentProfile();
  const { data: contatos = [], isLoading } = useCrmContatos(crmEmpresaId);
  const upsertContato = useUpsertCrmContato();
  const deleteContato = useDeleteCrmContato();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cargo: "", telefone: "", whatsapp: "", email: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id) {
      toast.error("Seu usuário não está associado a uma empresa.");
      return;
    }
    try {
      await upsertContato.mutateAsync({
        empresa_id: profile.empresa_id,
        crm_empresa_id: crmEmpresaId,
        nome: form.nome,
        cargo: form.cargo || null,
        telefone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
      });
      toast.success("Contato cadastrado!");
      setOpen(false);
      setForm({ nome: "", cargo: "", telefone: "", whatsapp: "", email: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao cadastrar contato");
    }
  };

  const handleDelete = async (contatoId: string) => {
    try {
      await deleteContato.mutateAsync({ id: contatoId, crm_empresa_id: crmEmpresaId });
      toast.success("Contato removido.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover contato");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Contatos</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo Contato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Cadastrar Contato</DialogTitle>
                <DialogDescription>Adicione uma pessoa de contato desta conta.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input
                    id="cargo"
                    placeholder="Ex: Proprietário, Nutricionista..."
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={upsertContato.isPending} className="w-full">
                  {upsertContato.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : contatos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum contato cadastrado ainda.</p>
        ) : (
          contatos.map((contato) => (
            <div
              key={contato.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium">{contato.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {[contato.cargo, contato.telefone, contato.email].filter(Boolean).join(" · ") || "---"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(contato.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AtividadesTab({ crmEmpresaId }: { crmEmpresaId: string }) {
  const { data: profile } = useCurrentProfile();
  const { data: atividades = [], isLoading } = useCrmAtividadesPorConta(crmEmpresaId);
  const { data: tiposAtividade = [] } = useCrmTiposAtividade();
  const criarAtividade = useCriarCrmAtividade();
  const concluirAtividade = useConcluirCrmAtividade();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo_id: "", vencimento: "", observacoes: "" });
  const [concluindoId, setConcluindoId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id || !form.tipo_id || !form.vencimento) return;
    try {
      await criarAtividade.mutateAsync({
        empresa_id: profile.empresa_id,
        crm_empresa_id: crmEmpresaId,
        tipo_id: form.tipo_id,
        responsavel_id: profile.userId,
        vencimento: new Date(form.vencimento).toISOString(),
        observacoes: form.observacoes || null,
      });
      toast.success("Atividade agendada!");
      setOpen(false);
      setForm({ tipo_id: "", vencimento: "", observacoes: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao agendar atividade");
    }
  };

  const handleConcluir = async (atividade: CrmAtividade) => {
    try {
      await concluirAtividade.mutateAsync({ id: atividade.id, resultado: "Concluída" });
      toast.success("Atividade concluída!");
    } catch (error: any) {
      if (isProximaAcaoObrigatoriaError(error)) {
        setConcluindoId(atividade.id);
        return;
      }
      toast.error(error.message || "Erro ao concluir atividade");
    }
  };

  const handleConfirmarProximaAcao = async (tipoId: string, vencimentoIso: string) => {
    if (!concluindoId) return;
    try {
      await concluirAtividade.mutateAsync({
        id: concluindoId,
        resultado: "Concluída",
        nova_atividade_tipo_id: tipoId,
        nova_atividade_vencimento: vencimentoIso,
      });
      toast.success("Atividade concluída e próxima agendada!");
      setConcluindoId(null);
    } catch (error: any) {
      toast.error(error.message || "Erro ao concluir atividade");
    }
  };

  const pendentes = atividades.filter((a) => a.status === "pendente");
  const outras = atividades.filter((a) => a.status !== "pendente");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Atividades</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Agendar Atividade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Agendar Atividade</DialogTitle>
                <DialogDescription>Crie uma atividade ligada a esta conta.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={form.tipo_id} onValueChange={(v) => setForm({ ...form, tipo_id: v })}>
                    <SelectTrigger id="tipo">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposAtividade.map((tipo) => (
                        <SelectItem key={tipo.id} value={tipo.id}>
                          {tipo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vencimento">Quando</Label>
                  <Input
                    id="vencimento"
                    type="datetime-local"
                    value={form.vencimento}
                    onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Input
                    id="observacoes"
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={criarAtividade.isPending} className="w-full">
                  {criarAtividade.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Agendar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : atividades.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma atividade agendada ainda.</p>
        ) : (
          <>
            {pendentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Pendentes</p>
                {pendentes.map((atividade) => (
                  <div
                    key={atividade.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{atividade.crm_tipos_atividade?.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(atividade.vencimento).toLocaleString("pt-BR")}
                        {atividade.observacoes ? ` · ${atividade.observacoes}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleConcluir(atividade)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {outras.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Histórico</p>
                {outras.map((atividade) => (
                  <div
                    key={atividade.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3 opacity-70"
                  >
                    <div>
                      <p className="text-sm font-medium">{atividade.crm_tipos_atividade?.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(atividade.vencimento).toLocaleString("pt-BR")}
                        {atividade.resultado ? ` · ${atividade.resultado}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline">{atividade.status === "concluida" ? "Concluída" : "Cancelada"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <NextActionRequiredDialog
        open={!!concluindoId}
        onOpenChange={(v) => !v && setConcluindoId(null)}
        tiposAtividade={tiposAtividade}
        onConfirm={handleConfirmarProximaAcao}
        isPending={concluirAtividade.isPending}
        title="Agende a próxima ação"
        description="Esta é a última atividade pendente de uma oportunidade em aberto. Agende a próxima antes de concluir."
      />
    </Card>
  );
}

// Dados jurídicos + representantes — nada aqui é obrigatório pra cadastrar
// um lead/oportunidade. Só passa a ser exigido na hora de gerar um
// contrato de verdade (Fase D do módulo comercial), quando a validação
// completa de completude acontece no servidor.
function DadosContratoTab({ conta }: { conta: CrmEmpresa }) {
  const { data: profile } = useCurrentProfile();
  const upsertConta = useUpsertCrmEmpresa();

  const [form, setForm] = useState({
    tipo_pessoa: (conta.tipo_pessoa ?? "juridica") as CrmEmpresaTipoPessoa,
    razao_social: conta.razao_social ?? "",
    cnpj: conta.cnpj ?? "",
    nome_completo_pf: conta.nome_completo_pf ?? "",
    cpf: conta.cpf ?? "",
    cep: conta.cep ?? "",
    endereco: conta.endereco ?? "",
    numero: conta.numero ?? "",
    complemento: conta.complemento ?? "",
    bairro: conta.bairro ?? "",
    cidade_endereco: conta.cidade_endereco ?? "",
    uf_endereco: conta.uf_endereco ?? "",
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id) return;
    try {
      await upsertConta.mutateAsync({
        id: conta.id,
        empresa_id: profile.empresa_id,
        razao_social: form.razao_social,
        responsavel_id: conta.responsavel_id,
        status: conta.status,
        tipo_pessoa: form.tipo_pessoa,
        cnpj: form.tipo_pessoa === "juridica" ? form.cnpj || null : conta.cnpj,
        nome_completo_pf: form.tipo_pessoa === "fisica" ? form.nome_completo_pf || null : null,
        cpf: form.tipo_pessoa === "fisica" ? form.cpf || null : null,
        cep: form.cep || null,
        endereco: form.endereco || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        cidade_endereco: form.cidade_endereco || null,
        uf_endereco: form.uf_endereco || null,
      });
      toast.success("Dados para contrato salvos!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar dados para contrato");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados jurídicos da Conta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select
                value={form.tipo_pessoa}
                onValueChange={(v) => setForm({ ...form, tipo_pessoa: v as CrmEmpresaTipoPessoa })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                  <SelectItem value="fisica">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.tipo_pessoa === "juridica" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="razao_social">Razão social</Label>
                  <Input
                    id="razao_social"
                    value={form.razao_social}
                    onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input id="cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="nome_completo_pf">Nome completo</Label>
                  <Input
                    id="nome_completo_pf"
                    value={form.nome_completo_pf}
                    onChange={(e) => setForm({ ...form, nome_completo_pf: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cpf_pf">CPF</Label>
                  <Input id="cpf_pf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={form.complemento}
                  onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cidade_endereco">Cidade</Label>
                <Input
                  id="cidade_endereco"
                  value={form.cidade_endereco}
                  onChange={(e) => setForm({ ...form, cidade_endereco: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uf_endereco">UF</Label>
                <Input
                  id="uf_endereco"
                  maxLength={2}
                  value={form.uf_endereco}
                  onChange={(e) => setForm({ ...form, uf_endereco: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <Button type="submit" disabled={upsertConta.isPending} className="gap-1.5">
              {upsertConta.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar dados jurídicos
            </Button>
          </form>
        </CardContent>
      </Card>

      <RepresentantesCard crmEmpresaId={conta.id} />
    </div>
  );
}

// Representantes legais — só relevante pra assinar contrato quando a Conta
// é pessoa jurídica, mas a seção fica visível independente do tipo (não
// bloqueada pra PF, só não é exigida na validação de contrato).
function RepresentantesCard({ crmEmpresaId }: { crmEmpresaId: string }) {
  const { data: profile } = useCurrentProfile();
  const { data: representantes = [], isLoading } = useCrmRepresentantes(crmEmpresaId);
  const upsertRepresentante = useUpsertCrmRepresentante();
  const marcarPrincipal = useMarcarRepresentantePrincipal();
  const removerRepresentante = useRemoverCrmRepresentante();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome_completo: "", cpf: "", rg: "", cargo: "", email: "", telefone: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id) return;
    try {
      await upsertRepresentante.mutateAsync({
        empresa_id: profile.empresa_id,
        crm_empresa_id: crmEmpresaId,
        nome_completo: form.nome_completo,
        cpf: form.cpf || null,
        rg: form.rg || null,
        cargo: form.cargo || null,
        email: form.email || null,
        telefone: form.telefone || null,
        principal: representantes.length === 0, // primeiro cadastrado já vira principal
      });
      toast.success("Representante cadastrado!");
      setOpen(false);
      setForm({ nome_completo: "", cpf: "", rg: "", cargo: "", email: "", telefone: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao cadastrar representante");
    }
  };

  const handleMarcarPrincipal = async (id: string) => {
    try {
      await marcarPrincipal.mutateAsync({ id, crmEmpresaId });
      toast.success("Representante principal atualizado.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao marcar como principal");
    }
  };

  const handleRemover = async (id: string) => {
    try {
      await removerRepresentante.mutateAsync({ id, crmEmpresaId });
      toast.success("Representante removido.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover representante");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Representantes legais</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo Representante
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Cadastrar Representante</DialogTitle>
                <DialogDescription>
                  Pessoa com poder pra assinar contratos em nome desta Conta. Nome e CPF são impressos no contrato
                  como identificação de quem assina em nome da empresa.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="rep_nome">Nome completo</Label>
                  <Input
                    id="rep_nome"
                    value={form.nome_completo}
                    onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="rep_cpf">CPF</Label>
                    <Input id="rep_cpf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rep_rg">RG <span className="font-normal text-muted-foreground">(hoje não usado em nenhum documento)</span></Label>
                    <Input id="rep_rg" value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rep_cargo">Cargo</Label>
                  <Input
                    id="rep_cargo"
                    placeholder="Ex: Sócio-administrador"
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="rep_email">E-mail</Label>
                    <Input
                      id="rep_email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rep_telefone">Telefone</Label>
                    <Input
                      id="rep_telefone"
                      value={form.telefone}
                      onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={upsertRepresentante.isPending} className="w-full">
                  {upsertRepresentante.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : representantes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum representante cadastrado ainda.</p>
        ) : (
          representantes.map((rep) => (
            <div key={rep.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium">{rep.nome_completo}</p>
                  {rep.principal && (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Star className="h-3 w-3 fill-current" /> Principal
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[rep.cargo, rep.cpf, rep.email].filter(Boolean).join(" · ") || "---"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!rep.principal && (
                  <Button variant="outline" size="sm" onClick={() => handleMarcarPrincipal(rep.id)}>
                    Tornar principal
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemover(rep.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
