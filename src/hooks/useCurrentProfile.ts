import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentProfile() {
  return useQuery({
    queryKey: ["current-profile"],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (error) throw error;

      return { ...data, userId: session.user.id };
    },
    staleTime: 5 * 60 * 1000,
  });
}
