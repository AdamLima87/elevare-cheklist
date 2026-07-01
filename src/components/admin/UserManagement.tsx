import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserPlus, Power, RotateCcw, Eye, EyeOff, Search, Shield, User, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [newUser, setNewUser] = useState({ nome: "", email: "", password: "", perfil: "consultor", cnpj: "" });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", { body: { action: "list_with_auth" } });
      if (error) throw error;
      setUsers(data.users || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      const { data } = await supabase.from("profiles").select("*").order("created_at");
      setUsers(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const s = searchTerm.toLowerCase();
    return users.filter(u => u.nome?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.perfil?.toLowerCase().includes(s));
  }, [users, searchTerm]);

  const handleCreateUser = async () => {
    if (!newUser.nome || !newUser.email || !newUser.password) { toast.error("Preencha todos os campos obrigatórios"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", { body: { action: "create_user", userData: newUser } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário criado com sucesso!");
      setOpen(false);
      setNewUser({ nome: "", email: "", password: "", perfil: "consultor", cnpj: "" });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar usuário");
    } finally { setSubmitting(false); }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await supabase.from("profiles").update({ ativo: !currentStatus }).eq("id", userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ativo: !currentStatus } : u));
      toast.success(currentStatus ? "Usuário desativado" : "Usuário reativado");
    } catch { toast.error("Erro ao alterar status"); }
  };

  const handleResetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      toast.success(`E-mail de redefinição enviado para ${email}`);
    } catch { toast.error("Erro ao enviar e-mail de redefinição"); }
  };

  const perfilConfig: any = {
    admin: { label: "Admin", icon: Shield, class: "bg-red-100 text-red-700 border-red-200" },
    consultor: { label: "Consultor", icon: User, class: "bg-green-100 text-green-700 border-green-200" },
    cliente: { label: "Cliente", icon: Store, class: "bg-blue-100 text-blue-700 border-blue-200" },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-lg">Gerenciamento de Usuários</CardTitle>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar usuário..." className="pl-9 w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white gap-2">
                  <UserPlus className="h-4 w-4" />Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                  <DialogDescription>Preencha os dados para criar um novo acesso ao sistema.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Nome completo *</Label><Input value={newUser.nome} onChange={e => setNewUser(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do usuário" /></div>
                  <div className="space-y-2"><Label>E-mail *</Label><Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" /></div>
                  <div className="space-y-2">
                    <Label>Senha temporária *</Label>
                    <div className="relative">
                      <Input type={showPasswords["new"] ? "text" : "password"} value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                      <button type="button" onClick={() => setShowPasswords(p => ({ ...p, new: !p.new }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPasswords["new"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Perfil *</Label>
                    <Select value={newUser.perfil} onValueChange={v => setNewUser(p => ({ ...p, perfil: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="consultor">Consultor</SelectItem>
                        <SelectItem value="cliente">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newUser.perfil === "cliente" && (
                    <div className="space-y-2"><Label>CNPJ do estabelecimento</Label><Input value={newUser.cnpj} onChange={e => setNewUser(p => ({ ...p, cnpj: e.target.value.replace(/\D/g, "").slice(0, 14) }))} placeholder="Somente números" /></div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreateUser} disabled={submitting} className="bg-[#1a4d2e] text-white">
                    {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : "Criar Usuário"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => {
                const cfg = perfilConfig[user.perfil] || perfilConfig.consultor;
                const Icon = cfg.icon;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.nome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", cfg.class)}>
                        <Icon className="h-3 w-3" />{cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.ultimo_acesso ? new Date(user.ultimo_acesso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", user.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")}>
                        {user.ativo ? "● Ativo" : "○ Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">•••</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleToggleStatus(user.id, user.ativo)}>
                            <Power className="h-4 w-4 mr-2" />{user.ativo ? "Desativar" : "Reativar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResetPassword(user.email)}>
                            <RotateCcw className="h-4 w-4 mr-2" />Redefinir senha
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredUsers.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
