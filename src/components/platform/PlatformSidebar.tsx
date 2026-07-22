import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Receipt,
  Search,
  ShieldAlert,
  Plug,
  LifeBuoy,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { Logo } from "@/components/elevare/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Nav fixo do módulo de plataforma — não reaproveita o Sidebar.tsx do
// tenant (não é parametrizável hoje: Sidebar importa profile/menuItems
// tenant-scoped direto). É intencionalmente mais simples (sem flyout):
// esse é um painel interno pra um único perfil (super_admin), não
// precisa da mesma UI de navegação usada por centenas de usuários finais.
const platformMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/plataforma" },
  { icon: Building2, label: "Empresas", to: "/plataforma/empresas" },
  { icon: Settings, label: "Usuários", to: "/plataforma/usuarios" },
  { icon: CreditCard, label: "Planos", to: "/plataforma/planos" },
  { icon: Receipt, label: "Cobranças", to: "/plataforma/cobrancas" },
  { icon: Search, label: "Google Places", to: "/plataforma/consumo" },
  { icon: Plug, label: "Integrações", to: "/plataforma/integracoes" },
  { icon: ShieldAlert, label: "Auditoria", to: "/plataforma/logs" },
  { icon: LifeBuoy, label: "Suporte", to: "/plataforma/suporte" },
  { icon: Settings, label: "Configurações", to: "/plataforma/configuracoes" },
];

function PlatformSidebarContent({ onLogout, onNavigate }: { onLogout: () => void; onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <div className="flex h-full flex-col bg-brand-grain text-white">
      <div className="flex items-center justify-start px-4 py-5">
        <div className="inline-flex items-center rounded-lg bg-white px-3 py-2 shadow-sm">
          <Logo />
        </div>
      </div>
      <div className="mx-3 mb-2 h-px bg-white/10" />
      <div className="px-4 pb-3">
        <span className="label-eyebrow text-[color:var(--brand-accent)]/80">Administração da Plataforma</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {platformMenuItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-sm border-l-2 px-3 py-2 text-[13px] font-medium tracking-wide transition-all",
                isActive
                  ? "border-[color:var(--brand-accent)] bg-white/10 text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-2">
        <div className="mx-1 mb-2 h-px bg-white/10" />
        <Link
          to="/escolha-acesso"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] font-medium text-white/70 transition-all hover:bg-white/5 hover:text-white"
        >
          <Building2 className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
          Trocar de ambiente
        </Link>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-[13px] font-medium text-white/70 transition-all hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
          Sair
        </button>
      </div>
    </div>
  );
}

export function PlatformSidebar({ onLogout }: { onLogout: () => void }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isMobile) {
    return (
      <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center border-b border-white/10 bg-brand-grain px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 border-none p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu da Plataforma</SheetTitle>
            </SheetHeader>
            <PlatformSidebarContent onLogout={onLogout} />
          </SheetContent>
        </Sheet>
        <div className="ml-4 inline-flex items-center rounded-lg bg-white px-3 py-1.5 shadow-sm">
          <Logo />
        </div>
      </header>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-[220px] border-r border-white/10">
      <PlatformSidebarContent onLogout={onLogout} />
    </aside>
  );
}
