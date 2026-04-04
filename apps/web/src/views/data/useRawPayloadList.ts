import { ref } from "vue";
import { apiFetch, ApiHttpError } from "../../api/client.ts";
import type { RawPayloadRow } from "./types.ts";

const DEFAULT_LIMIT = 50;

export function useRawPayloadList() {
  const source = ref("");
  const limit = ref(DEFAULT_LIMIT);
  const offset = ref(0);
  const rows = ref<RawPayloadRow[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      const s = source.value.trim();
      if (s) params.set("source", s);
      params.set("limit", String(limit.value));
      params.set("offset", String(offset.value));
      const res = await apiFetch<{ data: RawPayloadRow[] }>(
        `/raw-payloads?${params.toString()}`,
      );
      rows.value = res.data;
    } catch (e) {
      if (e instanceof ApiHttpError) {
        error.value = e.message;
      } else {
        error.value = "Could not load raw payloads.";
      }
      rows.value = [];
    } finally {
      loading.value = false;
    }
  }

  function applySourceFilter() {
    offset.value = 0;
    return load();
  }

  function goPrev() {
    offset.value = Math.max(0, offset.value - limit.value);
    return load();
  }

  function goNext() {
    offset.value += limit.value;
    return load();
  }

  const canPrev = () => offset.value > 0;
  const canNext = () => rows.value.length >= limit.value;

  return {
    source,
    limit,
    offset,
    rows,
    loading,
    error,
    load,
    applySourceFilter,
    goPrev,
    goNext,
    canPrev,
    canNext,
  };
}
