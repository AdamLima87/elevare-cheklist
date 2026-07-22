import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PlatformSidebar } from "./PlatformSidebar";
import { TenantAccessProvider } from "@/lib/platform/PlatformContext";
import { cn } from "@/lib/utils";

// Equivalente ao AppShell, mas pro módulo de plataforma: sem os hooks
// tenant-scoped do AppShell (visitas/documentos vencendo — não fazem
// sentido fora de um tenant) e sem reaproveitar o Sidebar do tenant
// (não é parametrizável hoje). ProtectedRoute (allowedProfiles={["super_admin"]})
// já garante que só super_admin chega até aqui.
export function PlatformLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <TenantAccessProvider mode="platform">
      <div className="relative flex min-h-screen flex-col bg-background">
        <PlatformSidebar onLogout={handleLogout} />
        <main className={cn("flex-1 min-w-0 transition-all duration-200 flex flex-col", isMobile ? "pt-16 px-4" : "ml-[220px]")}>
          <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</div>
          <footer className="border-t bg-background py-6 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
            RDCheck · Administração da Plataforma
          </footer>
        </main>
      </div>
    </TenantAccessProvider>
  );
}
