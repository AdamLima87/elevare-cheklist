import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEmpresas, useCreateEmpresa } from "@/hooks/useEmpresas";

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas · Elevare" },
      { name: "description", content: "Gestão das empresas (tenants) da plataforma." },
    ],
  }),
  component: EmpresasPage,
});

function EmpresasPage() {
  const { data: empresas = [], isLoading } = useEmpresas();
  const createEmpresa = useCreateEmpresa();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    empresaNome: "",
    empresaCnpj: "",
    plano: "trial",
    adminNome: "",
    adminEmail: "",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createEmpresa.mutateAsync(form);
      toast.success(
        `Empresa "${form.empresaNome}" criada! Senha provisória do admin: ${result.tempPassword}`,
        { duration: 15000 },
      );
      setOpen(false);
      setForm({ empresaNome: "", empresaCnpj: "", plano: "trial", adminNome: "", adminEmail: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar empresa");
    }
  };

  return (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <AppShell>
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold">Empresas</h1>
            <p className="text-sm text-muted-foreground">
              Consultorias que usam a plataforma (multi-tenant).
            </p>
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
                    Cria a empresa e o primeiro usuário admin dela. A senha provisória é enviada
                    por e-mail e obriga a troca no primeiro acesso.
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
                    {createEmpresa.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Cadastrar Empresa"
                    )}
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
                      <TableHead className="font-bold">CNPJ</TableHead>
                      <TableHead className="font-bold">Plano</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empresas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          Nenhuma empresa cadastrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      empresas.map((empresa) => (
                        <TableRow key={empresa.id}>
                          <TableCell className="font-medium py-4">{empresa.nome}</TableCell>
                          <TableCell className="text-sm font-mono">{empresa.cnpj || "---"}</TableCell>
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
