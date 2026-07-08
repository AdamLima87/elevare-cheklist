import { useSyncStore } from "@/hooks/useSyncStore";
import { syncFromCloud } from "@/lib/sync";
import {
  Cloud,
  CloudOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SyncStatus() {
  const { status, lastSync, conflicts } = useSyncStore();

  const getStatusConfig = () => {
    switch (status) {
      case "syncing":
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          text: "Sincronizando...",
          color: "text-blue-500",
          bg: "bg-blue-50",
          showRetry: false,
        };
      case "offline":
        return {
          icon: <CloudOff className="h-3.5 w-3.5" />,
          text: "Modo Offline",
          color: "text-slate-500",
          bg: "bg-slate-50",
          showRetry: false,
        };
      case "error":
        return {
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          text: "Erro ao Sincronizar",
          color: "text-destructive",
          bg: "bg-destructive/10",
          showRetry: true,
        };
      default:
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
          text: lastSync
            ? `Sincronizado às ${lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            : "Sincronizado",
          color: "text-success",
          bg: "bg-success/10",
          showRetry: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={cn(
          "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-300",
          config.color,
          config.bg,
          "border-current/10",
        )}
      >
        {config.icon}
        <span>{config.text}</span>
      </div>

      {config.showRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] gap-1"
          onClick={() => syncFromCloud(false)}
        >
          <RefreshCw className="h-3 w-3" />
          Tentar novamente
        </Button>
      )}

      {conflicts.length > 0 && (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200"
          title="Uma edição local pode ter sido substituída pela versão mais recente da nuvem."
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            {conflicts.length} conflito{conflicts.length > 1 ? "s" : ""} detectado
            {conflicts.length > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
