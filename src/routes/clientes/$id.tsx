import { useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, ArrowLeft, Plus, CheckCircle2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { classificacao, saveRascunho, type Inspecao } from "@/lib/storage";
import { contarNCCriticas } from "@/lib/checklist-data";
import { toTrendPoints } from "@/lib/compliance-trend";
import { ComplianceTrendChart } from "@/components/elevare/ComplianceTrendChart";
import { ComparativoInspecoes } from "@/components/elevare/ComparativoInspecoes";
import { NovaInspecaoForm } from "@/components/elevare/NovaInspecaoForm";
import { useCliente, ETAPAS_FUNIL, useUpdateClienteFunil, useConverterProspectEmCliente } from "@/hooks/useClientes";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useClienteInteracoes, useCreateInteracao } from "@/hooks/useClienteInteracoes";
import { usePlanosAcaoCliente, useTogglePlanoAcao } from "@/hooks/usePlanosAcaoCliente";
import { useVisitas, useCreateVisita, useUpdateVisitaStatus } from "@/hooks/useVisitas";
import {
  useDocumentos,
  useCreateDocumento,
  useDeleteDocumento,
  documentoStatus,
  TIPOS_DOCUMENTO,
} from "@/hooks/useDocumentos";
import { supabase } from "@/integrations/supabase/client";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Histórico do Cliente · RDCheck" },
      { name: "description", content: "Evolução da conformidade de um cliente ao longo do tempo." },
    ],
  }),
  component: ClienteDetailPage,
});

function ClienteDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/clientes/$id" });
  const { data: cliente, isLoading: loadingCliente } = useCliente(id);
  const { data: profile } = useCurrentProfile();

  const { data: rows = [], isLoading: loadingInspecoes } = useQuery({
    queryKey: ["inspecoes-por-cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecoes")
        .select("*")
        .eq("cliente_id", id)
        .eq("status", "concluida")
        .order("data_conclusao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: emAndamento = [], isLoading: loadingEmAndamento } = useQuery({
    queryKey: ["inspecoes-em-andamento-por-cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecoes")
        .select("*")
        .eq("cliente_id", id)
        .eq("status", "em_andamento")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const isLoading = loadingCliente || loadingInspecoes || loadingEmAndamento;
  const isProspect = cliente?.status === "prospeccao";

  const handleContinuar = async (row: any) => {
    const mapped: Inspecao = {
      id: row.id,
      numero_sequencial: row.numero_sequencial,
      status: "em_andamento",
      estabelecimento: row.estabelecimento_nome || "",
      dataInicio: row.data_inicio,
      dataConclusao: row.data_conclusao,
      progresso: row.progresso,
      conformidade: row.conformidade ? Number(row.conformidade) : null,
      dados: row.dados,
      respostas: row.respostas,
      cloudUpdatedAt: row.updated_at,
    };
    await saveRascunho(mapped);
    navigate({ to: "/checklist" });
  };

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/clientes" })}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{cliente?.nome || "Cliente"}</h1>
                {isProspect && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                    Prospecção
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {cliente?.cnpj ? `CNPJ: ${cliente.cnpj}` : "Sem CNPJ cadastrado"}
                {cliente?.categoria ? ` · ${cliente.categoria}` : ""}
              </p>
            </div>

            <Tabs defaultValue="geral">
              <TabsList>
                <TabsTrigger value="geral">Visão Geral</TabsTrigger>
                <TabsTrigger value="nova-inspecao">Nova Inspeção</TabsTrigger>
                <TabsTrigger value="planos">Planos de Ação</TabsTrigger>
                <TabsTrigger value="agenda">Agenda</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
              </TabsList>

              <TabsContent value="geral">
                {isProspect ? (
                  <ProspectOverview clienteId={id} etapaFunil={cliente?.etapa_funil ?? null} />
                ) : (
                  <>
                    {emAndamento.length > 0 && (
                      <Card className="mb-6">
                        <CardHeader>
                          <CardTitle className="text-base">Em andamento ({emAndamento.length})</CardTitle>
                          <CardDescription>Inspeções iniciadas mas ainda não concluídas.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {emAndamento.map((row: any) => (
                            <div
                              key={row.id}
                              className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"
                            >
                              <div>
                                <div className="font-medium">{row.estabelecimento_nome || "Sem nome"}</div>
                                <div className="text-xs text-muted-foreground">
                                  Iniciada em {new Date(row.data_inicio).toLocaleDateString("pt-BR")} ·{" "}
                                  {row.progresso ?? 0}% concluído
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="gap-1.5"
                                onClick={() => handleContinuar(row)}
                              >
                                <PlayCircle className="h-4 w-4" /> Continuar
                              </Button>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="text-base">Evolução da conformidade</CardTitle>
                        <CardDescription>
                          Pontuação ao longo de todas as inspeções concluídas deste cliente.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ComplianceTrendChart data={toTrendPoints(rows)} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Inspeções ({rows.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Conformidade</TableHead>
                                <TableHead>Classificação</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    Nenhuma inspeção concluída para este cliente ainda.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                rows.map((insp: any) => {
                                  const cls = classificacao(Number(insp.conformidade), contarNCCriticas(insp.respostas));
                                  return (
                                    <TableRow key={insp.id}>
                                      <TableCell className="text-sm">
                                        {new Date(insp.data_conclusao).toLocaleDateString("pt-BR")}
                                      </TableCell>
                                      <TableCell className="text-sm font-bold text-primary">
                                        {Number(insp.conformidade).toFixed(1)}%
                                      </TableCell>
                                      <TableCell>
                                        <span
                                          className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                            cls.tone === "success" && "bg-green-100 text-green-700",
                                            cls.tone === "warning" && "bg-yellow-100 text-yellow-700",
                                            cls.tone === "destructive" && "bg-red-100 text-red-700",
                                          )}
                                        >
                                          {cls.label}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            navigate({
                                              to: "/resultado",
                                              search: { id: insp.id, readonly: true },
                                            })
                                          }
                                          title="Ver relatório"
                                          className="h-8 w-8 p-0"
                                        >
                                          <FileText className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                <InteracoesCard
                  clienteId={id}
                  empresaId={cliente?.empresa_id}
                  autorId={profile?.userId}
                />
              </TabsContent>

              <TabsContent value="nova-inspecao">
                <NovaInspecaoForm
                  clienteId={id}
                  prefill={{
                    razaoSocial: cliente?.nome ?? "",
                    nomeFantasia: cliente?.nome ?? "",
                    cnpj: cliente?.cnpj ?? "",
                    atividade: cliente?.categoria ?? "",
                  }}
                />
              </TabsContent>

              <TabsContent value="planos">
                <PlanosAcaoTab clienteId={id} />
              </TabsContent>

              <TabsContent value="agenda">
                <AgendaTab clienteId={id} empresaId={cliente?.empresa_id} />
              </TabsContent>

              <TabsContent value="documentos">
                <DocumentosTab clienteId={id} empresaId={cliente?.empresa_id} autorId={profile?.userId} />
              </TabsContent>

              <TabsContent value="comparativo">
                <ComparativoInspecoes inspecoes={rows as any} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}

function ProspectOverview({
  clienteId,
  etapaFunil,
}: {
  clienteId: string;
  etapaFunil: string | null;
}) {
  const updateFunil = useUpdateClienteFunil();
  const converter = useConverterProspectEmCliente();

  const handleEtapaChange = async (value: string) => {
    try {
      await updateFunil.mutateAsync({ id: clienteId, etapa_funil: value });
      toast.success("Etapa atualizada");
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar etapa");
    }
  };

  const handleConverter = async () => {
    try {
      await converter.mutateAsync(clienteId);
      toast.success("Prospect convertido em cliente!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao converter");
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Funil de Prospecção</CardTitle>
        <CardDescription>Acompanhe o andamento desse lead até fechar negócio.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Etapa atual</Label>
          <Select value={etapaFunil ?? undefined} onValueChange={handleEtapaChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a etapa" />
            </SelectTrigger>
            <SelectContent>
              {ETAPAS_FUNIL.map((etapa) => (
                <SelectItem key={etapa.value} value={etapa.value}>
                  {etapa.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleConverter} disabled={converter.isPending} className="gap-1.5">
          {converter.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Converter em Cliente
        </Button>
      </CardContent>
    </Card>
  );
}

function InteracoesCard({
  clienteId,
  empresaId,
  autorId,
}: {
  clienteId: string;
  empresaId: string | undefined;
  autorId: string | undefined;
}) {
  const { data: interacoes = [], isLoading } = useClienteInteracoes(clienteId);
  const createInteracao = useCreateInteracao();
  const [texto, setTexto] = useState("");

  const handleAdd = async () => {
    if (!texto.trim() || !empresaId) return;
    try {
      await createInteracao.mutateAsync({
        empresa_id: empresaId,
        cliente_id: clienteId,
        autor_id: autorId,
        texto: texto.trim(),
      });
      setTexto("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar interação");
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Interações</CardTitle>
        <CardDescription>Registro de contatos, ligações e observações sobre o cliente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Adicionar uma nota..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="min-h-16"
          />
          <Button
            onClick={handleAdd}
            disabled={createInteracao.isPending || !texto.trim()}
            className="shrink-0 self-end gap-1.5"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : interacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma interação registrada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {interacoes.map((i) => (
              <li key={i.id} className="rounded-md border p-3 text-sm">
                <div className="text-xs text-muted-foreground">
                  {new Date(i.created_at).toLocaleString("pt-BR")}
                </div>
                <div className="mt-1">{i.texto}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PlanosAcaoTab({ clienteId }: { clienteId: string }) {
  const { data: planos = [], isLoading } = usePlanosAcaoCliente(clienteId);
  const toggle = useTogglePlanoAcao();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendentes = planos.filter((p) => !p.concluido);
  const concluidos = planos.filter((p) => p.concluido);

  const handleToggle = async (p: (typeof planos)[number], concluido: boolean) => {
    try {
      await toggle.mutateAsync({ inspecaoId: p.inspecaoId, itemId: p.itemId, concluido, clienteId });
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar plano de ação");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendentes ({pendentes.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum plano de ação pendente.</p>
          ) : (
            pendentes.map((p) => (
              <div key={`${p.inspecaoId}-${p.itemId}`} className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <Checkbox
                  checked={!!p.concluido}
                  onCheckedChange={(v) => handleToggle(p, v === true)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-destructive">{p.secao}</div>
                  <div className="mt-0.5"><span className="font-mono text-xs">{p.itemId}.</span> {p.itemText}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{p.texto}</div>
                  {p.prazo && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Prazo: {new Date(p.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Concluídos ({concluidos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {concluidos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum plano de ação concluído ainda.</p>
          ) : (
            concluidos.map((p) => (
              <div key={`${p.inspecaoId}-${p.itemId}`} className="flex gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                <Checkbox
                  checked={!!p.concluido}
                  onCheckedChange={(v) => handleToggle(p, v === true)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.secao}</div>
                  <div className="mt-0.5"><span className="font-mono text-xs">{p.itemId}.</span> {p.itemText}</div>
                  {p.dataResolucao && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Resolvido em: {new Date(p.dataResolucao + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentosTab({
  clienteId,
  empresaId,
  autorId,
}: {
  clienteId: string;
  empresaId: string | undefined;
  autorId: string | undefined;
}) {
  const { data: documentos = [], isLoading } = useDocumentos(clienteId);
  const createDocumento = useCreateDocumento();
  const deleteDocumento = useDeleteDocumento();
  const [form, setForm] = useState({
    tipo: "",
    numero: "",
    orgaoEmissor: "",
    dataEmissao: "",
    dataVencimento: "",
    observacoes: "",
  });

  const handleCreate = async () => {
    if (!form.tipo || !empresaId) return;
    try {
      await createDocumento.mutateAsync({
        empresa_id: empresaId,
        cliente_id: clienteId,
        tipo: form.tipo,
        numero: form.numero || null,
        orgao_emissor: form.orgaoEmissor || null,
        data_emissao: form.dataEmissao || null,
        data_vencimento: form.dataVencimento || null,
        observacoes: form.observacoes || null,
        created_by: autorId,
      });
      setForm({ tipo: "", numero: "", orgaoEmissor: "", dataEmissao: "", dataVencimento: "", observacoes: "" });
      toast.success("Documento registrado!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar documento");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDocumento.mutateAsync(id);
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover documento");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar documento</CardTitle>
          <CardDescription>Alvará, licenças, laudos e certificados com controle de vencimento.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Tipo de documento</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Número</Label>
            <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Opcional" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Órgão emissor</Label>
            <Input value={form.orgaoEmissor} onChange={(e) => setForm({ ...form, orgaoEmissor: e.target.value })} placeholder="Opcional" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Data de emissão</Label>
            <Input type="date" value={form.dataEmissao} onChange={(e) => setForm({ ...form, dataEmissao: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Data de vencimento</Label>
            <Input type="date" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs text-muted-foreground">Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="min-h-16" placeholder="Opcional" />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={handleCreate} disabled={createDocumento.isPending || !form.tipo} className="gap-1.5">
              <Plus className="h-4 w-4" /> Registrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos ({documentos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : documentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento registrado ainda.</p>
          ) : (
            documentos.map((doc) => {
              const status = documentoStatus(doc.data_vencimento);
              return (
                <div key={doc.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{doc.tipo}</div>
                    <div className="text-xs text-muted-foreground">
                      {[doc.numero, doc.orgao_emissor].filter(Boolean).join(" · ") || "Sem número/órgão"}
                    </div>
                    {doc.data_vencimento && (
                      <div className="text-xs text-muted-foreground">
                        Vencimento: {new Date(doc.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                    )}
                    {doc.observacoes && <div className="text-xs text-muted-foreground">{doc.observacoes}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {status !== "sem-vencimento" && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          status === "vencido" && "bg-red-100 text-red-700",
                          status === "vencendo" && "bg-amber-100 text-amber-700",
                          status === "ok" && "bg-green-100 text-green-700",
                        )}
                      >
                        {status === "vencido" ? "Vencido" : status === "vencendo" ? "Vencendo" : "Em dia"}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(doc.id)}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AgendaTab({ clienteId, empresaId }: { clienteId: string; empresaId: string | undefined }) {
  const { data: visitas = [], isLoading } = useVisitas({ clienteId });
  const createVisita = useCreateVisita();
  const updateStatus = useUpdateVisitaStatus();
  const [dataHora, setDataHora] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const handleCreate = async () => {
    if (!dataHora || !empresaId) return;
    try {
      await createVisita.mutateAsync({
        empresa_id: empresaId,
        cliente_id: clienteId,
        data_hora: new Date(dataHora).toISOString(),
        observacoes: observacoes || null,
      });
      setDataHora("");
      setObservacoes("");
      toast.success("Visita agendada!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao agendar visita");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agendar nova visita</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Data e hora</Label>
            <Input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Observações</Label>
            <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>
          <Button onClick={handleCreate} disabled={createVisita.isPending || !dataHora} className="gap-1.5">
            <Plus className="h-4 w-4" /> Agendar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visitas ({visitas.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : visitas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma visita agendada ainda.</p>
          ) : (
            visitas.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">{new Date(v.data_hora).toLocaleString("pt-BR")}</div>
                  {v.observacoes && <div className="text-xs text-muted-foreground">{v.observacoes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      v.status === "agendada" && "bg-blue-100 text-blue-700",
                      v.status === "realizada" && "bg-green-100 text-green-700",
                      v.status === "cancelada" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {v.status}
                  </span>
                  {v.status === "agendada" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus.mutate({ id: v.id, status: "realizada" })}
                      >
                        Marcar realizada
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus.mutate({ id: v.id, status: "cancelada" })}
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
