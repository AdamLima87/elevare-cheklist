import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useState } from "react";
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
  Mail,
  FilterX,
  ClipboardCheck,
  TrendingDown,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { classificacao } from "@/lib/storage";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useConsultants } from "@/hooks/useConsultants";
import { useInspecoesQuery, useInspecoesStats } from "@/hooks/useInspecoesQuery";
import { useResendInspectionEmail } from "@/hooks/useResendInspectionEmail";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios · Elevare" },
      { name: "description", content: "Relatórios de inspeções concluídas." },
    ],
  }),
  component: RelatoriosPage,
});

const PAGE_SIZE = 25;

function RelatoriosPage() {
  const navigate = useNavigate();
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.perfil === "admin" || profile?.perfil === "super_admin";
  const { data: consultants = {} } = useConsultants(isAdmin);
  const resendEmail = useResendInspectionEmail();

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    consultant: "all",
    classification: "all" as "all" | "BOM" | "REGULAR" | "RUIM",
    dateStart: "",
    dateEnd: "",
  });

  const consultorId =
    profile?.perfil === "consultor"
      ? profile.userId
      : filters.consultant !== "all"
        ? filters.consultant
        : null;

  const queryFilters = {
    status: "concluida" as const,
    consultorId,
    dateStart: filters.dateStart,
    dateEnd: filters.dateEnd,
    classification: filters.classification,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading } = useInspecoesQuery(queryFilters);
  const { data: stats = { total: 0, avg: 0, bom: 0, regular: 0, ruim: 0 } } =
    useInspecoesStats(queryFilters);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Busca é aplicada apenas sobre a página atual carregada (não refaz a query).
  const visibleRows = search
    ? rows.filter((i: any) => {
        const s = search.toLowerCase();
        return (
          i.estabelecimento_nome?.toLowerCase().includes(s) ||
          i.cnpj?.includes(s) ||
          i.numero_sequencial?.toString().includes(s)
        );
      })
    : rows;

  const updateFilter = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const resetFilters = () => {
    setFilters({ consultant: "all", classification: "all", dateStart: "", dateEnd: "" });
    setSearch("");
    setPage(0);
  };

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Relatórios</h1>
              <p className="text-muted-foreground text-sm">
                Visualize o desempenho e resultados das inspeções concluídas.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <FilterX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total de Relatórios"
              value={stats.total}
              icon={ClipboardCheck}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              title="Média Conformidade"
              value={`${stats.avg.toFixed(1)}%`}
              icon={TrendingDown}
              color="bg-green-50 text-green-600"
            />
            <div className="flex gap-4 lg:col-span-2">
              <StatCard
                title="BOM"
                value={stats.bom}
                sub=">= 76%"
                color="bg-emerald-50 text-emerald-600"
                className="flex-1"
              />
              <StatCard
                title="REGULAR"
                value={stats.regular}
                sub="51-75%"
                color="bg-amber-50 text-amber-600"
                className="flex-1"
              />
              <StatCard
                title="RUIM"
                value={stats.ruim}
                sub="< 51%"
                color="bg-red-50 text-red-600"
                className="flex-1"
              />
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Filtros Avançados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="search">Busca (página atual)</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Nome, CNPJ ou Nº"
                      className="pl-8"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Classificação</Label>
                  <Select
                    value={filters.classification}
                    onValueChange={(v: any) => updateFilter({ classification: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="BOM">BOM</SelectItem>
                      <SelectItem value="REGULAR">REGULAR</SelectItem>
                      <SelectItem value="RUIM">RUIM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isAdmin && (
                  <div className="space-y-1.5">
                    <Label>Consultor</Label>
                    <Select
                      value={filters.consultant}
                      onValueChange={(v) => updateFilter({ consultant: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
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
                )}

                <div className="space-y-1.5">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={filters.dateStart}
                    onChange={(e) => updateFilter({ dateStart: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={filters.dateEnd}
                    onChange={(e) => updateFilter({ dateEnd: e.target.value })}
                  />
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
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Nº</TableHead>
                        <TableHead>Estabelecimento</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Conformidade</TableHead>
                        <TableHead>Classificação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((insp: any) => {
                        const cls = classificacao(Number(insp.conformidade));
                        const isSending =
                          resendEmail.isPending && resendEmail.variables?.id === insp.id;
                        return (
                          <TableRow key={insp.id}>
                            <TableCell className="font-mono text-xs font-bold">
                              #
                              {(insp.numero_sequencial ?? insp.numero ?? 0)
                                .toString()
                                .padStart(3, "0")}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {insp.estabelecimento_nome}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {insp.cnpj}
                            </TableCell>
                            <TableCell className="text-xs">
                              {new Date(insp.data_conclusao || insp.data_inicio).toLocaleDateString(
                                "pt-BR",
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-bold text-primary">
                                {Number(insp.conformidade).toFixed(1)}%
                              </div>
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
                              <div className="flex justify-end gap-1">
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
                                {insp.cnpj && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      navigate({
                                        to: "/estabelecimento",
                                        search: { cnpj: insp.cnpj },
                                      })
                                    }
                                    title="Ver histórico do estabelecimento"
                                    className="h-8 w-8 p-0"
                                  >
                                    <TrendingUp className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resendEmail.mutate(insp)}
                                  disabled={isSending}
                                  title="Reenviar e-mail"
                                  className="h-8 w-8 p-0"
                                >
                                  {isSending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Mail className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {visibleRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            Nenhum relatório encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Página {page + 1} de {totalPages} · {total} relatório{total === 1 ? "" : "s"}
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
      </AppShell>
    </ProtectedRoute>
  );
}

function StatCard({ title, value, icon: Icon, color, sub, className }: any) {
  return (
    <Card className={cn("p-4 flex items-center gap-3", className)}>
      {Icon && (
        <div className={cn("p-2.5 rounded-lg", color)}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider truncate">
          {title}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-xl font-bold mt-0.5">{value}</h3>
          {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
      </div>
    </Card>
  );
}
