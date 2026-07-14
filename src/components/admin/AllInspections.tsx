import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  FileText,
  Trash2,
  Mail,
  Edit2,
  UserPlus,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { classificacao, deleteFromHistorico, saveRascunho } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useConsultants } from "@/hooks/useConsultants";
import { useInspecoesQuery } from "@/hooks/useInspecoesQuery";
import { useResendInspectionEmail } from "@/hooks/useResendInspectionEmail";

const PAGE_SIZE = 25;

export function AllInspections() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.perfil === "admin" || profile?.perfil === "super_admin";
  const { data: consultants = {} } = useConsultants(isAdmin);
  const resendEmail = useResendInspectionEmail();

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({
    consultant: "all",
    status: "all" as "all" | "em_andamento" | "concluida",
  });

  const consultorId =
    filter.consultant !== "all" ? filter.consultant : !isAdmin && profile ? profile.userId : null;

  const { data, isLoading } = useInspecoesQuery({
    status: filter.status === "all" ? undefined : filter.status,
    consultorId,
    dateField: "data_inicio",
    orderBy: "data_inicio",
    page,
    pageSize: PAGE_SIZE,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filteredInspections = search
    ? rows.filter((insp: any) => {
        const s = search.toLowerCase();
        return (
          insp.estabelecimento_nome?.toLowerCase().includes(s) ||
          insp.cnpj?.includes(s) ||
          insp.numero_sequencial?.toString().includes(s)
        );
      })
    : rows;

  const updateFilter = (patch: Partial<typeof filter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFromHistorico(id);
      queryClient.invalidateQueries({ queryKey: ["inspecoes"] });
      toast.success("Inspeção excluída com sucesso");
    } catch (error) {
      console.error("Error deleting inspection:", error);
      toast.error("Erro ao excluir inspeção");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateClientAccess = async (insp: any) => {
    const email = insp.dados?.estabelecimento?.respLegalEmail || insp.dados?.estabelecimento?.email;
    const cnpj = (insp.cnpj || insp.dados?.estabelecimento?.cnpj || "").replace(/\D/g, "");
    const nome = insp.dados?.estabelecimento?.respLegalNome || insp.estabelecimento_nome;

    if (!email || !cnpj) {
      toast.error("E-mail ou CNPJ não encontrados para gerar acesso.");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "create_client",
          userData: { email, password: cnpj, nome, perfil: "cliente", cnpj },
        },
      });

      if (error) throw error;

      if (data?.alreadyExists) {
        toast.info("Acesso do cliente atualizado (o usuário já existia no sistema).");
      } else {
        toast.success("Acesso do cliente gerado com sucesso!");
      }
    } catch (error: any) {
      console.error("Error creating client access:", error);
      toast.error("Erro ao gerar acesso do cliente.");
    }
  };

  const handleEdit = async (insp: any) => {
    // Para editar uma inspeção concluída, vamos carregar ela no rascunho
    // e mudar seu status para 'em_andamento'
    const mapped: any = {
      id: insp.id,
      numero_sequencial: insp.numero_sequencial,
      status: "em_andamento",
      estabelecimento: insp.estabelecimento_nome || "",
      dataInicio: insp.data_inicio,
      dataConclusao: insp.data_conclusao,
      progresso: insp.progresso,
      dados: {
        ...insp.dados,
        estabelecimento: insp.dados?.estabelecimento || {
          razaoSocial: insp.estabelecimento_nome || "",
          nomeFantasia: insp.estabelecimento_nome || "",
          cnpj: insp.cnpj || "",
        },
      },
      respostas: insp.respostas || {},
    };

    // Salva usando o helper
    await saveRascunho(mapped);

    // Navega para a primeira etapa da inspeção
    toast.info("Carregando inspeção para edição...");
    navigate({ to: "/nova-inspecao", search: { edit: true } });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Buscar (página atual)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CNPJ ou Nº..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Consultor</Label>
              <Select
                value={filter.consultant}
                onValueChange={(v) => updateFilter({ consultant: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os consultores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(consultants).map(([id, nome]) => (
                    <SelectItem key={id} value={id}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filter.status} onValueChange={(v: any) => updateFilter({ status: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Nº</TableHead>
                    <TableHead>Estabelecimento / CNPJ</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Conformidade</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInspections.map((insp: any) => {
                    const cls =
                      insp.status === "concluida" ? classificacao(Number(insp.conformidade)) : null;
                    const isSending =
                      resendEmail.isPending && resendEmail.variables?.id === insp.id;
                    const isDeleting = deletingId === insp.id;
                    return (
                      <TableRow key={insp.id}>
                        <TableCell className="font-mono text-xs font-bold">
                          #
                          {(insp.numero_sequencial ?? insp.numero ?? 0).toString().padStart(3, "0")}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{insp.estabelecimento_nome}</div>
                          <div className="text-xs text-muted-foreground">{insp.cnpj}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {consultants[insp.consultor_id] || "N/A"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(insp.data_inicio).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              insp.status === "concluida"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700",
                            )}
                          >
                            {insp.status === "concluida" ? "Concluída" : "em andamento"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {cls ? (
                            <div
                              className={cn(
                                "text-xs font-bold",
                                cls.tone === "success" && "text-success",
                                cls.tone === "warning" && "text-warning",
                                cls.tone === "destructive" && "text-destructive",
                              )}
                            >
                              {Number(insp.conformidade).toFixed(2)}%
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{insp.progresso}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {insp.status === "concluida" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCreateClientAccess(insp)}
                                  title="Gerar/Atualizar acesso do cliente"
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resendEmail.mutate(insp)}
                                  disabled={isSending}
                                  title="Reenviar e-mail"
                                >
                                  {isSending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Mail className="h-4 w-4" />
                                  )}
                                </Button>
                              </>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(insp)}
                              title="Editar inspeção"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                navigate({
                                  to: "/resultado",
                                  search: { id: insp.id, readonly: true },
                                })
                              }
                              title="Ver resultado"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>

                            {insp.cnpj && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  navigate({ to: "/estabelecimento", search: { cnpj: insp.cnpj } })
                                }
                                title="Ver histórico do estabelecimento"
                              >
                                <TrendingUp className="h-4 w-4" />
                              </Button>
                            )}

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isDeleting}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Inspeção?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Isso excluirá permanentemente
                                    os dados da inspeção.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(insp.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredInspections.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground italic"
                      >
                        Nenhuma inspeção encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Página {page + 1} de {totalPages} · {total} inspeç{total === 1 ? "ão" : "ões"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
