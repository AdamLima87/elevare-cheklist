import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEmpresas, useCreateEmpresa } from "@/hooks/useEmpresas";
import {
  usePlatformEmpresas,
  usePlatformPlanos,
  useAtualizarEmpresaStatus,
  useAtualizarEmpresaPlano,
  useEstenderTrial,
  useDefinirOverrideLimite,
} from "@/hooks/usePlatform";
import type { PlatformEmpresaResumo } from "@/lib/platform/platformService";

export const Route = createFileRoute("/plataforma/empresas")({
  head: () => ({ meta: [{ title: "Empresas · Administração da Plataforma · RDCheck" }] }),
  component: PlatformEmpresasPage,
});

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function PlatformEmpresasPage() {
  const { data: empresas = [], isLoading } = usePlatformEmpresas();
  const createEmpresa = useCreateEmpresa();
  // useEmpresas() já invalida a mesma lista que o dashboard/tenant usam;
  // a criação de tenant continua sendo feita via admin-manage-users
  // (mesmo fluxo de sempre) — só a LEITURA de métricas vem da RPC nova.
  useEmpresas();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    empresaNome: "",
    empresaCnpj: "",
    plano: "trial",
    adminNome: "",
    adminEmail: "",
  });
  const [gerenciando, setGerenciando] = useState<PlatformEmpresaResumo | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createEmpresa.mutateAsync(form);
      toast.success(`Empresa "${form.empresaNome}" criada! Senha provisória do admin: ${result.tempPassword}`, {
        duration: 15000,
      });
      setOpen(false);
      setForm({ empresaNome: "", empresaCnpj: "", plano: "trial", adminNome: "", adminEmail: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar empresa");
    }
  };

  return (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Empresas</h1>
            <p className="text-sm text-muted-foreground">Gestão global de tenants (consultorias) do RDCheck.</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nova Empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Cadastrar Nova Empresa</DialogTitle>
                  <DialogDescription>
                    Cria a empresa e o primeiro usuário admin dela. A senha provisória é enviada por e-mail e obriga a
                    troca no primeiro acesso.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="empresaNome">Nome da Empresa</Label>
                    <Input
                      id="empresaNome"
                      value={form.empresaNome}
                      onChange={(e) => setForm({ ...form, empresaNome: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="empresaCnpj">CNPJ (opcional)</Label>
                    <Input
                      id="empresaCnpj"
                      value={form.empresaCnpj}
                      onChange={(e) => setForm({ ...form, empresaCnpj: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="adminNome">Nome do Admin</Label>
                    <Input
                      id="adminNome"
                      value={form.adminNome}
                      onChange={(e) => setForm({ ...form, adminNome: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="adminEmail">E-mail do Admin</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={form.adminEmail}
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createEmpresa.isPending} className="w-full">
                    {createEmpresa.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Cadastrar Empresa"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Nome</TableHead>
                      <TableHead className="font-bold">Plano</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="font-bold">Trial até</TableHead>
                      <TableHead className="font-bold text-center">Usuários</TableHead>
                      <TableHead className="font-bold text-center">Clientes</TableHead>
                      <TableHead className="font-bold text-center">Inspeções</TableHead>
                      <TableHead className="font-bold text-center">Oport.</TableHead>
                      <TableHead className="font-bold text-center">Leads</TableHead>
                      <TableHead className="font-bold">Último acesso</TableHead>
                      <TableHead className="font-bold">Criada em</TableHead>
                      <TableHead className="font-bold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empresas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                          Nenhuma empresa cadastrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      empresas.map((empresa) => (
                        <TableRow key={empresa.id}>
                          <TableCell className="py-4 font-medium">{empresa.nome}</TableCell>
                          <TableCell className="text-sm capitalize">{empresa.plano}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  empresa.status === "ativo" ? "bg-green-500" : "bg-red-500",
                                )}
                              />
                              <span className="text-xs font-medium capitalize">{empresa.status}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtData(empresa.trial_ends_at)}</TableCell>
                          <TableCell className="text-center text-sm">{empresa.usuarios}</TableCell>
                          <TableCell className="text-center text-sm">{empresa.clientes}</TableCell>
                          <TableCell className="text-center text-sm">{empresa.inspecoes}</TableCell>
                          <TableCell className="text-center text-sm">{empresa.oportunidades}</TableCell>
                          <TableCell className="text-center text-sm">{empresa.leads_importados}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtData(empresa.ultimo_acesso)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtData(empresa.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setGerenciando(empresa)}>
                              <Settings2 className="h-3.5 w-3.5" /> Gerenciar
                            </Button>
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

        <GerenciarEmpresaDialog empresa={gerenciando} onOpenChange={(v) => !v && setGerenciando(null)} />
      </PlatformLayout>
    </ProtectedRoute>
  );
}

function GerenciarEmpresaDialog({
  empresa,
  onOpenChange,
}: {
  empresa: PlatformEmpresaResumo | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: planos = [] } = usePlatformPlanos();
  const atualizarStatus = useAtualizarEmpresaStatus();
  const atualizarPlano = useAtualizarEmpresaPlano();
  const estenderTrial = useEstenderTrial();
  const definirOverride = useDefinirOverrideLimite();

  const [novoPlano, setNovoPlano] = useState("");
  const [novoTrial, setNovoTrial] = useState("");
  const [overrideKey, setOverrideKey] = useState("");
  const [overrideValor, setOverrideValor] = useState("");
  const [overrideMotivo, setOverrideMotivo] = useState("");

  if (!empresa) return null;

  const handleToggleStatus = async () => {
    const novoStatus = empresa.status === "ativo" ? "inativo" : "ativo";
    try {
      await atualizarStatus.mutateAsync({ empresaId: empresa.id, status: novoStatus });
      toast.success(`Empresa ${novoStatus === "ativo" ? "ativada" : "suspensa"}.`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar status.");
    }
  };

  const handleAlterarPlano = async () => {
    if (!novoPlano) return;
    try {
      await atualizarPlano.mutateAsync({ empresaId: empresa.id, plano: novoPlano });
      toast.success("Plano alterado.");
      setNovoPlano("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar plano.");
    }
  };

  const handleEstenderTrial = async () => {
    if (!novoTrial) return;
    try {
      await estenderTrial.mutateAsync({ empresaId: empresa.id, novoTrialEndsAt: new Date(novoTrial).toISOString() });
      toast.success("Trial estendido.");
      setNovoTrial("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao estender trial.");
    }
  };

  const handleOverride = async () => {
    if (!overrideKey.trim() || !overrideValor.trim()) return;
    try {
      await definirOverride.mutateAsync({
        empresaId: empresa.id,
        limiteKey: overrideKey.trim(),
        valor: Number(overrideValor),
        motivo: overrideMotivo.trim(),
      });
      toast.success("Override de limite aplicado.");
      setOverrideKey("");
      setOverrideValor("");
      setOverrideMotivo("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao aplicar override.");
    }
  };

  return (
    <Dialog open={!!empresa} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{empresa.nome}</DialogTitle>
          <DialogDescription>Toda alteração aqui fica registrada na Auditoria.</DialogDescription>
        </DialogHeader>
        <div className="-mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          Plano atual: <Badge variant="outline">{empresa.plano}</Badge>
          Status: <Badge variant="outline">{empresa.status}</Badge>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Status da empresa</p>
              <p className="text-xs text-muted-foreground">Suspender bloqueia o acesso de todos os usuários dela.</p>
            </div>
            <Button
              variant={empresa.status === "ativo" ? "destructive" : "default"}
              size="sm"
              onClick={handleToggleStatus}
              disabled={atualizarStatus.isPending}
            >
              {atualizarStatus.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : empresa.status === "ativo" ? (
                "Suspender"
              ) : (
                "Ativar"
              )}
            </Button>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">Alterar plano</p>
            <div className="flex gap-2">
              <Select value={novoPlano} onValueChange={setNovoPlano}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {planos.map((p) => (
                    <SelectItem key={p.id} value={p.codigo}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAlterarPlano} disabled={!novoPlano || atualizarPlano.isPending}>
                {atualizarPlano.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">Estender trial</p>
            <div className="flex gap-2">
              <Input type="date" value={novoTrial} onChange={(e) => setNovoTrial(e.target.value)} className="flex-1" />
              <Button onClick={handleEstenderTrial} disabled={!novoTrial || estenderTrial.isPending}>
                {estenderTrial.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">Override de limite (pontual, sem mudar o plano)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="ex: crm_leads_mensal" value={overrideKey} onChange={(e) => setOverrideKey(e.target.value)} />
              <Input placeholder="Novo valor" type="number" value={overrideValor} onChange={(e) => setOverrideValor(e.target.value)} />
            </div>
            <Input placeholder="Motivo (opcional)" value={overrideMotivo} onChange={(e) => setOverrideMotivo(e.target.value)} />
            <Button
              variant="outline"
              className="w-full"
              onClick={handleOverride}
              disabled={!overrideKey.trim() || !overrideValor.trim() || definirOverride.isPending}
            >
              {definirOverride.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar override"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
