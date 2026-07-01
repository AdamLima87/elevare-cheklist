import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", perfil: "consultor" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", { body: { action: "create_user", userData: form } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Usuário criado com sucesso!");
      setShowForm(false);
      setForm({ nome: "", email: "", senha: "", perfil: "consultor" });
      load();
    } catch (e: any) { toast.error(e.message || "Erro ao criar usuário."); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    await supabase.from("profiles").update({ ativo: !ativo }).eq("id", id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ativo: !ativo } : u));
    toast.success(ativo ? "Usuário desativado." : "Usuário reativado.");
  };

  const perfilBadge = (p: string) => p === "admin" ? "bg-red-100 text-red-700" : p === "consultor" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";

  return (
    <div>
      <div className="flex items-center justify-end mb-6">
        <Button onClick={() => setShowForm(!showForm)} className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white gap-2"><UserPlus className="h-4 w-4" />Novo Usuário</Button>
      </div>
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 grid grid-cols-2 gap-4">
          <Input placeholder="Nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          <Input placeholder="E-mail" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input placeholder="Senha temporária" type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} />
          <select value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
            <option value="admin">Admin</option>
            <option value="consultor">Consultor</option>
            <option value="cliente">Cliente</option>
          </select>
          <div className="col-span-2 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-[#1a4d2e] text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}</Button>
          </div>
        </div>
      )}
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div> : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-sm">{u.nome}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${perfilBadge(u.perfil)}`}>{u.perfil}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${u.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
                <Button variant="outline" size="sm" onClick={() => handleToggle(u.id, u.ativo)}>{u.ativo ? "Desativar" : "Reativar"}</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
