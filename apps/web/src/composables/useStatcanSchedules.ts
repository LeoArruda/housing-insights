import { useQuery } from "@tanstack/vue-query";
import { fetchStatcanSchedules } from "../api/statcan-schedules.ts";

export function useStatcanSchedulesQuery() {
  return useQuery({
    queryKey: ["statcan-schedules"] as const,
    queryFn: fetchStatcanSchedules,
  });
}
