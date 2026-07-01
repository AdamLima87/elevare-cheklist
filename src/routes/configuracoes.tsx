import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Download, Building, Bell, Info, Database } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · Elevare" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>({
    nome_empresa: "Elevare Consultoria",
    email_contato: "contato@elevareconsultoria.com",
    telefone: "(11) 99484-0948",
    site: "elevareconsultoria.com",
    enviar_email_cliente: true,
    notificar_admin: false,
  });

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data, error } = await supabase.from("configuracoes").select("*").single();
        if (!error && data) setConfig(data);
      } catch { } finally { setLoading(false); }
    }
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id, created_at, updated_at, ...updateData } = config;
      let error;
      if (id) {
        ({ error } = await supabase.from("configuracoes").update(updateData).eq("id", id));
      } else {
        ({ error } = await supabase.from("configuracoes").insert([updateData]));
      }
      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
    } catch { toast.error("Erro ao salvar configurações"); }
    finally { setSaving(false); }
  };

  const handleExport = async () => {
    try {
      const { data } = await supabase.from("inspecoes").select("*");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `elevare-inspecoes-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dados exportados com sucesso!");
    } catch { toast.error("Erro ao exportar dados"); }
  };

  if (loading) return <AppShell><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1a4d2e]" /></div></AppShell>;

  return (
    <ProtectedRoute allowedProfiles={["admin"]}>
      <AppShell>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie os dados da empresa e preferências do sistema.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Info className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base">Sobre o Sistema</CardTitle></div>
              <CardDescription>Informações gerais do Checklist Elevare</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground font-medium">Nome do App:</span><span>Checklist Elevare</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground font-medium">Versão:</span><span>1.0.0</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground font-medium">Base Legal:</span><span className="text-right">RDC nº 275/2002 e RDC nº 216/2004 — ANVISA</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base">Notificações</CardTitle></div>
              <CardDescription>Preferências de alertas e envios automáticos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm">E-mail ao cliente</p><p className="text-xs text-muted-foreground">Enviar relatório ao concluir inspeção</p></div>
                <Switch checked={config.enviar_email_cliente} onCheckedChange={v => setConfig((c: any) => ({ ...c, enviar_email_cliente: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm">Notificar Admin</p><p className="text-xs text-muted-foreground">Avisar sobre novas inspeções concluídas</p></div>
                <Switch checked={config.notificar_admin} onCheckedChange={v => setConfig((c: any) => ({ ...c, notificar_admin: v }))} />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2"><Building className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base">Dados da Empresa</CardTitle></div>
              <CardDescription>Estes dados serão utilizados nos cabeçalhos dos relatórios</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome da Empresa</Label><Input value={config.nome_empresa || ""} onChange={e => setConfig((c: any) => ({ ...c, nome_empresa: e.target.value }))} /></div>
              <div className="space-y-2"><Label>E-mail de Contato</Label><Input type="email" value={config.email_contato || ""} onChange={e => setConfig((c: any) => ({ ...c, email_contato: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={config.telefone || ""} onChange={e => setConfig((c: any) => ({ ...c, telefone: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Site</Label><Input value={config.site || ""} onChange={e => setConfig((c: any) => ({ ...c, site: e.target.value }))} /></div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={handleSave} disabled={saving} className="bg-[#1a4d2e] hover:bg-[#1a4d2e]/90 text-white gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar alterações
              </Button>
            </CardFooter>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2"><Database className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base">Dados e Armazenamento</CardTitle></div>
              <CardDescription>Gerencie os dados armazenados no sistema</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div><p className="font-medium text-sm">Sincronização na Nuvem</p><p className="text-xs text-muted-foreground">Dados armazenados no Supabase — São Paulo</p></div>
              <Button variant="outline" onClick={handleExport} className="gap-2"><Download className="h-4 w-4" />Exportar todos os dados</Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
