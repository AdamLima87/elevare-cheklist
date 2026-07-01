import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserPlus, Power, RotateCcw, Eye, EyeOff, Clock, Search, Shield, User, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");


  // New user form state
  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    password: "",
    perfil: "consultor",
    cnpj: "",
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "list_with_auth" }
      });

      if (error) throw error;
      setUsers(data.users || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "create",
          userData: newUser
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("Usuário criado com sucesso!");
      setOpen(false);
      fetchUsers();
      setNewUser({ nome: "", email: "", password: "", perfil: "consultor", cnpj: "" });
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Erro ao criar usuário");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (user: any) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ativo: !user.ativo })
        .eq("id", user.id);

      if (error) throw error;
      toast.success(`Usuário ${user.ativo ? "desativado" : "reativado"}`);
      fetchUsers();
    } catch (error: any) {
      toast.error("Erro ao atualizar status");
    }
  };

  const resetPassword = async (user: any) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "reset_password",
          userData: {
            userId: user.id,
            email: user.email
          }
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`Senha redefinida para: ${data.tempPassword}`, {
        duration: 10000,
      });
      fetchUsers();
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error.message || "Erro ao solicitar redefinção");
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      (user.nome?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (user.email?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const { admins, consultants, clients } = useMemo(() => {
    return {
      admins: filteredUsers.filter(u => u.perfil === "admin"),
      consultants: filteredUsers.filter(u => u.perfil === "consultor"),
      clients: filteredUsers.filter(u => u.perfil === "cliente" || !["admin", "consultor"].includes(u.perfil))
    };
  }, [filteredUsers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <UserPlus className="h-4 w-4" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha os dados abaixo para cadastrar um novo usuário no sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input 
                    id="name" 
                    placeholder="Ex: João da Silva"
                    value={newUser.nome} 
                    onChange={e => setNewUser({...newUser, nome: e.target.value})}
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="exemplo@email.com"
                    value={newUser.email} 
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Senha (Deixe vazio para gerar automaticamente)</Label>
                  <Input 
                    id="password" 
                    type="text" 
                    placeholder="Opcional"
                    value={newUser.password} 
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="perfil">Perfil</Label>
                  <Select 
                    value={newUser.perfil} 
                    onValueChange={v => setNewUser({...newUser, perfil: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="consultor">Consultor</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newUser.perfil === "cliente" && (
                  <div className="grid gap-2">
                    <Label htmlFor="cnpj">CNPJ do Estabelecimento (Obrigatório para Cliente)</Label>
                    <Input 
                      id="cnpj" 
                      placeholder="00.000.000/0000-00"
                      value={newUser.cnpj} 
                      onChange={e => setNewUser({...newUser, cnpj: e.target.value})}
                      required 
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {/* Equipe Interna */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
            <Shield className="h-4 w-4" /> Equipe Interna (Admins e Consultores)
          </h3>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Nome</TableHead>
                        <TableHead className="font-bold">E-mail</TableHead>
                        <TableHead className="font-bold">Perfil</TableHead>
                        <TableHead className="font-bold text-center">Senha</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="text-right font-bold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...admins, ...consultants].length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            Nenhum membro da equipe encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        [...admins, ...consultants].map((user) => (
                          <TableRow key={user.id} className={cn("transition-colors", !user.ativo && "opacity-60 bg-muted/20")}>
                            <TableCell className="font-medium py-4">{user.nome}</TableCell>
                            <TableCell className="text-sm">{user.email || user.id}</TableCell>
                            <TableCell>
                              <div className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                user.perfil === "admin" && "bg-blue-100 text-blue-700",
                                user.perfil === "consultor" && "bg-green-100 text-green-700"
                              )}>
                                {user.perfil === "admin" && <Shield className="h-3 w-3" />}
                                {user.perfil === "consultor" && <User className="h-3 w-3" />}
                                {user.perfil}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 gap-2">
                                    <Eye className="h-4 w-4" /> Opções
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    const pass = user.senha_texto || "Não disponível (Senha já alterada ou não registrada)";
                                    toast.info(`Senha atual: ${pass}`, { duration: 5000 });
                                  }}>
                                    <Eye className="mr-2 h-4 w-4" /> Visualizar Senha
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => resetPassword(user)} className="text-primary">
                                    <RotateCcw className="mr-2 h-4 w-4" /> Redefinir Senha Temporária
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "h-2 w-2 rounded-full",
                                  user.ativo ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500"
                                )} />
                                <span className="text-xs font-medium">{user.ativo ? "Ativo" : "Inativo"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => toggleStatus(user)}
                                className={cn("h-8 w-8", user.ativo ? "text-destructive hover:bg-destructive/10" : "text-green-600 hover:bg-green-50")}
                                title={user.ativo ? "Desativar" : "Reativar"}
                              >
                                <Power className="h-4 w-4" />
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
        </div>

        {/* Clientes */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
            <Store className="h-4 w-4" /> Clientes (Acessos Gerados via Inspeção)
          </h3>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Razão Social / Nome</TableHead>
                        <TableHead className="font-bold">E-mail (Login)</TableHead>
                        <TableHead className="font-bold">CNPJ (Senha Inicial)</TableHead>
                        <TableHead className="font-bold text-center">Status</TableHead>
                        <TableHead className="text-right font-bold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            Nenhum cliente cadastrado ainda.
                          </TableCell>
                        </TableRow>
                      ) : (
                        clients.map((user) => (
                          <TableRow key={user.id} className={cn("transition-colors", !user.ativo && "opacity-60 bg-muted/20")}>
                            <TableCell className="font-medium py-4">{user.nome}</TableCell>
                            <TableCell className="text-sm">{user.email}</TableCell>
                            <TableCell className="text-sm font-mono">
                              <div className="flex items-center gap-2">
                                <span>{user.cnpj || "---"}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6" 
                                  onClick={() => {
                                    const pass = user.senha_texto || user.cnpj || "Não disponível";
                                    toast.info(`Senha registrada: ${pass}`);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center items-center gap-2">
                                <span className={cn(
                                  "h-2 w-2 rounded-full",
                                  user.ativo ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500"
                                )} />
                                <span className="text-xs font-medium">{user.ativo ? "Ativo" : "Inativo"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => toggleStatus(user)}
                                className={cn("h-8 w-8", user.ativo ? "text-destructive hover:bg-destructive/10" : "text-green-600 hover:bg-green-50")}
                                title={user.ativo ? "Desativar" : "Reativar"}
                              >
                                <Power className="h-4 w-4" />
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
        </div>
      </div>
    </div>
  );
}
