import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, FileText, Trash2, Mail, Edit2, UserPlus } from "lucide-react";
import { classificacao, deleteFromHistorico } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function AllInspections() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ consultant: "all", status: "all", search: "" });
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("No session");
      const { data: profile } = await supabase.from("profiles").select("perfil").eq("id", user.id).single();
      const isAdmin = profile?.perfil === "admin";
      let query = supabase.from("inspecoes").select("*");
      if (filter.status !== "all") query = query.eq("status", filter.status);
      if (filter.consultant !== "all") query = query.eq("consultor_id", filter.consultant);
      else if (!isAdmin) query = query.eq("consultor_id", user.id);
      const { data: inspData, error } = await query.order("data_inicio", { ascending: false });
      if (error) throw error;
      const { data: profData } = await supabase.from("profiles").select("id, nome").eq("perfil", "consultor");
      const profMap: Record<string, string> = {};
      profData?.forEach(p => profMap[p.id] = p.nome);
      setProfiles(profMap);
      setInspections(inspData || []);
    } catch (error) {
      console.error("Error fetching inspections:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter.consultant, filter.status]);

  const filteredInspections = inspections.filter(insp => {
    const s = filter.search.toLowerCase();
    return insp.estabelecimento_nome?.toLowerCase().includes(s) || insp.cnpj?.includes(s) || insp.numero_sequencial?.toString().includes(s);
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteFromHistorico(id);
      setInspections(prev => prev.filter(i => i.id !== id));
      toast.success("Inspeção excluída com sucesso");
    } catch { toast.error("Erro ao excluir inspeção"); }
  };

  const handleResendEmail = async (insp: any) => {
    const email = insp.dados?.estabelecimento?.respLegalEmail || insp.dados?.estabelecimento?.email;
    if (!email) { toast.error("E-mail do cliente não encontrado."); return; }
    setSendingEmail(insp.id);
    try {
      await supabase.functions.invoke("enviar-email-inspecao", {
        body: { email_cliente: email, nome_estabelecimento: insp.estabelecimento_nome, cnpj: insp.cnpj, conformidade: insp.conformidade, link_resultado: `${window.location.origin}/meu-resultado` }
      });
      toast.success(`Relatório reenviado para ${email}`);
    } catch { toast.error("Erro ao reenviar e-mail."); }
    finally { setSendingEmail(null); }
  };

  const handleCreateClientAccess = async (insp: any) => {
    const email = insp.dados?.estabelecimento?.respLegalEmail || insp.dados?.estabelecimento?.email;
    const cnpj = (insp.cnpj || "").replace(/\D/g, "");
    const nome = insp.dados?.estabelecimento?.respLegalNome || insp.estabelecimento_nome;
    if (!email || !cnpj) { toast.error("E-mail ou CNPJ não encontrados."); return; }
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", { body: { action: "create_client", userData: { email, password: cnpj, nome, perfil: "cliente", cnpj } } });
      if (error) throw error;
      toast.success("Acesso do cliente gerado com sucesso!");
    } catch { toast.error("Erro ao gerar acesso do cliente."); }
  };

  const handleEdit = async (insp: any) => {
    const mapped = { id: insp.id, numero_sequencial: insp.numero_sequencial, status: "em_andamento", estabelecimento: insp.estabelecimento_nome || "", dataInicio: insp.data_inicio, dataConclusao: null, progresso: insp.progresso, conformidade: null, dados: insp.dados || { estabelecimento: { razaoSocial: insp.estabelecimento_nome, nomeFantasia: insp.estabelecimento_nome, cnpj: insp.cnpj }, questionario: {}, funcionarios: [], fotos: {} }, respostas: insp.respostas || {} };
    localStorage.setItem("elevare_rascunho", JSON.stringify(mapped));
    toast.info("Carregando inspeção para edição...");
    navigate({ to: "/checklist" });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Nome, CNPJ ou Nº..." className="pl-9" value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} />
          </div>
          <Select value={filter.consultant} onValueChange={v => setFilter({ ...filter, consultant: v })}>
            <SelectTrigger><SelectValue placeholder="Todos os consultores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(profiles).map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter.status} onValueChange={v => setFilter({ ...filter, status: v })}>
            <SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Nº</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Estabelecimento / CNPJ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Consultor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Data</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Conformidade</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInspections.map(insp => {
                const cls = insp.status === "concluida" ? classificacao(Number(insp.conformidade)) : null;
                return (
                  <tr key={insp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold">#{String(insp.numero_sequencial ?? 0).padStart(3, "0")}</td>
                    <td className="px-4 py-3"><div className="font-medium">{insp.estabelecimento_nome}</div><div className="text-xs text-slate-400">{insp.cnpj}</div></td>
                    <td className="px-4 py-3 text-slate-600">{profiles[insp.consultor_id] || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(insp.data_inicio).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", insp.status === "concluida" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                        {insp.status === "concluida" ? "Concluída" : "Em andamento"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cls ? <span className="text-xs font-bold" style={{ color: cls.color }}>{Number(insp.conformidade).toFixed(1)}% {cls.label}</span> : <span className="text-xs text-slate-400">{insp.progresso}%</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {insp.status === "concluida" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleCreateClientAccess(insp)} title="Gerar acesso do cliente" className="text-orange-500 hover:text-orange-600"><UserPlus className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleResendEmail(insp)} disabled={sendingEmail === insp.id} title="Reenviar e-mail">
                              {sendingEmail === insp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(insp)} title="Editar" className="text-blue-500 hover:text-blue-600"><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/resultado", search: { id: insp.id, readonly: true } })} title="Ver resultado"><FileText className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Inspeção?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(insp.id)} className="bg-red-500 hover:bg-red-600">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInspections.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Nenhuma inspeção encontrada.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
