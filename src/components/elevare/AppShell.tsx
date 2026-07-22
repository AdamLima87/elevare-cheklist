import { useNavigate, useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUpcomingVisitas } from "@/hooks/useVisitas";
import { useExpiringDocumentos } from "@/hooks/useDocumentos";
import { useTenantAccessStatus } from "@/hooks/useTenantAccessStatus";
import { CalendarClock, FileWarning, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const VISITAS_ALERT_KEY = "elevare_visitas_alert_shown";
const DOCUMENTOS_ALERT_KEY = "elevare_documentos_alert_shown";

export function AppShell({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    async function getProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        setProfile(data);
      } else if (!location.pathname.includes('/login') && !location.pathname.includes('/reset-password')) {
         navigate({ to: '/login' });
      }
    }
    getProfile();
  }, [navigate, location.pathname]);

  const alertEnabled = !!profile && (profile.perfil === "admin" || profile.perfil === "consultor" || profile.perfil === "super_admin");
  const { data: upcomingVisitas } = useUpcomingVisitas(1, alertEnabled);

  useEffect(() => {
    if (!alertEnabled || !upcomingVisitas) return;
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(VISITAS_ALERT_KEY)) return;
    sessionStorage.setItem(VISITAS_ALERT_KEY, "1");

    if (upcomingVisitas.length === 0) return;

    const nomes = upcomingVisitas.slice(0, 3).map((v) => v.clientes?.nome ?? "Cliente").join(", ");
    const resto = upcomingVisitas.length > 3 ? ` e mais ${upcomingVisitas.length - 3}` : "";
    toast.info(
      `Você tem ${upcomingVisitas.length} visita${upcomingVisitas.length > 1 ? "s" : ""} agendada${upcomingVisitas.length > 1 ? "s" : ""} para hoje: ${nomes}${resto}.`,
      {
        icon: <CalendarClock className="h-4 w-4" />,
        duration: 8000,
        action: {
          label: "Ver agenda",
          onClick: () => navigate({ to: "/agenda" }),
        },
      },
    );
  }, [alertEnabled, upcomingVisitas, navigate]);

  const { data: expiringDocumentos } = useExpiringDocumentos(30, alertEnabled);

  useEffect(() => {
    if (!alertEnabled || !expiringDocumentos) return;
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(DOCUMENTOS_ALERT_KEY)) return;
    sessionStorage.setItem(DOCUMENTOS_ALERT_KEY, "1");

    if (expiringDocumentos.length === 0) return;

    const vencidos = expiringDocumentos.filter(
      (d) => d.data_vencimento && new Date(d.data_vencimento + "T00:00:00").getTime() < Date.now(),
    ).length;
    const mensagem = vencidos > 0
      ? `Você tem ${expiringDocumentos.length} documento${expiringDocumentos.length > 1 ? "s" : ""} vencido${vencidos > 1 ? "s" : ""} ou vencendo em até 30 dias (${vencidos} já vencido${vencidos > 1 ? "s" : ""}).`
      : `Você tem ${expiringDocumentos.length} documento${expiringDocumentos.length > 1 ? "s" : ""} vencendo nos próximos 30 dias.`;

    toast.warning(mensagem, {
      icon: <FileWarning className="h-4 w-4" />,
      duration: 8000,
      action: {
        label: "Ver clientes",
        onClick: () => navigate({ to: "/clientes" }),
      },
    });
  }, [alertEnabled, expiringDocumentos, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  // Banner de inadimplência (dias 7-14) — só pra quem gerencia cobrança;
  // consultor/cliente não veem (e nem acessariam /configuracoes mesmo).
  const podeGerenciarCobranca = !!profile && (profile.perfil === "admin" || profile.perfil === "super_admin");
  const { data: acessoStatus } = useTenantAccessStatus() as { data?: { status: string; dias_para_bloqueio: number | null } };
  const mostrarAvisoAtraso = podeGerenciarCobranca && acessoStatus?.status === "past_due_warning";

  // Skip sidebar for login and splash
  const isAuthPage = location.pathname === "/login" || location.pathname === "/reset-password";

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <Sidebar 
        profile={profile} 
        onLogout={handleLogout} 
        isExpanded={isExpanded} 
        setIsExpanded={setIsExpanded} 
      />
      
      <main 
        className={cn(
          "flex-1 min-w-0 transition-all duration-200 flex flex-col",
          isMobile ? "pt-16 px-4" : "ml-[64px]"
        )}
      >
        {mostrarAvisoAtraso && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Sua fatura está em atraso
                {typeof acessoStatus?.dias_para_bloqueio === "number"
                  ? ` — o acesso será bloqueado em ${acessoStatus.dias_para_bloqueio} dia${acessoStatus.dias_para_bloqueio === 1 ? "" : "s"} se não for regularizada.`
                  : "."}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-300 bg-white hover:bg-amber-100"
              onClick={() => navigate({ to: "/configuracoes", search: { tab: "cobranca" } })}
            >
              Regularizar
            </Button>
          </div>
        )}

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full">
          {children}
        </div>

        <footer className="py-6 text-center text-[10px] text-muted-foreground uppercase tracking-widest border-t bg-background">
          RDCheck · Segurança dos Alimentos · RDC 216 & 275 ANVISA
        </footer>
      </main>
    </div>

  );
}
