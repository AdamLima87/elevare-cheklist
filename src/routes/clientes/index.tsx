import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2, Plus, Search, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useClientes, useUpsertCliente, type ClienteStatus } from "@/hooks/useClientes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clientes/")({
  validateSearch: (search: Record<string, unknown>) => ({
    new: Boolean(search.new),
  }),
  head: () => ({
    meta: [
      { title: "Clientes · RDCheck" },
      { name: "description", content: "Cadastro de clientes e estabelecimentos." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const navigate = useNavigate();
  const { new: openNewParam } = Route.useSearch();
  const { data: profile } = useCurrentProfile();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClienteStatus>("ativo");
  const { data: clientes = [], isLoading } = useClientes(search || undefined, statusFilter);
  const upsertCliente = useUpsertCliente();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", categoria: "" });

  useEffect(() => {
    if (openNewParam) setOpen(true);
  }, [openNewParam]);

  const filtered = useMemo(() => clientes, [clientes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresa_id) {
      toast.error("Seu usuário não está associado a uma empresa.");
      return;
    }
    try {
      await upsertCliente.mutateAsync({
        empresa_id: profile.empresa_id,
        nome: form.nome,
        cnpj: form.cnpj.replace(/\D/g, "") || null,
        categoria: form.categoria || null,
      });
      toast.success("Cliente cadastrado com sucesso!");
      setOpen(false);
      setForm({ nome: "", cnpj: "", categoria: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao cadastrar cliente");
    }
  };

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold">Clientes</h1>
            <p className="text-sm text-muted-foreground">
              Estabelecimentos cadastrados e seu histórico de inspeções.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Cadastrar Cliente</DialogTitle>
                  <DialogDescription>
                    Cadastre um estabelecimento para vincular às inspeções.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nome">Nome / Razão Social</Label>
                    <Input
                      id="nome"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      required
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
                    <Label htmlFor="categoria">Categoria</Label>
                    <Input
                      id="categoria"
                      placeholder="Ex: Restaurante, Padaria..."
                      value={form.categoria}
                      onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={upsertCliente.isPending} className="w-full">
                    {upsertCliente.isPending ? (
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

        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CNPJ..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => setStatusFilter("ativo")}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                statusFilter === "ativo" ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              Ativos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("prospeccao")}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                statusFilter === "prospeccao" ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              Prospecção
            </button>
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
                      <TableHead className="font-bold">Nome</TableHead>
                      <TableHead className="font-bold">CNPJ</TableHead>
                      <TableHead className="font-bold">Categoria</TableHead>
                      <TableHead className="text-right font-bold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          {statusFilter === "prospeccao"
                            ? "Nenhum prospect em andamento. Cadastre um na tela de Prospecção."
                            : "Nenhum cliente cadastrado ainda."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-medium py-4">{cliente.nome}</TableCell>
                          <TableCell className="text-sm font-mono">
                            {cliente.cnpj || "---"}
                          </TableCell>
                          <TableCell className="text-sm">{cliente.categoria || "---"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => navigate({ to: "/clientes/$id", params: { id: cliente.id } })}
                            >
                              <Building2 className="h-4 w-4" /> Ver histórico
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
