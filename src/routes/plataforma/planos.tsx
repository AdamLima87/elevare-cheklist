import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  usePlatformPlanosComLimites,
  useCriarPlano,
  useAtualizarPlanoAtivo,
  useDefinirPlanoLimite,
  useRemoverPlanoLimite,
} from "@/hooks/usePlatform";
import type { PlatformPlanoComLimites } from "@/lib/platform/platformService";

export const Route = createFileRoute("/plataforma/planos")({
  head: () => ({ meta: [{ title: "Planos · Administração da Plataforma · RDCheck" }] }),
  component: PlatformPlanosPage,
});

function PlatformPlanosPage() {
  const { data: planos = [], isLoading } = usePlatformPlanosComLimites();
  const criarPlanoMut = useCriarPlano();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ codigo: "", nome: "", ordem: "0" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await criarPlanoMut.mutateAsync({ codigo: form.codigo.trim(), nome: form.nome.trim(), ordem: Number(form.ordem) || 0 });
      toast.success(`Plano "${form.nome}" criado.`);
      setOpen(false);
      setForm({ codigo: "", nome: "", ordem: "0" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar plano.");
    }
  };

  return (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Planos</h1>
            <p className="text-sm text-muted-foreground">
              Catálogo de planos e limites (ainda não religado a nenhuma lógica existente).
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Novo Plano</DialogTitle>
                  <DialogDescription>Cria uma linha no catálogo saas_planos. Não altera nenhum tenant existente.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="codigo">Código (ex: enterprise)</Label>
                    <Input id="codigo" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ordem">Ordem de exibição</Label>
                    <Input id="ordem" type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={criarPlanoMut.isPending} className="w-full">
                    {criarPlanoMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Criar Plano"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : planos.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">Nenhum plano cadastrado.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {planos.map((plano) => (
              <PlanoCard key={plano.id} plano={plano} />
            ))}
          </div>
        )}
      </PlatformLayout>
    </ProtectedRoute>
  );
}

function PlanoCard({ plano }: { plano: PlatformPlanoComLimites }) {
  const atualizarAtivo = useAtualizarPlanoAtivo();
  const definirLimite = useDefinirPlanoLimite();
  const removerLimite = useRemoverPlanoLimite();

  const [novaKey, setNovaKey] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [edicoes, setEdicoes] = useState<Record<string, string>>({});

  const handleToggleAtivo = async (ativo: boolean) => {
    try {
      await atualizarAtivo.mutateAsync({ planoId: plano.id, ativo });
      toast.success(ativo ? "Plano ativado." : "Plano desativado.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar plano.");
    }
  };

  const handleSalvarLimite = async (limiteKey: string, valorStr: string) => {
    if (!valorStr.trim()) return;
    try {
      await definirLimite.mutateAsync({ planoId: plano.id, limiteKey, valor: Number(valorStr) });
      toast.success(`Limite "${limiteKey}" atualizado.`);
      setEdicoes((prev) => ({ ...prev, [limiteKey]: "" }));
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar limite.");
    }
  };

  const handleAdicionarLimite = async () => {
    if (!novaKey.trim() || !novoValor.trim()) return;
    try {
      await definirLimite.mutateAsync({ planoId: plano.id, limiteKey: novaKey.trim(), valor: Number(novoValor) });
      toast.success("Limite adicionado.");
      setNovaKey("");
      setNovoValor("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar limite.");
    }
  };

  const handleRemoverLimite = async (limiteId: string, limiteKey: string) => {
    try {
      await removerLimite.mutateAsync(limiteId);
      toast.success(`Limite "${limiteKey}" removido.`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover limite.");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            {plano.nome}
            <Badge variant="outline" className="font-mono text-xs">
              {plano.codigo}
            </Badge>
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{plano.ativo ? "Ativo" : "Inativo"}</span>
          <Switch checked={plano.ativo} onCheckedChange={handleToggleAtivo} disabled={atualizarAtivo.isPending} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {plano.saas_plano_limites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum limite definido.</p>
        ) : (
          plano.saas_plano_limites.map((limite) => (
            <div key={limite.id} className="flex items-center gap-2">
              <span className="flex-1 font-mono text-sm">{limite.limite_key}</span>
              <Input
                type="number"
                className="w-24"
                placeholder={String(limite.valor)}
                value={edicoes[limite.limite_key] ?? ""}
                onChange={(e) => setEdicoes((prev) => ({ ...prev, [limite.limite_key]: e.target.value }))}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!edicoes[limite.limite_key]?.trim() || definirLimite.isPending}
                onClick={() => handleSalvarLimite(limite.limite_key, edicoes[limite.limite_key] ?? "")}
              >
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => handleRemoverLimite(limite.id, limite.limite_key)}
                disabled={removerLimite.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Input placeholder="nova_limite_key" className="flex-1" value={novaKey} onChange={(e) => setNovaKey(e.target.value)} />
          <Input type="number" placeholder="valor" className="w-24" value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
          <Button size="sm" onClick={handleAdicionarLimite} disabled={!novaKey.trim() || !novoValor.trim() || definirLimite.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
