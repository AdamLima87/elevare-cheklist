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
  head: () => ({
    meta: [
      { title: "Configurações · Elevare" },
      { name: "description", content: "Configurações do sistema e dados da empresa." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>({
    nome_empresa: "Elevare Consultoria",
    email_contato: "contato@elevare.com.br",
    telefone: "",
    site: "",
    enviar_email_cliente: true,
    notificar_admin: false,
  });

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("configuracoes")
          .select("*")
          .single();
        
        if (error) {
          if (error.code === "PGRST116") {
            // No record found, we use defaults
            console.log("No config found, using defaults");
          } else {
            throw error;
          }
        } else if (data) {
          setConfig(data);
        }
      } catch (error) {
        console.error("Error fetching config:", error);
        toast.error("Erro ao carregar configurações");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id, created_at, updated_at, ...updateData } = config;
      
      let error;
      if (id) {
        ({ error } = await supabase
          .from("configuracoes")
          .update(updateData)
          .eq("id", id));
      } else {
        ({ error } = await supabase
          .from("configuracoes")
          .insert([updateData]));
      }

      if (error) throw error;
      toast.success("Alterações salvas com sucesso!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      toast.loading("Preparando exportação...");
      const { data: inspections, error } = await supabase
        .from("inspecoes")
        .select("*");
      
      if (error) throw error;

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(inspections, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `elevare_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      toast.dismiss();
      toast.success("Dados exportados com sucesso!");
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Erro ao exportar dados");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedProfiles={["admin"]}>
        <AppShell>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedProfiles={["admin"]}>
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-muted-foreground text-sm">Gerencie os dados da empresa e preferências do sistema.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sobre o Sistema */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Sobre o Sistema</CardTitle>
                </div>
                <CardDescription>Informações gerais do Checklist Elevare</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-semibold">Nome do App:</span>
                  <span>Checklist Elevare</span>
                  <span className="font-semibold">Versão:</span>
                  <span>1.0.0</span>
                  <span className="font-semibold">Base Legal:</span>
                  <span className="text-xs">RDC nº 275/2002 e RDC nº 216/2004 — ANVISA</span>
                </div>
              </CardContent>
            </Card>

            {/* Notificações */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Notificações</CardTitle>
                </div>
                <CardDescription>Preferências de alertas e envios automáticos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>E-mail ao cliente</Label>
                    <p className="text-xs text-muted-foreground">Enviar relatório ao concluir inspeção</p>
                  </div>
                  <Switch 
                    checked={config.enviar_email_cliente} 
                    onCheckedChange={v => setConfig({...config, enviar_email_cliente: v})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificar Admin</Label>
                    <p className="text-xs text-muted-foreground">Avisar sobre novas inspeções concluídas</p>
                  </div>
                  <Switch 
                    checked={config.notificar_admin} 
                    onCheckedChange={v => setConfig({...config, notificar_admin: v})}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dados da Empresa */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Dados da Empresa</CardTitle>
                </div>
                <CardDescription>Estes dados serão utilizados nos cabeçalhos dos relatórios</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_empresa">Nome da Empresa</Label>
                  <Input 
                    id="nome_empresa" 
                    value={config.nome_empresa} 
                    onChange={e => setConfig({...config, nome_empresa: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_contato">E-mail de Contato</Label>
                  <Input 
                    id="email_contato" 
                    type="email"
                    value={config.email_contato} 
                    onChange={e => setConfig({...config, email_contato: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input 
                    id="telefone" 
                    value={config.telefone} 
                    onChange={e => setConfig({...config, telefone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site">Site</Label>
                  <Input 
                    id="site" 
                    value={config.site} 
                    onChange={e => setConfig({...config, site: e.target.value})}
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t p-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar alterações
                </Button>
              </CardFooter>
            </Card>

            {/* Dados e Armazenamento */}
            <Card className="md:col-span-2 border-dashed">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Dados e Armazenamento</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm">
                  <p className="font-medium">Sincronização na Nuvem</p>
                  <p className="text-muted-foreground">Todas as inspeções são armazenadas com segurança via Supabase.</p>
                </div>
                <Button variant="outline" onClick={handleExportData}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar todos os dados (JSON)
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
