import { useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { apiFetch, ApiHttpError } from "../../api/client.ts";
import type { RawPayloadRow } from "./types.ts";

const DEFAULT_LIMIT = 50;

export function useRawPayloadList() {
  const sourceInput = ref("");
  const appliedSource = ref("");
  const limit = ref(DEFAULT_LIMIT);
  const offset = ref(0);

  const query = useQuery({
    queryKey: computed(() =>
      [
        "raw-payloads",
        appliedSource.value,
        limit.value,
        offset.value,
      ] as const,
    ),
    queryFn: async () => {
      const params = new URLSearchParams();
      const s = appliedSource.value.trim();
      if (s) params.set("source", s);
      params.set("limit", String(limit.value));
      params.set("offset", String(offset.value));
      return apiFetch<{ data: RawPayloadRow[] }>(
        `/raw-payloads?${params.toString()}`,
      );
    },
  });

  const rows = computed(() => query.data.value?.data ?? []);

  const errorMessage = computed(() => {
    if (!query.isError.value || query.error.value == null) return null;
    const e = query.error.value;
    if (e instanceof ApiHttpError) return e.message;
    return e instanceof Error ? e.message : String(e);
  });

  function applySourceFilter() {
    appliedSource.value = sourceInput.value.trim();
    offset.value = 0;
  }

  function goPrev() {
    offset.value = Math.max(0, offset.value - limit.value);
  }

  function goNext() {
    offset.value += limit.value;
  }

  function canPrev() {
    return offset.value > 0;
  }

  const canNext = computed(() => rows.value.length >= limit.value);

  return {
    source: sourceInput,
    limit,
    offset,
    rows,
    loading: query.isPending,
    error: errorMessage,
    load: () => query.refetch(),
    applySourceFilter,
    goPrev,
    goNext,
    canPrev,
    canNext,
  };
}
