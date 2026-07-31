import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import {
  usePlatformSuperAdmins,
  useBuscarUsuarioPorEmail,
  usePromoverSuperAdmin,
  useRebaixarSuperAdmin,
} from "@/hooks/usePlatform";
import type { PlatformSuperAdmin, PlatformUsuarioBusca } from "@/lib/platform/platformService";

export const Route = createFileRoute("/plataforma/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · Administração da Plataforma · RDCheck" }] }),
  component: PlatformUsuariosPage,
});

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function PlatformUsuariosPage() {
  const { data: superAdmins = [], isLoading } = usePlatformSuperAdmins();
  const [meuId, setMeuId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [rebaixando, setRebaixando] = useState<PlatformSuperAdmin | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeuId(data.user?.id ?? null));
  }, []);

  const rebaixar = useRebaixarSuperAdmin();

  const handleRebaixar = async () => {
    if (!rebaixando) return;
    try {
      await rebaixar.mutateAsync(rebaixando.id);
      toast.success(`Acesso de super_admin removido de ${rebaixando.nome}.`);
      setRebaixando(null);
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover acesso.");
    }
  };

  return (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Usuários da Plataforma</h1>
            <p className="text-sm text-muted-foreground">
              Contas com acesso de super_admin (equipe do RDCheck, não usuários de tenant).
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Promover Usuário
              </Button>
            </DialogTrigger>
            <PromoverUsuarioDialog onDone={() => setOpen(false)} />
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
                      <TableHead className="font-bold">E-mail</TableHead>
                      <TableHead className="font-bold">Empresa (tenant próprio)</TableHead>
                      <TableHead className="font-bold">Último acesso</TableHead>
                      <TableHead className="font-bold">Desde</TableHead>
                      <TableHead className="font-bold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {superAdmins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          Nenhum super_admin encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      superAdmins.map((sa) => (
                        <TableRow key={sa.id}>
                          <TableCell className="py-4 font-medium">
                            {sa.nome} {sa.id === meuId && <Badge variant="outline" className="ml-2">você</Badge>}
                          </TableCell>
                          <TableCell className="text-sm">{sa.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{sa.empresa_nome ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtData(sa.ultimo_acesso)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtData(sa.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-destructive hover:text-destructive"
                              disabled={sa.id === meuId}
                              onClick={() => setRebaixando(sa)}
                            >
                              <ShieldOff className="h-3.5 w-3.5" /> Revogar acesso
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

        <AlertDialog open={!!rebaixando} onOpenChange={(v) => !v && setRebaixando(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revogar acesso de super_admin?</AlertDialogTitle>
              <AlertDialogDescription>
                {rebaixando?.nome} perde o acesso à Administração da Plataforma e volta a ser admin só do próprio
                tenant. Essa ação fica registrada na Auditoria.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleRebaixar} disabled={rebaixar.isPending} className="bg-destructive hover:bg-destructive/90">
                {rebaixar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revogar acesso"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PlatformLayout>
    </ProtectedRoute>
  );
}

function PromoverUsuarioDialog({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [encontrado, setEncontrado] = useState<PlatformUsuarioBusca | null | undefined>(undefined);
  const buscar = useBuscarUsuarioPorEmail();
  const promover = usePromoverSuperAdmin();

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      const resultado = await buscar.mutateAsync(email.trim());
      setEncontrado(resultado);
    } catch (error: any) {
      toast.error(error.message || "Erro ao buscar usuário.");
    }
  };

  const handlePromover = async () => {
    if (!encontrado) return;
    try {
      await promover.mutateAsync(encontrado.id);
      toast.success(`${encontrado.nome} agora é super_admin.`);
      setEmail("");
      setEncontrado(undefined);
      onDone();
    } catch (error: any) {
      toast.error(error.message || "Erro ao promover usuário.");
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Promover Usuário a super_admin</DialogTitle>
        <DialogDescription>
          Busque por um usuário já cadastrado (de qualquer tenant) pelo e-mail exato. Ele passa a ter acesso à
          Administração da Plataforma.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleBuscar} className="flex gap-2">
        <Input
          type="email"
          placeholder="email@exemplo.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEncontrado(undefined);
          }}
          required
        />
        <Button type="submit" variant="outline" disabled={buscar.isPending}>
          {buscar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
        </Button>
      </form>

      {encontrado === null && (
        <p className="text-sm text-muted-foreground">Nenhum usuário encontrado com esse e-mail.</p>
      )}

      {encontrado && (
        <div className="rounded-md border border-border p-3 text-sm">
          <p className="font-medium">{encontrado.nome}</p>
          <p className="text-muted-foreground">{encontrado.email}</p>
          <p className="text-muted-foreground">
            Empresa: {encontrado.empresa_nome ?? "—"} · Perfil atual: {encontrado.perfil}
          </p>
          {encontrado.perfil === "super_admin" && (
            <p className="mt-1 text-xs text-amber-600">Este usuário já é super_admin.</p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button
          onClick={handlePromover}
          disabled={!encontrado || encontrado.perfil === "super_admin" || promover.isPending}
          className="w-full"
        >
          {promover.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Promover a super_admin"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
