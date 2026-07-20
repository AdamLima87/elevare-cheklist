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
import { Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useCrmEmpresa, type CrmEmpresaStatus } from "@/hooks/useCrmEmpresas";
import { useCrmContatos, useUpsertCrmContato, useDeleteCrmContato } from "@/hooks/useCrmContatos";

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
              </TabsContent>

              <TabsContent value="contatos">
                <ContatosTab crmEmpresaId={id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </AppShell>
    </ProtectedRoute>
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
