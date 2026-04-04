import { ref } from "vue";
import {
  fetchStatcanSchedules,
  type StatcanSchedule,
} from "../api/statcan-schedules.ts";
import { ApiHttpError } from "../api/client.ts";

export function useStatcanSchedules() {
  const schedules = ref<StatcanSchedule[] | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      schedules.value = await fetchStatcanSchedules();
    } catch (e) {
      schedules.value = null;
      if (e instanceof ApiHttpError) {
        error.value = e.message;
      } else {
        error.value = "Could not load schedules.";
      }
    } finally {
      loading.value = false;
    }
  }

  function findById(id: number): StatcanSchedule | undefined {
    return schedules.value?.find((s) => s.id === id);
  }

  return { schedules, loading, error, load, findById };
}
