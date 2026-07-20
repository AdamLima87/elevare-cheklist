import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Search, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useCrmEmpresasComScore, useUpsertCrmEmpresa, type CrmEmpresaStatus } from "@/hooks/useCrmEmpresas";
import { CrmLeadScoreBadge } from "@/components/crm/CrmLeadScoreBadge";

const STATUS_LABEL: Record<CrmEmpresaStatus, string> = {
  lead: "Lead",
  prospect: "Prospect",
  ativa: "Ativa",
  inativa: "Inativa",
};

export const Route = createFileRoute("/crm/empresas/")({
  head: () => ({
    meta: [
      { title: "Contas · CRM Comercial · RDCheck" },
      { name: "description", content: "Contas do CRM Comercial." },
    ],
  }),
  component: CrmEmpresasPage,
});

function CrmEmpresasPage() {
  const navigate = useNavigate();
  const { data: profile } = useCurrentProfile();
  const [search, setSearch] = useState("");
  const { data: contas = [], isLoading } = useCrmEmpresasComScore(search || undefined);
  const upsertCrmEmpresa = useUpsertCrmEmpresa();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ razao_social: "", nome_fantasia: "", cnpj: "", cidade: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id) {
      toast.error("Seu usuário não está associado a uma empresa.");
      return;
    }
    try {
      await upsertCrmEmpresa.mutateAsync({
        empresa_id: profile.empresa_id,
        razao_social: form.razao_social,
        nome_fantasia: form.nome_fantasia || null,
        cnpj: form.cnpj.replace(/\D/g, "") || null,
        cidade: form.cidade || null,
        responsavel_id: profile.userId,
      });
      toast.success("Conta cadastrada!");
      setOpen(false);
      setForm({ razao_social: "", nome_fantasia: "", cnpj: "", cidade: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao cadastrar conta");
    }
  };

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold">Contas</h1>
            <p className="text-sm text-muted-foreground">
              Contas comerciais do CRM — do lead até virar cliente.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Cadastrar Conta</DialogTitle>
                  <DialogDescription>Adicione uma nova conta comercial ao CRM.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="razao_social">Razão Social</Label>
                    <Input
                      id="razao_social"
                      value={form.razao_social}
                      onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                    <Input
                      id="nome_fantasia"
                      value={form.nome_fantasia}
                      onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      placeholder="00.000.000/0000-00"
                      value={form.cnpj}
                      onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={form.cidade}
                      onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={upsertCrmEmpresa.isPending} className="w-full">
                    {upsertCrmEmpresa.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Cadastrar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por razão social, fantasia ou CNPJ..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
                      <TableHead className="font-bold">Razão Social</TableHead>
                      <TableHead className="font-bold">CNPJ</TableHead>
                      <TableHead className="font-bold">Cidade</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="font-bold">Score</TableHead>
                      <TableHead className="text-right font-bold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          Nenhuma conta cadastrada ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      contas.map((conta) => (
                        <TableRow key={conta.id}>
                          <TableCell className="py-4 font-medium">
                            {conta.nome_fantasia || conta.razao_social}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{conta.cnpj || "---"}</TableCell>
                          <TableCell className="text-sm">{conta.cidade || "---"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{STATUS_LABEL[conta.status]}</Badge>
                          </TableCell>
                          <TableCell>
                            <CrmLeadScoreBadge score={conta.score} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => navigate({ to: "/crm/empresas/$id", params: { id: conta.id } })}
                            >
                              Ver conta <ArrowRight className="h-4 w-4" />
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
      </AppShell>
    </ProtectedRoute>
  );
}
