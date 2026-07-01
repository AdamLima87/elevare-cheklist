import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, FileText, Mail, FilterX, ClipboardCheck, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { classificacao } from "@/lib/storage";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · Elevare" }] }),
  component: RelatoriosWrapper,
});

function RelatoriosWrapper() {
  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <RelatoriosPage />
    </ProtectedRoute>
  );
}

function RelatoriosPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: "", consultant: "all", classification: "all", dateFrom: "", dateTo: "" });
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        setUserProfile(profile);
        const isAdmin = profile?.perfil === "admin";
        let query = supabase.from("inspecoes").select("*").eq("status", "concluida").order("data_conclusao", { ascending: false });
        if (!isAdmin) query = query.eq("consultor_id", session.user.id);
        const { data: inspData } = await query;
        setInspections(inspData || []);
        if (isAdmin) {
          const { data: profData } = await supabase.from("profiles").select("id, nome").in("perfil", ["admin", "consultor"]);
          const map: Record<string, string> = {};
          profData?.forEach(p => map[p.id] = p.nome);
          setProfiles(map);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  const filtered = inspections.filter(i => {
    const s = filters.search.toLowerCase();
    const matchSearch = !s || i.estabelecimento_nome?.toLowerCase().includes(s) || i.cnpj?.includes(s) || i.numero_sequencial?.toString().includes(s);
    const conf = Number(i.conformidade);
    const matchClass = filters.classification === "all" ||
      (filters.classification === "bom" && conf >= 76) ||
      (filters.classification === "regular" && conf >= 51 && conf < 76) ||
      (filters.classification === "ruim" && conf < 51);
    const matchConsultant = filters.consultant === "all" || i.consultor_id === filters.consultant;
    const matchFrom = !filters.dateFrom || new Date(i.data_conclusao) >= new Date(filters.dateFrom);
    const matchTo = !filters.dateTo || new Date(i.data_conclusao) <= new Date(filters.dateTo);
    return matchSearch && matchClass && matchConsultant && matchFrom && matchTo;
  });

  const stats = {
    total: filtered.length,
    media: filtered.length > 0 ? filtered.reduce((a, i) => a + Number(i.conformidade), 0) / filtered.length : 0,
    bom: filtered.filter(i => Number(i.conformidade) >= 76).length,
    regular: filtered.filter(i => Number(i.conformidade) >= 51 && Number(i.conformidade) < 76).length,
    ruim: filtered.filter(i => Number(i.conformidade) < 51).length,
  };

  const handleResendEmail = async (insp: any) => {
    const email = insp.dados?.estabelecimento?.respLegalEmail || insp.dados?.estabelecimento?.email;
    if (!email) { toast.error("E-mail do cliente não encontrado."); return; }
    setSendingEmail(insp.id);
    try {
      await supabase.functions.invoke("enviar-email-inspecao", {
        body: { email_cliente: email, nome_estabelecimento: insp.estabelecimento_nome, cnpj: insp.cnpj, conformidade: insp.conformidade, link_resultado: `${window.location.origin}/meu-resultado` }
      });
      toast.success(`E-mail reenviado para ${email}`);
    } catch { toast.error("Erro ao reenviar e-mail."); }
    finally { setSendingEmail(null); }
  };

  const clearFilters = () => setFilters({ search: "", consultant: "all", classification: "all", dateFrom: "", dateTo: "" });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">Visualize o desempenho e resultados das inspeções concluídas.</p>
          </div>
          <Button variant="outline" onClick={clearFilters} className="gap-2"><FilterX className="h-4 w-4" />Limpar Filtros</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total de Relatórios", value: stats.total, icon: ClipboardCheck, color: "text-blue-600 bg-blue-50" },
            { label: "Média Conformidade", value: `${stats.media.toFixed(1)}%`, icon: TrendingDown, color: "text-green-600 bg-green-50" },
            { label: "BOM", value: stats.bom, sub: ">= 76%", color: "text-green-600 bg-green-50" },
            { label: "REGULAR", value: stats.regular, sub: "51-75%", color: "text-yellow-600 bg-yellow-50" },
            { label: "RUIM", value: stats.ruim, sub: "< 51%", color: "text-red-600 bg-red-50" },
          ].map(s => (
            <Card key={s.label} className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
              {s.sub && <p className="text-[10px] text-muted-foreground">{s.sub}</p>}
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Filtros Avançados</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Busca</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nome, CNPJ ou Nº" className="pl-9" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Classificação</Label>
                <Select value={filters.classification} onValueChange={v => setFilters(f => ({ ...f, classification: v }))}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="bom">BOM (≥76%)</SelectItem>
                    <SelectItem value="regular">REGULAR (51-75%)</SelectItem>
                    <SelectItem value="ruim">RUIM (&lt;51%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {userProfile?.perfil === "admin" && (
                <div className="space-y-1">
                  <Label className="text-xs">Consultor</Label>
                  <Select value={filters.consultant} onValueChange={v => setFilters(f => ({ ...f, consultant: v }))}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(profiles).map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Data Início</Label>
                <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Fim</Label>
                <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Nº</TableHead>
                    <TableHead>Estabelecimento</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Conformidade</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(insp => {
                    const conf = Number(insp.conformidade);
                    const cls = classificacao(conf);
                    return (
                      <TableRow key={insp.id}>
                        <TableCell className="font-mono font-bold">#{String(insp.numero_sequencial ?? 0).padStart(3, "0")}</TableCell>
                        <TableCell className="font-medium">{insp.estabelecimento_nome}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{insp.cnpj}</TableCell>
                        <TableCell className="text-sm">{new Date(insp.data_conclusao || insp.data_inicio).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="font-bold" style={{ color: cls.color }}>{conf.toFixed(1)}%</TableCell>
                        <TableCell>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold border" style={{ color: cls.color, background: cls.bg, borderColor: cls.color + "40" }}>
                            {cls.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/resultado", search: { id: insp.id, readonly: true } })} title="Ver relatório">
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleResendEmail(insp)} disabled={sendingEmail === insp.id} title="Reenviar e-mail">
                              {sendingEmail === insp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Nenhuma inspeção encontrada com os filtros aplicados.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
