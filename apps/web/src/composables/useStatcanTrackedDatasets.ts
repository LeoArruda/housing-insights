import { useQuery } from "@tanstack/vue-query";
import { fetchStatcanTrackedDatasets } from "../api/statcan-tracked-datasets.ts";

export function useStatcanTrackedDatasetsQuery() {
  return useQuery({
    queryKey: ["statcan-tracked-datasets"] as const,
    queryFn: fetchStatcanTrackedDatasets,
  });
}
