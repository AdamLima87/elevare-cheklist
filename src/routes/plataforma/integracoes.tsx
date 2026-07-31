import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Mail } from "lucide-react";
import { usePlatformIntegracoesResumo } from "@/hooks/usePlatform";

export const Route = createFileRoute("/plataforma/integracoes")({
  head: () => ({ meta: [{ title: "Integrações · Administração da Plataforma · RDCheck" }] }),
  component: PlatformIntegracoesPage,
});

function PlatformIntegracoesPage() {
  const { data: resumo, isLoading } = usePlatformIntegracoesResumo();

  return (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Integrações</h1>
          <p className="text-sm text-muted-foreground">
            Status agregado das integrações de terceiros usadas pela plataforma. Nenhuma chave/credencial é exibida
            aqui — só contagens de status já expostas em outras telas.
          </p>
        </div>

        {isLoading || !resumo ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Google Places (Lead Finder)</CardTitle>
                </div>
                <CardDescription>Busca e importação de leads no módulo de Prospecção do CRM.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tenants usando chave própria (BYO)</span>
                  <span className="font-medium">
                    {resumo.google_places_tenants_byo} / {resumo.empresas_total}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tenants usando chave do RDCheck</span>
                  <span className="font-medium">{resumo.google_places_tenants_rdcheck}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Credenciais próprias com status inválido</span>
                  <span className="font-medium">
                    {resumo.google_places_tenants_invalido > 0 ? (
                      <Badge variant="destructive">{resumo.google_places_tenants_invalido}</Badge>
                    ) : (
                      <Badge variant="outline">0</Badge>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Leads importados (total, todos os tenants)</span>
                  <span className="font-medium">{resumo.google_places_leads_total}</span>
                </div>
                <Link to="/plataforma/consumo" className="block pt-1 text-xs text-primary hover:underline">
                  Ver detalhamento por tenant →
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">E-mail transacional (Resend)</CardTitle>
                </div>
                <CardDescription>
                  Confirmação de cadastro, notificações e comunicação com clientes — enviado em nome de cada tenant.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tenants com notificação ao cliente habilitada</span>
                  <span className="font-medium">
                    {resumo.email_tenants_habilitados} / {resumo.empresas_total}
                  </span>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  Integração compartilhada por toda a plataforma (não é por-tenant) — usada nos fluxos de cadastro
                  público, confirmação de e-mail e reenvio de senha provisória.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </PlatformLayout>
    </ProtectedRoute>
  );
}
