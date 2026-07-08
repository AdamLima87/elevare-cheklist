import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useConsultants(enabled = true) {
  return useQuery({
    queryKey: ["consultants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("perfil", "consultor");
      if (error) throw error;

      const map: Record<string, string> = {};
      data?.forEach((p) => {
        map[p.id] = p.nome;
      });
      return map;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
