import { useNavigate, useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

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
        const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        setProfile(data);
      } else if (!location.pathname.includes('/login') && !location.pathname.includes('/reset-password')) {
        navigate({ to: '/login' });
      }
    }
    getProfile();
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const isAuthPage = location.pathname === "/login" || location.pathname === "/reset-password";
  if (isAuthPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <Sidebar profile={profile} onLogout={handleLogout} isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
      <main className={cn("flex-1 min-w-0 transition-all duration-200 flex flex-col", isMobile ? "pt-16 px-4" : "ml-[64px]")}>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1">
          {children}
        </div>
        <footer className="py-4 text-center text-[10px] text-muted-foreground uppercase tracking-widest border-t bg-background">
          Elevare Consultoria · Segurança dos Alimentos · RDC 216 & 275 ANVISA
        </footer>
      </main>
    </div>
  );
}
