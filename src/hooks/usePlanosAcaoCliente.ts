import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checklistSections } from "@/lib/checklist-data";
import type { AcaoCorretiva } from "@/lib/storage";

const itemLookup = new Map<string, { text: string; secao: string }>();
checklistSections.forEach((secao) => {
  secao.items.forEach((item) => {
    itemLookup.set(item.id, { text: item.text, secao: secao.title });
  });
});

export interface PlanoAcaoRow extends AcaoCorretiva {
  itemId: string;
  itemText: string;
  secao: string;
  inspecaoId: string;
  numeroInspecao: number;
  dataConclusao: string | null;
}

export function usePlanosAcaoCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["planos-acao-cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecoes")
        .select("id, numero_sequencial, data_conclusao, dados")
        .eq("cliente_id", clienteId as string)
        .order("data_conclusao", { ascending: false });
      if (error) throw error;

      const rows: PlanoAcaoRow[] = [];
      (data ?? []).forEach((insp: any) => {
        const planoAcao: Record<string, AcaoCorretiva> = insp.dados?.planoAcao ?? {};
        Object.entries(planoAcao).forEach(([itemId, acao]) => {
          const meta = itemLookup.get(itemId);
          rows.push({
            ...acao,
            itemId,
            itemText: meta?.text ?? itemId,
            secao: meta?.secao ?? "",
            inspecaoId: insp.id,
            numeroInspecao: insp.numero_sequencial,
            dataConclusao: insp.data_conclusao,
          });
        });
      });

      rows.sort((a, b) => (a.concluido === b.concluido ? 0 : a.concluido ? 1 : -1));
      return rows;
    },
    enabled: !!clienteId,
  });
}

export function useTogglePlanoAcao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { inspecaoId: string; itemId: string; concluido: boolean; clienteId: string }) => {
      const { data: insp, error: fetchError } = await supabase
        .from("inspecoes")
        .select("dados")
        .eq("id", input.inspecaoId)
        .single();
      if (fetchError) throw fetchError;

      const dados = (insp.dados as any) ?? {};
      const planoAcao: Record<string, AcaoCorretiva> = dados.planoAcao ?? {};
      const atual = planoAcao[input.itemId];
      if (!atual) throw new Error("Plano de ação não encontrado");

      planoAcao[input.itemId] = {
        ...atual,
        concluido: input.concluido,
        dataResolucao: input.concluido ? new Date().toISOString().slice(0, 10) : undefined,
      };

      const { error: updateError } = await supabase
        .from("inspecoes")
        .update({ dados: { ...dados, planoAcao } })
        .eq("id", input.inspecaoId);
      if (updateError) throw updateError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planos-acao-cliente", variables.clienteId] });
    },
  });
}
