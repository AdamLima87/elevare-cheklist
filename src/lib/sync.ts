import { supabase } from "@/integrations/supabase/client";
import { Inspecao, loadHistorico, HISTORICO_KEY, pushInspecaoToCloud, type StoredHistoricoItem } from "./storage";
import { useSyncStore } from "@/hooks/useSyncStore";
import type { InspectionContext } from "./inspection-context";

/** Resolve o contexto de um item local para sincronização, nesta ordem
 * estrita — nunca cai em `{kind:"cliente"}` como fallback genérico:
 *
 * 1. Contexto explícito persistido localmente (`_context`, gravado por
 *    `saveToHistorico`/`saveRascunho` desde a introdução de `InspectionContext`).
 * 2. Contexto confirmado pela linha remota já existente (`tipo_execucao`/
 *    `crm_oportunidade_id`), usado como reconciliação quando (1) concorda
 *    ou está ausente.
 * 3. Compatibilidade legada: só quando (1) e (2) concordam em "nenhum
 *    indício de diagnóstico" — nem contexto local, nem linha remota, ou
 *    linha remota com tipo_execucao≠'diagnostico'.
 * 4. Se permanecer ambíguo (item local sem `_context`, sem linha remota, e
 *    portanto sem forma de provar que não é um diagnóstico), não sincroniza
 *    automaticamente — devolve null, e o chamador registra como conflito.
 */
async function resolveSyncContext(
  insp: StoredHistoricoItem,
): Promise<InspectionContext | null> {
  const { data: remote } = await supabase
    .from("inspecoes")
    .select("tipo_execucao, crm_oportunidade_id")
    .eq("id", insp.id)
    .maybeSingle();

  if (insp._context) {
    // Contexto local explícito é a fonte primária. Se a linha remota já
    // existe e diverge de forma incompatível (ex.: remoto diz diagnóstico
    // de outra oportunidade), não decidimos por conta própria — melhor
    // reportar como conflito do que arriscar sobrescrever incorretamente.
    if (
      remote &&
      insp._context.kind === "diagnostico_crm" &&
      remote.tipo_execucao === "diagnostico" &&
      remote.crm_oportunidade_id &&
      remote.crm_oportunidade_id !== insp._context.crmOportunidadeId
    ) {
      return null;
    }
    return insp._context;
  }

  if (remote) {
    if (remote.tipo_execucao === "diagnostico" && remote.crm_oportunidade_id) {
      return { kind: "diagnostico_crm", crmOportunidadeId: remote.crm_oportunidade_id };
    }
    // Linha remota existe e comprovadamente não é diagnóstico — compatibilidade legada.
    return { kind: "cliente" };
  }

  // Sem contexto local, sem linha remota: não há como provar que este item
  // nunca passou por um fluxo de diagnóstico. Item legado (anterior à Fase 4)
  // sem linha remota ainda é o caso normal aqui — mas como não dá pra
  // distinguir com segurança de um diagnóstico offline sem `_context`
  // (nunca deveria acontecer, já que saveToHistorico sempre grava `_context`
  // a partir desta fase), tratamos como ambíguo em vez de assumir.
  return null;
}

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
      .select("perfil, empresa_id")
      .eq("id", session.user.id)
      .single();

    const isConsultant = profile?.perfil === "consultor";

    // If consultant, push any local data that might not be in cloud
    if (isConsultant && profile?.empresa_id) {
      const empresaId = profile.empresa_id;
      const localList = loadHistorico() as StoredHistoricoItem[];
      for (const insp of localList) {
        try {
          const context = await resolveSyncContext(insp);
          if (!context) {
            useSyncStore.getState().addConflict(insp.id);
            continue;
          }
          await pushInspecaoToCloud(insp, context, session, empresaId);
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
