<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ApiHttpError } from "../../api/client.ts";
import {
  deleteStatcanSchedule,
  patchStatcanSchedule,
  type PatchScheduleBody,
  type ScheduleFrequency,
  type StatcanSchedule,
} from "../../api/statcan-schedules.ts";
import { useStatcanSchedules } from "../../composables/useStatcanSchedules.ts";
import {
  formatApiError,
  validateWizardAdvanced,
  validateWizardStep2,
} from "../../composables/statcanScheduleHelpers.ts";

const route = useRoute();
const router = useRouter();
const id = computed(() => {
  const raw = route.params.id;
  const n = Number(typeof raw === "string" ? raw : raw?.[0]);
  return Number.isFinite(n) ? n : NaN;
});

const invalidRouteId = computed(() => !Number.isFinite(id.value));

const { loading, error, load, findById } = useStatcanSchedules();

const schedule = computed<StatcanSchedule | undefined>(() => {
  const n = id.value;
  if (!Number.isFinite(n)) return undefined;
  return findById(n);
});

const loadedOnce = ref(false);
const notFound = computed(
  () =>
    loadedOnce.value &&
    !loading.value &&
    !error.value &&
    Number.isFinite(id.value) &&
    schedule.value == null,
);

const patchError = ref<string | null>(null);
const deleteError = ref<string | null>(null);
const saving = ref(false);

const draft = ref<{
  frequency: ScheduleFrequency;
  hour_utc: number;
  minute_utc: number;
  day_of_week: number | null;
  day_of_month: number | null;
  latest_n: number | null;
  data_coordinate: string;
  data_vector_id: string;
  fetch_metadata: boolean;
  fetch_data: boolean;
} | null>(null);

function syncDraftFromSchedule(s: StatcanSchedule) {
  draft.value = {
    frequency: s.frequency,
    hour_utc: s.hour_utc,
    minute_utc: s.minute_utc,
    day_of_week: s.day_of_week,
    day_of_month: s.day_of_month,
    latest_n: s.latest_n,
    data_coordinate: s.data_coordinate ?? "",
    data_vector_id:
      s.data_vector_id != null ? String(s.data_vector_id) : "",
    fetch_metadata: s.fetch_metadata,
    fetch_data: s.fetch_data,
  };
}

watch(
  schedule,
  (s) => {
    if (s) syncDraftFromSchedule(s);
    else draft.value = null;
  },
  { immediate: true },
);

onMounted(async () => {
  if (!invalidRouteId.value) {
    await load();
  }
  loadedOnce.value = true;
});

function normalizedLatestN(v: number | null): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return v;
}

const clientSaveErrors = computed(() => {
  if (!draft.value) return [] as string[];
  const ln = normalizedLatestN(draft.value.latest_n);
  const v2 = validateWizardStep2({
    frequency: draft.value.frequency,
    hour_utc: draft.value.hour_utc,
    minute_utc: draft.value.minute_utc,
    day_of_week: draft.value.day_of_week,
    day_of_month: draft.value.day_of_month,
  });
  const vid =
    draft.value.data_vector_id.trim() === ""
      ? null
      : Number(draft.value.data_vector_id);
  const adv = validateWizardAdvanced({
    latest_n: ln,
    data_vector_id: Number.isFinite(vid) ? vid : null,
  });
  const extra: string[] = [];
  if (draft.value.data_vector_id.trim() !== "" && !Number.isInteger(vid)) {
    extra.push("data_vector_id must be a positive integer when set");
  }
  return [...v2.messages, ...adv.messages, ...extra];
});

async function onToggleEnabled(ev: Event) {
  const s = schedule.value;
  if (!s) return;
  const el = ev.target as HTMLInputElement;
  const next = el.checked;
  patchError.value = null;
  try {
    await patchStatcanSchedule(s.id, { enabled: next });
    await load();
  } catch (e) {
    el.checked = !next;
    if (e instanceof ApiHttpError) {
      patchError.value = formatApiError(e);
    } else {
      patchError.value = "Update failed.";
    }
  }
}

