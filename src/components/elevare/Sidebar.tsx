import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  UserCircle,
  LogOut,
  FileCheck,
  Menu,
  X,
  Building2,
  Briefcase,
  Target,
  UserPlus,
  ClipboardCheck,
  CalendarDays,
  ChevronRight,
  Search
} from "lucide-react";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface SidebarProps {
  profile: any;
  onLogout: () => Promise<void>;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
}

const clientesSubItems = [
  { icon: UserPlus, label: "Novo Cliente", to: "/clientes", search: { new: true } },
  { icon: Building2, label: "Clientes", to: "/clientes" },
  { icon: CalendarDays, label: "Agenda", to: "/agenda" },
  { icon: ClipboardCheck, label: "Nova Inspeção", to: "/nova-inspecao" },
];

const crmSubItems = [
  { icon: BarChart3, label: "Dashboard", to: "/crm/dashboard" },
  { icon: Search, label: "Buscar Leads", to: "/crm/leads" },
  { icon: Target, label: "Pipeline", to: "/crm/pipeline" },
  { icon: LayoutDashboard, label: "Mesa de Trabalho", to: "/crm" },
  { icon: Building2, label: "Contas", to: "/crm/empresas" },
  { icon: CalendarDays, label: "Atividades", to: "/crm/atividades" },
];

