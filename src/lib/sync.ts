import { supabase } from "@/integrations/supabase/client";
import { Inspecao, loadHistorico, HISTORICO_KEY } from "./storage";
import { useSyncStore } from "@/hooks/useSyncStore";

export async function syncFromCloud(silent = false) {
  const setStatus = useSyncStore.getState().setStatus;
  const setLastSync = useSyncStore.getState().setLastSync;

  if (!navigator.onLine) {
    setStatus("offline");
    return;
  }

  setStatus("syncing");

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setStatus("idle");
      return;
    }

    // Get current user profile to check if consultant
    const { data: profile } = await supabase
      .from("profiles")
      .select("perfil")
      .eq("id", session.user.id)
      .single();

    const isConsultant = profile?.perfil === "consultor";

    // If consultant, push any local data that might not be in cloud
    if (isConsultant) {
      const localList = loadHistorico();
      for (const insp of localList) {
        try {
          const cnpj = insp.dados?.estabelecimento?.cnpj || null;
          const cleanCnpj = cnpj ? cnpj.replace(/\D/g, "") : null;

          await supabase.from("inspecoes").upsert({
            id: insp.id,
            consultor_id: session.user.id,
            numero_sequencial: insp.numero_sequencial,
            status: insp.status,
            estabelecimento_nome: insp.estabelecimento,
            cnpj: cleanCnpj,
            data_inicio: insp.dataInicio,
            data_conclusao: insp.dataConclusao,
            progresso: insp.progresso,
            conformidade: insp.conformidade,
            dados: insp.dados as any,
            respostas: insp.respostas as any,
          });
        } catch (err) {
          console.error("Failed to push local inspection to cloud:", err);
        }
      }
    }

    // Fetch all inspections available to this user (Admins see everything, Consultants see theirs)
    const { data, error } = await supabase
      .from("inspecoes")
      .select("*")
      .order("data_inicio", { ascending: false });

    if (error) {
      console.error("Error fetching from Cloud:", error);
      setStatus("error");
      return;
    }

    if (data) {
      const localList = loadHistorico();
      const cloudList: Inspecao[] = data.map((item) => ({
        id: item.id,
        numero_sequencial: item.numero_sequencial,
        status: item.status as any,
        estabelecimento: item.estabelecimento_nome || "",
        dataInicio: item.data_inicio || new Date().toISOString(),
        dataConclusao: item.data_conclusao,
        progresso: Number(item.progresso),
        conformidade: item.conformidade ? Number(item.conformidade) : null,
        dados: item.dados as any,
        respostas: item.respostas as any,
        cloudUpdatedAt: item.updated_at,
      }));

      const mergedMap = new Map<string, Inspecao>();

      // Add local items first
      localList.forEach((item) => mergedMap.set(item.id, item));
      // Overwrite with cloud items (they are more authoritative for shared data)
      cloudList.forEach((item) => mergedMap.set(item.id, item));

      const newList = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.dataInicio).getTime() - new Date(a.dataInicio).getTime(),
      );

      localStorage.setItem(HISTORICO_KEY, JSON.stringify(newList));

      // Cloud rows we just pulled are now authoritative locally, so any conflict
      // previously flagged for them is resolved.
      useSyncStore.getState().clearConflicts(cloudList.map((item) => item.id));

      setStatus("idle");
      setLastSync(new Date());
    }
  } catch (error) {
    console.error("Sync error:", error);
    setStatus("error");
  }
}