async function saveEdits() {
  const s = schedule.value;
  const d = draft.value;
  if (!s || !d) return;
  patchError.value = null;
  if (clientSaveErrors.value.length) {
    patchError.value = clientSaveErrors.value.join("; ");
    return;
  }
  const vidTrim = d.data_vector_id.trim();
  const body: PatchScheduleBody = {
    frequency: d.frequency,
    hour_utc: d.hour_utc,
    minute_utc: d.minute_utc,
    day_of_week: d.frequency === "weekly" ? d.day_of_week : null,
    day_of_month: d.frequency === "monthly" ? d.day_of_month : null,
    latest_n: normalizedLatestN(d.latest_n),
    data_coordinate: d.data_coordinate.trim() === "" ? null : d.data_coordinate.trim(),
    data_vector_id: vidTrim === "" ? null : Number(vidTrim),
    fetch_metadata: d.fetch_metadata,
    fetch_data: d.fetch_data,
  };
  saving.value = true;
  try {
    await patchStatcanSchedule(s.id, body);
    await load();
  } catch (e) {
    if (e instanceof ApiHttpError) {
      patchError.value = formatApiError(e);
    } else {
      patchError.value = "Update failed.";
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete() {
  const s = schedule.value;
  if (!s) return;
  if (!confirm("Delete this schedule? This cannot be undone.")) return;
  deleteError.value = null;
  try {
    await deleteStatcanSchedule(s.id);
    await router.push("/schedules");
  } catch (e) {
    if (e instanceof ApiHttpError) {
      deleteError.value = formatApiError(e);
      if (e.status === 404) {
        deleteError.value = "Schedule not found (already deleted).";
      }
    } else {
      deleteError.value = "Delete failed.";
    }
  }
}

function fmtIso(iso: string | null): string {
  if (iso == null || iso === "") return "—";
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

const dowOptions = [
  { v: 0, l: "Sunday (0)" },
  { v: 1, l: "Monday (1)" },
  { v: 2, l: "Tuesday (2)" },
  { v: 3, l: "Wednesday (3)" },
  { v: 4, l: "Thursday (4)" },
  { v: 5, l: "Friday (5)" },
  { v: 6, l: "Saturday (6)" },
];
</script>

<template>
  <div>
    <p class="crumb">
      <RouterLink to="/schedules" class="link">← Schedules</RouterLink>
    </p>

    <h1 class="title">Schedule detail</h1>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="invalidRouteId" class="error" role="alert">
      Invalid schedule id.
    </p>
    <p v-else-if="loading && !loadedOnce" class="muted">Loading…</p>
    <p v-else-if="notFound" class="error" role="alert">
      No schedule with this id. It may have been deleted.
    </p>

    <template v-else-if="schedule && draft">
      <div class="toolbar">
        <label class="toggle">
          <input
            type="checkbox"
            :checked="schedule.enabled"
            @change="onToggleEnabled"
          />
          <span>Enabled</span>
        </label>
        <button type="button" class="btn-danger" @click="onDelete">
          Delete schedule
        </button>
      </div>
      <p v-if="patchError" class="error" role="alert">{{ patchError }}</p>
      <p v-if="deleteError" class="error" role="alert">{{ deleteError }}</p>

      <section class="card">
        <h2>Identifiers &amp; timestamps</h2>
        <dl class="grid-dl">
          <dt>id</dt>
          <dd>{{ schedule.id }}</dd>
          <dt>product_id</dt>
          <dd>{{ schedule.product_id }}</dd>
          <dt>created_at</dt>
          <dd class="mono">{{ schedule.created_at }}</dd>
          <dt>updated_at</dt>
          <dd class="mono">{{ schedule.updated_at }}</dd>
          <dt>next_run_at</dt>
          <dd class="mono">{{ fmtIso(schedule.next_run_at) }}</dd>
          <dt>last_run_at</dt>
          <dd class="mono">{{ fmtIso(schedule.last_run_at) }}</dd>
          <dt>last_error</dt>
          <dd class="err-full">{{ schedule.last_error ?? "—" }}</dd>
        </dl>
      </section>

      <section class="card">
        <h2>Edit schedule</h2>
        <p class="hint">
          All times are <strong>UTC</strong>. day_of_week: 0 = Sunday … 6 =
          Saturday.
        </p>
        <div class="form-grid">
          <label class="field">
            <span>Frequency</span>
            <select v-model="draft.frequency" class="input">
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </select>
          </label>
          <label class="field">
            <span>hour_utc (0–23)</span>
            <input
              v-model.number="draft.hour_utc"
              type="number"
              min="0"
              max="23"
              class="input"
            />
          </label>
          <label class="field">
            <span>minute_utc (0–59)</span>
            <input
              v-model.number="draft.minute_utc"
              type="number"
              min="0"
              max="59"
              class="input"
            />
          </label>
          <label v-if="draft.frequency === 'weekly'" class="field">
            <span>day_of_week (UTC)</span>
            <select
              class="input"
              :value="draft.day_of_week ?? ''"
              @change="
                draft.day_of_week =
                  ($event.target as HTMLSelectElement).value === ''
                    ? null
                    : Number(($event.target as HTMLSelectElement).value)
              "
            >
              <option value="">Select…</option>
              <option v-for="o in dowOptions" :key="o.v" :value="o.v">
                {{ o.l }}
              </option>
            </select>
          </label>
          <label v-if="draft.frequency === 'monthly'" class="field">
            <span>day_of_month (1–31)</span>
            <input
              v-model.number="draft.day_of_month"
              type="number"
              min="1"
              max="31"
              class="input"
            />
          </label>
          <label class="field">
            <span>latest_n (1–200, optional)</span>
            <input
              v-model.number="draft.latest_n"
              type="number"
              min="1"
              max="200"
              class="input"
              placeholder="empty = null"
            />
          </label>
          <label class="field wide">
            <span>data_coordinate</span>
            <input v-model="draft.data_coordinate" type="text" class="input" />
          </label>
          <label class="field">
            <span>data_vector_id</span>
            <input
              v-model="draft.data_vector_id"
              type="text"
              class="input"
              placeholder="positive int or empty"
            />
          </label>
          <label class="field check">
            <input v-model="draft.fetch_metadata" type="checkbox" />
            <span>fetch_metadata</span>
          </label>
          <label class="field check">
            <input v-model="draft.fetch_data" type="checkbox" />
            <span>fetch_data</span>
          </label>
        </div>
        <p v-if="clientSaveErrors.length" class="error">
          {{ clientSaveErrors.join("; ") }}
        </p>
        <button
          type="button"
          class="btn-save"
          :disabled="saving"
          @click="saveEdits"
        >
          {{ saving ? "Saving…" : "Save changes" }}
        </button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.crumb {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
}

.title {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.link {
  color: var(--hi-accent);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.muted {
  color: var(--hi-muted);
}

.error {
  color: var(--hi-danger);
  margin: 0.5rem 0;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-danger {
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  border: 1px solid var(--hi-danger);
  border-radius: 6px;
  background: transparent;
  color: var(--hi-danger);
  cursor: pointer;
}

.btn-danger:hover {
  background: var(--hi-hover);
}

.card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  background: var(--hi-card);
  margin-bottom: 1rem;
}

.card h2 {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hi-muted);
}

.hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--hi-muted);
}

.grid-dl {
  display: grid;
  grid-template-columns: 10rem 1fr;
  gap: 0.35rem 1rem;
  margin: 0;
  font-size: 0.9rem;
}

.grid-dl dt {
  margin: 0;
  color: var(--hi-muted);
}

.grid-dl dd {
  margin: 0;
  word-break: break-word;
}

.mono {
  font-variant-numeric: tabular-nums;
}

.err-full {
  color: var(--hi-danger);
  white-space: pre-wrap;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.field.wide {
  grid-column: 1 / -1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}

.field.check {
  flex-direction: row;
  align-items: center;
}

.input {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  background: var(--hi-input-bg);
  color: var(--hi-fg);
  font-size: 0.9rem;
}

.btn-save {
  padding: 0.45rem 1rem;
  font-size: 0.9rem;
  border: none;
  border-radius: 6px;
  background: var(--hi-accent);
  color: #fff;
  cursor: pointer;
  font-weight: 500;
}

.btn-save:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