export function Sidebar({ profile, onLogout, isExpanded, setIsExpanded }: SidebarProps) {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const [flyoutItems, setFlyoutItems] = useState<typeof clientesSubItems>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const openFlyout = (e: React.MouseEvent<HTMLAnchorElement>, subItems: typeof clientesSubItems) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyoutTop(rect.top);
    setFlyoutItems(subItems);
    setFlyoutOpen(true);
  };

  const scheduleCloseFlyout = () => {
    closeTimer.current = setTimeout(() => setFlyoutOpen(false), 150);
  };

  const menuItems = {
    admin: [
      { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
      { icon: Briefcase, label: "CRM Comercial", to: "/crm", hasFlyout: true, subItems: crmSubItems },
      { icon: Building2, label: "Clientes", to: "/clientes", hasFlyout: true, subItems: clientesSubItems },
      { icon: BarChart3, label: "Relatórios", to: "/relatorios" },
      { icon: Settings, label: "Configurações", to: "/configuracoes" },
    ],
    super_admin: [
      { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
      { icon: Briefcase, label: "CRM Comercial", to: "/crm", hasFlyout: true, subItems: crmSubItems },
      { icon: Building2, label: "Clientes", to: "/clientes", hasFlyout: true, subItems: clientesSubItems },
      { icon: BarChart3, label: "Relatórios", to: "/relatorios" },
      { icon: Settings, label: "Configurações", to: "/configuracoes" },
    ],
    consultor: [
      { icon: Building2, label: "Clientes", to: "/clientes", hasFlyout: true, subItems: clientesSubItems },
      { icon: Briefcase, label: "CRM Comercial", to: "/crm", hasFlyout: true, subItems: crmSubItems },
      { icon: BarChart3, label: "Meus Relatórios", to: "/relatorios" },
    ],
    cliente: [
      { icon: FileCheck, label: "Meus Resultados", to: "/meu-resultado" },
    ],
  };

  const currentItems = menuItems[profile?.perfil as keyof typeof menuItems] || [];

  const SidebarContent = ({ forceExpanded = false }: { forceExpanded?: boolean }) => {
    const expanded = forceExpanded || isExpanded;
    return (
      <div className="flex flex-col h-full bg-brand-grain text-white">
        <div className={cn("px-4 py-5 flex items-center", expanded ? "justify-start" : "justify-center")}>
          <div className={cn("inline-flex items-center rounded-lg bg-white shadow-sm", expanded ? "px-3 py-2" : "p-1.5")}>
            <Logo compact={!expanded} />
          </div>
        </div>

        <div className="mx-3 mb-4 h-px bg-white/10" />

        {expanded && (
          <div className="px-4 pb-2">
            <span className="label-eyebrow text-[color:var(--brand-accent)]/80">Navegação</span>
          </div>
        )}

        <nav className="flex-1 px-2 space-y-0.5">
          {currentItems.map((item: any) => {
            const isActive = location.pathname === item.to;
            return (
              <div key={item.to}>
                <Link
                  to={item.to}
                  onMouseEnter={item.hasFlyout && !isMobile ? (e) => openFlyout(e, item.subItems ?? []) : undefined}
                  onMouseLeave={item.hasFlyout && !isMobile ? scheduleCloseFlyout : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-sm transition-all group overflow-hidden relative",
                    isActive
                      ? "bg-white/10 text-white border-l-2 border-[color:var(--brand-accent)]"
                      : "text-white/70 hover:bg-white/5 hover:text-white border-l-2 border-transparent"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
                  {expanded && (
                    <span className="font-medium whitespace-nowrap text-[13px] tracking-wide flex-1">
                      {item.label}
                    </span>
                  )}
                  {expanded && item.hasFlyout && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  )}
                </Link>

                {/* Mobile: sub-itens aparecem indentados, sem flyout */}
                {isMobile && item.hasFlyout && (
                  <div className="ml-6 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                    {(item.subItems ?? []).map((sub) => (
                      <Link
                        key={sub.label}
                        to={sub.to}
                        search={sub.search as any}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-white/60 hover:bg-white/5 hover:text-white transition-all text-[12px]"
                      >
                        <sub.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="py-3">
            <div className="h-px bg-white/10 mx-2" />
          </div>

          <Link
            to="/perfil"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-sm transition-all overflow-hidden",
              location.pathname === "/perfil"
                ? "bg-white/10 text-white border-l-2 border-[color:var(--brand-accent)]"
                : "text-white/70 hover:bg-white/5 hover:text-white border-l-2 border-transparent"
            )}
          >
            <UserCircle className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
            {expanded && <span className="font-medium whitespace-nowrap text-[13px]">Perfil</span>}
          </Link>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-white/70 hover:bg-white/5 hover:text-white transition-all border-l-2 border-transparent"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
            {expanded && <span className="font-medium whitespace-nowrap text-[13px]">Sair</span>}
          </button>
        </nav>

        {expanded && profile && (
          <div className="p-4 border-t border-white/10 mt-auto">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-9 w-9 bg-[color:var(--brand-accent)]/25 shrink-0 border border-[color:var(--brand-accent)]/40">
                <AvatarFallback className="text-[11px] font-semibold text-white bg-transparent">
                  {profile.nome?.substring(0, 2).toUpperCase() || profile.email?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold truncate leading-tight text-white">{profile.nome}</span>
                <span className="label-eyebrow text-[9px] text-[color:var(--brand-accent)]/90 truncate mt-1">
                  {profile.perfil}
                </span>
              </div>
            </div>
          </div>
        )}

        {!isMobile && flyoutOpen && (
          <div
            className="fixed z-[60] w-52 rounded-md border border-black/5 bg-white py-1.5 shadow-xl"
            style={{ top: flyoutTop, left: 210 }}
            onMouseEnter={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current);
              setFlyoutOpen(true);
            }}
            onMouseLeave={scheduleCloseFlyout}
          >
            {flyoutItems.map((sub) => (
              <Link
                key={sub.label}
                to={sub.to}
                search={sub.search as any}
                onClick={() => setFlyoutOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-[color:var(--brand-deep)] hover:bg-[color:var(--brand-accent)]/10"
              >
                <sub.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                {sub.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isMobile) {
    return (
      <header className="fixed top-0 left-0 right-0 h-16 bg-brand-grain flex items-center px-4 z-50 border-b border-white/10">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-none w-64 bg-[color:var(--brand-deep)]">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu de Navegação</SheetTitle>
            </SheetHeader>
            <SidebarContent forceExpanded={true} />
          </SheetContent>
        </Sheet>
        <div className="ml-4">
          <div className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 shadow-sm">
            <Logo />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 bg-black/30 z-[45] transition-opacity duration-200 pointer-events-none opacity-0",
            isExpanded && "opacity-100 pointer-events-auto"
          )}
          onClick={() => setIsExpanded(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 transition-[width] duration-200 ease-in-out z-50 overflow-hidden border-r border-white/5 shadow-2xl",
          isExpanded ? "w-[210px]" : "w-[60px]"
        )}
        onMouseEnter={() => !isMobile && setIsExpanded(true)}
        onMouseLeave={() => !isMobile && setIsExpanded(false)}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

