import { useQuery } from "@tanstack/react-query";
import { getDashboardMetrics } from "@/lib/platform/platformService";

export function usePlatformDashboardMetrics() {
  return useQuery({
    queryKey: ["platform", "dashboard-metrics"],
    queryFn: getDashboardMetrics,
  });
}
