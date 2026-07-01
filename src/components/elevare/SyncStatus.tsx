import { useSyncStore } from "@/hooks/useSyncStore";
import { Cloud, CloudOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function SyncStatus() {
  const { status, lastSync } = useSyncStore();

  const getStatusConfig = () => {
    switch (status) {
      case "syncing":
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          text: "Sincronizando...",
          color: "text-blue-500",
          bg: "bg-blue-50",
        };
      case "offline":
        return {
          icon: <CloudOff className="h-3.5 w-3.5" />,
          text: "Modo Offline",
          color: "text-slate-500",
          bg: "bg-slate-50",
        };
      case "error":
        return {
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          text: "Erro ao Sincronizar",
          color: "text-destructive",
          bg: "bg-destructive/10",
        };
      default:
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
          text: lastSync 
            ? `Sincronizado às ${lastSync.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}`
            : "Sincronizado",
          color: "text-success",
          bg: "bg-success/10",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-300",
      config.color,
      config.bg,
      "border-current/10"
    )}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}
