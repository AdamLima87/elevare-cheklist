import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useState, useEffect } from "react";
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
import { Loader2, Search, FileText, Mail, Download, FilterX, ClipboardCheck, TrendingDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { classificacao } from "@/lib/storage";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios · Elevare" },
      { name: "description", content: "Relatórios de inspeções concluídas." },
    ],
  }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    search: "",
    consultant: "all",
    classification: "all",
    dateStart: "",
    dateEnd: "",
  });

  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      
      setUserProfile(profile);

      let query = supabase
        .from("inspecoes")
        .select("*")
        .eq("status", "concluida");

      if (profile?.perfil === "consultor") {
        query = query.eq("consultor_id", session.user.id);
      } else if (filters.consultant !== "all") {
        query = query.eq("consultor_id", filters.consultant);
      }

      if (filters.dateStart) {
        query = query.gte("data_conclusao", filters.dateStart);
      }
      if (filters.dateEnd) {
        query = query.lte("data_conclusao", filters.dateEnd + "T23:59:59");
      }

      const { data, error } = await query.order("data_conclusao", { ascending: false });
      if (error) throw error;

      // Filter by classification in JS since it depends on a calculated field (conformidade)
      let filteredData = data || [];
      if (filters.classification !== "all") {
        filteredData = filteredData.filter(i => {
          const conf = Number(i.conformidade) || 0;
          if (filters.classification === "BOM") return conf >= 76;
          if (filters.classification === "REGULAR") return conf >= 51 && conf < 76;
          if (filters.classification === "RUIM") return conf < 51;
          return true;
        });
      }

      // Filter by search (name/cnpj)
      if (filters.search) {
        const s = filters.search.toLowerCase();
        filteredData = filteredData.filter(i => 
          i.estabelecimento_nome?.toLowerCase().includes(s) || 
          i.cnpj?.includes(s) ||
          i.numero_sequencial?.toString().includes(s)
        );
      }

      setInspections(filteredData);

      // Fetch consultants if admin
      if (profile?.perfil === "admin") {
        const { data: consultants } = await supabase
          .from("profiles")
          .select("id, nome")
          .eq("perfil", "consultor");
        
        const profMap: Record<string, string> = {};
        consultants?.forEach(p => profMap[p.id] = p.nome);
        setProfiles(profMap);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.consultant, filters.dateStart, filters.dateEnd, filters.classification]);

  const stats = {
    total: inspections.length,
    avg: inspections.length > 0 
      ? inspections.reduce((acc, i) => acc + (Number(i.conformidade) || 0), 0) / inspections.length 
      : 0,
    bom: inspections.filter(i => (Number(i.conformidade) || 0) >= 76).length,
    regular: inspections.filter(i => (Number(i.conformidade) || 0) >= 51 && (Number(i.conformidade) || 0) < 76).length,
    ruim: inspections.filter(i => (Number(i.conformidade) || 0) < 51).length,
  };

  const handleResendEmail = async (insp: any) => {
    const email = insp.dados?.estabelecimento?.respLegalEmail || insp.dados?.estabelecimento?.email;
    const cnpj = insp.cnpj || insp.dados?.estabelecimento?.cnpj || "";
    
    if (!email) {
      toast.error("E-mail do cliente não encontrado.");
      return;
    }

    setSendingEmail(insp.id);
    try {
      const conf = Number(insp.conformidade);
      const cls = classificacao(conf);

      const response = await fetch('/lovable/email/transactional/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          templateName: "inspection",
          recipientEmail: email,
          templateData: {
            email_cliente: email,
            nome_estabelecimento: insp.estabelecimento_nome,
            cnpj: cnpj,
            data_inspecao: insp.data_inicio,
            conformidade: insp.conformidade,
            classificacaoLabel: cls.label,
            classificacaoTone: cls.tone,
            link_resultado: `${window.location.origin}/meu-resultado`
          }
        })
      });

      if (!response.ok) throw new Error('Falha ao reenviar e-mail');
      toast.success(`Relatório reenviado para ${email}`);
    } catch (error) {
      console.error("Error resending email:", error);
      toast.error("Erro ao reenviar e-mail.");
    } finally {
      setSendingEmail(null);
    }
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      consultant: "all",
      classification: "all",
      dateStart: "",
      dateEnd: "",
    });
  };

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Relatórios</h1>
              <p className="text-muted-foreground text-sm">Visualize o desempenho e resultados das inspeções concluídas.</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <FilterX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total de Relatórios" value={stats.total} icon={ClipboardCheck} color="bg-blue-50 text-blue-600" />
            <StatCard title="Média Conformidade" value={`${stats.avg.toFixed(1)}%`} icon={TrendingDown} color="bg-green-50 text-green-600" />
            <div className="flex gap-4 lg:col-span-2">
              <StatCard title="BOM" value={stats.bom} sub=">= 76%" color="bg-emerald-50 text-emerald-600" className="flex-1" />
              <StatCard title="REGULAR" value={stats.regular} sub="51-75%" color="bg-amber-50 text-amber-600" className="flex-1" />
              <StatCard title="RUIM" value={stats.ruim} sub="< 51%" color="bg-red-50 text-red-600" className="flex-1" />
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Filtros Avançados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="search">Busca</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="search"
                      placeholder="Nome, CNPJ ou Nº" 
                      className="pl-8"
                      value={filters.search}
                      onChange={e => setFilters({...filters, search: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Classificação</Label>
                  <Select value={filters.classification} onValueChange={v => setFilters({...filters, classification: v})}>
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

                {userProfile?.perfil === "admin" && (
                  <div className="space-y-1.5">
                    <Label>Consultor</Label>
                    <Select value={filters.consultant} onValueChange={v => setFilters({...filters, consultant: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {Object.entries(profiles).map(([id, nome]) => (
                          <SelectItem key={id} value={id}>{nome}</SelectItem>
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
                    onChange={e => setFilters({...filters, dateStart: e.target.value})} 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Data Fim</Label>
                  <Input 
                    type="date" 
                    value={filters.dateEnd} 
                    onChange={e => setFilters({...filters, dateEnd: e.target.value})} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? (
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
                      {inspections.map((insp) => {
                        const cls = classificacao(Number(insp.conformidade));
                        return (
                          <TableRow key={insp.id}>
                            <TableCell className="font-mono text-xs font-bold">
                              #{(insp.numero_sequencial ?? insp.numero ?? 0).toString().padStart(3, '0')}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {insp.estabelecimento_nome}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {insp.cnpj}
                            </TableCell>
                            <TableCell className="text-xs">
                              {new Date(insp.data_conclusao || insp.data_inicio).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-bold text-primary">
                                {Number(insp.conformidade).toFixed(1)}%
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                cls.tone === "success" && "bg-green-100 text-green-700",
                                cls.tone === "warning" && "bg-yellow-100 text-yellow-700",
                                cls.tone === "destructive" && "bg-red-100 text-red-700"
                              )}>
                                {cls.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate({ to: "/resultado", search: { id: insp.id, readonly: true } })}
                                  title="Ver relatório"
                                  className="h-8 w-8 p-0"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResendEmail(insp)}
                                  disabled={sendingEmail === insp.id}
                                  title="Reenviar e-mail"
                                  className="h-8 w-8 p-0"
                                >
                                  {sendingEmail === insp.id ? (
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
                      {inspections.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            Nenhum relatório encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
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
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider truncate">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-xl font-bold mt-0.5">{value}</h3>
          {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
      </div>
    </Card>
  );
}
