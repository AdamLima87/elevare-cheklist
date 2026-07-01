import { useState, useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, ClipboardCheck, History, BarChart2, Users, Settings, User, LogOut, FileCheck } from "lucide-react";

const adminMenu = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/nova-inspecao", icon: ClipboardCheck, label: "Nova Inspeção" },
  { to: "/historico", icon: History, label: "Histórico" },
  { to: "/relatorios", icon: BarChart2, label: "Relatórios" },
  { to: "/admin", icon: Users, label: "Usuários" },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
];

const consultorMenu = [
  { to: "/nova-inspecao", icon: ClipboardCheck, label: "Nova Inspeção" },
  { to: "/historico", icon: History, label: "Histórico" },
  { to: "/relatorios", icon: BarChart2, label: "Meus Relatórios" },
];

const clienteMenu = [
  { to: "/meu-resultado", icon: FileCheck, label: "Meus Resultados" },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();
  const currentPath = router.state.location.pathname;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase.from("profiles").select("*").eq("id", session.user.id).single()
          .then(({ data }) => setProfile(data));
      }
    });
  }, []);

  const menu = profile?.perfil === "admin" ? adminMenu : profile?.perfil === "consultor" ? consultorMenu : clienteMenu;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`fixed left-0 top-0 h-full z-40 flex flex-col bg-[#1a4d2e] transition-all duration-200 ${expanded ? "w-56" : "w-16"}`}
    >
      <div className="flex items-center gap-3 p-4 border-b border-white/10 h-16">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">E</span>
        </div>
        {expanded && <span className="text-white font-bold text-sm whitespace-nowrap">Elevare</span>}
      </div>

      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {menu.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors ${
              currentPath === to
                ? "bg-white/20 text-white border-l-2 border-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {expanded && <span className="text-sm whitespace-nowrap">{label}</span>}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 p-2 flex flex-col gap-1">
        <Link to="/perfil" className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors">
          <User className="w-5 h-5 flex-shrink-0" />
          {expanded && (
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{profile?.nome || "Perfil"}</p>
              <p className="text-[10px] text-white/50 capitalize">{profile?.perfil}</p>
            </div>
          )}
        </Link>
        <button onClick={handleLogout} className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors w-full">
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {expanded && <span className="text-sm whitespace-nowrap">Sair</span>}
        </button>
      </div>
    </aside>
  );
}
