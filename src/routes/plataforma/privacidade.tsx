import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Download, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/plataforma/privacidade")({
  head: () => ({ meta: [{ title: "Privacidade (LGPD) · Administração da Plataforma · RDCheck" }] }),
  component: PlatformPrivacidadePage,
});

interface ResumoAnonimizacao {
  contatos_excluidos: number;
  representantes_anonimizados: number;
  contas_pf_anonimizadas: number;
  inspecoes_anonimizadas: number;
  login_attempts_excluidos: number;
  signup_attempts_excluidos: number;
}

function PlatformPrivacidadePage() {
  const [identificador, setIdentificador] = useState("");
  const [exportando, setExportando] = useState(false);
  const [anonimizando, setAnonimizando] = useState(false);
  const [ultimoResumo, setUltimoResumo] = useState<ResumoAnonimizacao | null>(null);

  const handleExportar = async () => {
    if (!identificador.trim()) {
      toast.error("Informe um e-mail ou CPF.");
      return;
    }
    setExportando(true);
    try {
      const { data, error } = await supabase.rpc("platform_exportar_dados_titular", {
        p_identificador: identificador.trim(),
      });
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados-titular-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Exportação gerada. O download deve começar automaticamente.");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível exportar os dados.");
    } finally {
      setExportando(false);
    }
  };

  const handleAnonimizar = async () => {
    if (!identificador.trim()) {
      toast.error("Informe um e-mail ou CPF.");
      return;
    }
    setAnonimizando(true);
    try {
      const { data, error } = await supabase.rpc("platform_anonimizar_titular", {
        p_identificador: identificador.trim(),
        p_confirmar: true,
      });
      if (error) throw error;
      setUltimoResumo(data as ResumoAnonimizacao);
      toast.success("Dados anonimizados/excluídos com sucesso.");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível anonimizar os dados.");
    } finally {
      setAnonimizando(false);
    }
  };

  return (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Privacidade (LGPD)</h1>
          <p className="text-sm text-muted-foreground">
            Direitos do titular — exportação e anonimização de dados pessoais de terceiros mencionados no sistema
            (representantes legais, contatos, responsáveis de inspeção).
          </p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">Buscar titular</CardTitle>
            <CardDescription>Informe o e-mail ou o CPF (só números ou formatado) da pessoa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="identificador">E-mail ou CPF</Label>
              <Input
                id="identificador"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="pessoa@exemplo.com ou 000.000.000-00"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleExportar} disabled={exportando} className="gap-2">
                {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar dados
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={anonimizando} className="gap-2">
                    {anonimizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                    Excluir / anonimizar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir/anonimizar dados deste titular?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Contatos de CRM são excluídos de verdade. Representantes legais, contas Pessoa Física e
                      relatórios de inspeção têm nome/CPF substituídos por um marcador de anonimização — o restante
                      do histórico (contratos, relatórios) é preservado, como exige a guarda documental regulatória.
                      Essa ação não pode ser desfeita. Recomendamos exportar os dados antes de confirmar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleAnonimizar}>Confirmar exclusão/anonimização</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {ultimoResumo && (
          <Card className="max-w-2xl mt-4">
            <CardHeader>
              <CardTitle className="text-base">Resultado da última anonimização</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Contatos de CRM excluídos: {ultimoResumo.contatos_excluidos}</li>
                <li>Representantes legais anonimizados: {ultimoResumo.representantes_anonimizados}</li>
                <li>Contas Pessoa Física anonimizadas: {ultimoResumo.contas_pf_anonimizadas}</li>
                <li>Inspeções com dados de responsável anonimizados: {ultimoResumo.inspecoes_anonimizadas}</li>
                <li>Registros de tentativa de login excluídos: {ultimoResumo.login_attempts_excluidos}</li>
                <li>Registros de tentativa de cadastro excluídos: {ultimoResumo.signup_attempts_excluidos}</li>
              </ul>
            </CardContent>
          </Card>
        )}
      </PlatformLayout>
    </ProtectedRoute>
  );
}
