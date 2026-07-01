import { useEffect, useState } from "react";

import { Cloud, CloudOff, RefreshCw } from "lucide-react";

export function SyncStatus() {

  const [online, setOnline] = useState(navigator.onLine);

  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {

    const handleOnline = () => setOnline(true);

    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);

    window.addEventListener("offline", handleOffline);

    setLastSync(new Date());

    return () => {

      window.removeEventListener("online", handleOnline);

      window.removeEventListener("offline", handleOffline);

    };

  }, []);

  return (

    <div className="flex items-center gap-2 text-xs text-slate-500">

      {online ? (

        <><Cloud className="h-3.5 w-3.5 text-green-500" /><span>Sincronizado{lastSync ? ` às ${lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span></>

      ) : (

        <><CloudOff className="h-3.5 w-3.5 text-red-500" /><span>Offline</span></>

      )}

    </div>

  );

}
