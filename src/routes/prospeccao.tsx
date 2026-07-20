import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import {
  useClientes,
  useUpsertCliente,
  useUpdateClienteFunil,
  useConverterProspectEmCliente,
  ETAPAS_FUNIL,
  type Cliente,
} from "@/hooks/useClientes";

export const Route = createFileRoute("/prospeccao")({
  head: () => ({
    meta: [
      { title: "Prospecção · RDCheck" },
      { name: "description", content: "Pipeline de novos clientes em prospecção." },
    ],
  }),
  component: ProspeccaoPage,
});

function ProspeccaoPage() {
  const navigate = useNavigate();
  const { data: profile } = useCurrentProfile();
  const { data: clientes = [], isLoading } = useClientes(undefined, "prospeccao");
  const upsertCliente = useUpsertCliente();
  const updateFunil = useUpdateClienteFunil();
  const converter = useConverterProspectEmCliente();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", origem: "" });

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
        origem: form.origem || null,
        responsavel_id: profile.userId,
        status: "prospeccao",
        etapa_funil: "novo_lead",
      });
      toast.success("Prospect cadastrado!");
      setOpen(false);
      setForm({ nome: "", cnpj: "", origem: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao cadastrar prospect");
    }
  };

  const handleMoverEtapa = async (cliente: Cliente, etapa: string) => {
    try {
      await updateFunil.mutateAsync({ id: cliente.id, etapa_funil: etapa });
    } catch (error: any) {
      toast.error(error.message || "Erro ao mover etapa");
    }
  };

  const handleConverter = async (cliente: Cliente) => {
    try {
      await converter.mutateAsync(cliente.id);
      toast.success(`${cliente.nome} convertido em cliente!`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao converter");
    }
  };

  const colunas = ETAPAS_FUNIL.map((etapa) => ({
    ...etapa,
    clientes: clientes.filter((c) => (c.etapa_funil ?? "novo_lead") === etapa.value),
  }));

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold">Prospecção</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe novos leads até fechar negócio.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Novo Prospect
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Cadastrar Prospect</DialogTitle>
                  <DialogDescription>
                    Adicione um novo lead ao funil de prospecção.
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
                    <Label htmlFor="origem">Origem</Label>
                    <Input
                      id="origem"
                      placeholder="Ex: Indicação, Site, Redes sociais..."
                      value={form.origem}
                      onChange={(e) => setForm({ ...form, origem: e.target.value })}
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

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 overflow-x-auto pb-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {colunas.map((coluna) => (
              <div key={coluna.value} className="min-w-[220px]">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <h3 className="truncate text-xs font-semibold uppercase text-muted-foreground">
                    {coluna.label}
                  </h3>
                  <span className="shrink-0 text-xs text-muted-foreground">{coluna.clientes.length}</span>
                </div>
                <div className="space-y-2">
                  {coluna.clientes.map((cliente) => (
                    <Card key={cliente.id} className="w-full">
                      <CardHeader className="p-3 pb-2">
                        <CardTitle
                          className="cursor-pointer text-sm leading-snug hover:underline"
                          onClick={() => navigate({ to: "/clientes/$id", params: { id: cliente.id } })}
                        >
                          {cliente.nome}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 p-3 pt-0 text-xs text-muted-foreground">
                        {cliente.origem && <div>Origem: {cliente.origem}</div>}
                        <Select
                          value={cliente.etapa_funil ?? "novo_lead"}
                          onValueChange={(v) => handleMoverEtapa(cliente, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ETAPAS_FUNIL.map((etapa) => (
                              <SelectItem key={etapa.value} value={etapa.value}>
                                {etapa.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 text-xs"
                          onClick={() => handleConverter(cliente)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Converter em Cliente
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {coluna.clientes.length === 0 && (
                    <p className="px-1 text-xs text-muted-foreground">Vazio</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
