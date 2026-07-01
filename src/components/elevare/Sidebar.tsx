import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  History, 
  BarChart3, 
  Users, 
  Settings, 
  UserCircle, 
  LogOut, 
  FileCheck,
  Menu,
  X
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

export function Sidebar({ profile, onLogout, isExpanded, setIsExpanded }: SidebarProps) {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const menuItems = {
    admin: [
      { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
      { icon: ClipboardCheck, label: "Nova Inspeção", to: "/nova-inspecao" },
      { icon: History, label: "Histórico", to: "/historico" },
      { icon: BarChart3, label: "Relatórios", to: "/relatorios" },
      { icon: Users, label: "Usuários", to: "/admin" },
      { icon: Settings, label: "Configurações", to: "/configuracoes" },
    ],
    consultor: [
      { icon: ClipboardCheck, label: "Nova Inspeção", to: "/nova-inspecao" },
      { icon: History, label: "Histórico", to: "/historico" },
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
      <div className="flex flex-col h-full bg-[#1a4d2e] text-white">
        <div className={cn("p-4 flex items-center mb-6", expanded ? "justify-start" : "justify-center")}>
          <Logo compact={!expanded} />
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {currentItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-all group overflow-hidden relative",
                  isActive 
                    ? "bg-[#2d6a4f] text-white border-l-[3px] border-white" 
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {expanded && <span className="font-medium whitespace-nowrap text-sm">{item.label}</span>}
              </Link>
            );
          })}
          
          <div className="py-2">
            <div className="h-px bg-white/10 mx-2" />
          </div>

          <Link
            to="/perfil"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md transition-all group overflow-hidden relative",
              location.pathname === "/perfil"
                ? "bg-[#2d6a4f] text-white border-l-[3px] border-white" 
                : "text-white/80 hover:bg-white/10 hover:text-white"
            )}
          >
            <UserCircle className="h-5 w-5 shrink-0" />
            {expanded && <span className="font-medium whitespace-nowrap text-sm">Perfil</span>}
          </Link>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-white/80 hover:bg-white/10 hover:text-white transition-all group overflow-hidden"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {expanded && <span className="font-medium whitespace-nowrap text-sm">Sair</span>}
          </button>
        </nav>

        {expanded && profile && (
          <div className="p-4 border-t border-white/10 mt-auto bg-[#1a4d2e]">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-8 w-8 bg-white/20 shrink-0 border border-white/30">
                <AvatarFallback className="text-[10px] text-white bg-transparent">
                  {profile.nome?.substring(0, 2).toUpperCase() || profile.email?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold truncate leading-none text-white">{profile.nome}</span>
                <span className="text-[10px] text-white/60 uppercase tracking-wider truncate mt-1">
                  {profile.perfil}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isMobile) {
    return (
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#1a4d2e] flex items-center px-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-none w-64 bg-[#1a4d2e]">
             <SheetHeader className="sr-only">
               <SheetTitle>Menu de Navegação</SheetTitle>
             </SheetHeader>
            <SidebarContent forceExpanded={true} />
          </SheetContent>
        </Sheet>
        <div className="ml-4">
          <Logo />
        </div>
      </header>
    );
  }

  return (
    <>
      {/* Overlay for mobile/desktop expanded state if needed, though user only asked for mobile specifically */}
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
          "fixed left-0 top-0 bottom-0 bg-[#1a4d2e] transition-[width] duration-200 ease-in-out z-50 overflow-hidden border-r border-white/5 shadow-xl",
          isExpanded ? "w-[220px]" : "w-[64px]"
        )}
        onMouseEnter={() => !isMobile && setIsExpanded(true)}
        onMouseLeave={() => !isMobile && setIsExpanded(false)}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

