<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  createStatcanTrackedDataset,
  deleteStatcanTrackedDataset,
  patchStatcanTrackedDataset,
  refreshStatcanTrackedDataset,
} from "../../api/statcan-tracked-datasets.ts";
import { searchStatcanCatalog } from "../../api/statcan-schedules.ts";
import type {
  CreateTrackedDatasetBody,
  StatcanTrackedDataset,
  TrackedDownloadChannel,
} from "../../api/statcan-tracked-datasets.ts";
import { useStatcanTrackedDatasetsQuery } from "../../composables/useStatcanTrackedDatasets.ts";
import { buildJobRunsListPath } from "../../composables/useJobRuns.ts";
import { ApiHttpError } from "../../api/client.ts";
import {
  formatApiError,
  truncateText,
  utcScheduleSummary,
} from "../../composables/statcanScheduleHelpers.ts";
import type { StatcanSchedule } from "../../api/statcan-schedules.ts";

const { data: rows, isPending, isError, error } =
  useStatcanTrackedDatasetsQuery();
const queryClient = useQueryClient();

const productId = ref<number | "">("");
const frequency = ref<"daily" | "weekly" | "monthly">("daily");
const hourUtc = ref(6);
const minuteUtc = ref(0);
const dayOfWeek = ref(1);
const dayOfMonth = ref(1);
const downloadChannel = ref<TrackedDownloadChannel>("wds_full_table_csv");
const formError = ref<string | null>(null);
const catalogQ = ref("");
const catalogHits = ref<
  Awaited<ReturnType<typeof searchStatcanCatalog>>["data"]
>([]);
const catalogPending = ref(false);

async function runCatalogSearch(): Promise<void> {
  const q = catalogQ.value.trim();
  if (q.length < 2) {
    catalogHits.value = [];
    return;
  }
  catalogPending.value = true;
  try {
    const res = await searchStatcanCatalog({ q, limit: 15, offset: 0 });
    catalogHits.value = res.data;
  } finally {
    catalogPending.value = false;
  }
}

function pickCatalogProduct(pid: number): void {
  productId.value = pid;
}

function scheduleLikeRow(r: StatcanTrackedDataset): StatcanSchedule {
  return {
    id: r.id,
    product_id: r.product_id,
    cube_title_en: r.cube_title_en,
    cube_title_fr: r.cube_title_fr,
    frequency: r.frequency,
    hour_utc: r.hour_utc,
    minute_utc: r.minute_utc,
    day_of_week: r.day_of_week,
    day_of_month: r.day_of_month,
    latest_n: null,
    data_coordinate: null,
    data_vector_id: null,
    ingest_mode: "latest_n",
    bulk_release_start: null,
    bulk_release_end: null,
    fetch_metadata: true,
    fetch_data: true,
    enabled: r.enabled,
    next_run_at: r.next_run_at,
    last_run_at: r.last_full_download_at,
    last_error: r.last_error,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

const createMut = useMutation({
  mutationFn: (body: CreateTrackedDatasetBody) =>
    createStatcanTrackedDataset(body),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["statcan-tracked-datasets"] });
    formError.value = null;
    productId.value = "";
  },
  onError: (e) => {
    formError.value =
      e instanceof ApiHttpError ? formatApiError(e) : String(e);
  },
});

const deleteMut = useMutation({
  mutationFn: (id: number) => deleteStatcanTrackedDataset(id),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["statcan-tracked-datasets"] });
  },
});

const toggleMut = useMutation({
  mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
    patchStatcanTrackedDataset(id, { enabled }),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["statcan-tracked-datasets"] });
  },
});

const refreshMut = useMutation({
  mutationFn: (id: number) => refreshStatcanTrackedDataset(id),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["statcan-tracked-datasets"] });
  },
});

function submitAdd(): void {
  formError.value = null;
  const pid = Number(productId.value);
  if (!Number.isFinite(pid) || pid <= 0) {
    formError.value = "Enter a valid product ID.";
    return;
  }
  const body: CreateTrackedDatasetBody = {
    product_id: pid,
    frequency: frequency.value,
    hour_utc: hourUtc.value,
    minute_utc: minuteUtc.value,
    download_channel: downloadChannel.value,
    enabled: true,
  };
  if (frequency.value === "weekly") {
    body.day_of_week = dayOfWeek.value;
  }
  if (frequency.value === "monthly") {
    body.day_of_month = dayOfMonth.value;
  }
  createMut.mutate(body);
}

const errorMessage = computed(() => {
  if (!isError.value || error.value == null) return null;
  return error.value instanceof Error
    ? error.value.message
    : String(error.value);
});

function fmtIso(iso: string | null): string {
  if (iso == null || iso === "") return "—";
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

const jobRunsHref = buildJobRunsListPath({
  job_name: "statcan-bulk-tracked-sync",
  limit: 100,
});
</script>

<template>
  <div>
    <div class="head">
      <h1 class="title">StatCan bulk datasets</h1>
      <RouterLink :to="jobRunsHref" class="link-muted">Bulk sync job runs</RouterLink>
    </div>
    <p class="sub">
      Full-table CSV per ProductID, then <code class="mono">getChangedCubeList</code> (UTC
      yesterday) to decide when to re-download. Job:
      <code class="mono">statcan-bulk-tracked-sync</code>.
    </p>

    <div class="card form-card">
      <h2 class="h2">Add tracked dataset</h2>
      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
      <div class="catalog-search">
        <label class="field field-wide">
          <span>Catalog search (optional)</span>
          <div class="catalog-row">
            <input
              v-model="catalogQ"
              type="search"
              class="input"
              placeholder="Title keyword…"
              @keydown.enter.prevent="runCatalogSearch"
            />
            <button
              type="button"
              class="btn-secondary"
              :disabled="catalogPending"
              @click="runCatalogSearch"
            >
              {{ catalogPending ? "…" : "Search" }}
            </button>
          </div>
        </label>
        <ul v-if="catalogHits.length > 0" class="catalog-hits">
          <li v-for="h in catalogHits" :key="h.product_id">
            <button
              type="button"
              class="hit-btn"
              @click="pickCatalogProduct(h.product_id)"
            >
              <span class="mono">{{ h.product_id }}</span>
              {{ truncateText(h.cube_title_en, 80) }}
            </button>
          </li>
        </ul>
      </div>
      <div class="form-grid">
        <label class="field">
          <span>Product ID</span>
          <input
            v-model.number="productId"
            type="number"
            min="1"
            class="input"
            placeholder="e.g. 18100004"
          />
        </label>
        <label class="field">
          <span>Frequency</span>
          <select v-model="frequency" class="input">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label class="field">
          <span>Hour (UTC)</span>
          <input v-model.number="hourUtc" type="number" min="0" max="23" class="input" />
        </label>
        <label class="field">
          <span>Minute (UTC)</span>
          <input
            v-model.number="minuteUtc"
            type="number"
            min="0"
            max="59"
            class="input"
          />
        </label>
        <label v-if="frequency === 'weekly'" class="field">
          <span>Day of week (0=Sun … 6=Sat)</span>
          <input
            v-model.number="dayOfWeek"
            type="number"
            min="0"
            max="6"
            class="input"
          />
        </label>
        <label v-if="frequency === 'monthly'" class="field">
          <span>Day of month</span>
          <input
            v-model.number="dayOfMonth"
            type="number"
            min="1"
            max="31"
            class="input"
          />
        </label>
        <label class="field">
          <span>Download channel</span>
          <select v-model="downloadChannel" class="input">
            <option value="wds_full_table_csv">WDS full table CSV</option>
            <option value="statcan_portal_zip">Portal CSV (ZIP)</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        class="btn-primary"
        :disabled="createMut.isPending.value"
        @click="submitAdd"
      >
        {{ createMut.isPending.value ? "Adding…" : "Add" }}
      </button>
    </div>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="isPending" class="muted">Loading…</p>

    <div v-else-if="rows != null" class="card table-wrap">
      <p v-if="rows.length === 0" class="muted">No tracked datasets yet.</p>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Title (EN)</th>
            <th>Channel</th>
            <th>Status</th>
            <th>UTC schedule</th>
            <th>Next run</th>
            <th>Last download</th>
            <th>Last error</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="mono">{{ r.product_id }}</td>
            <td class="title-cell">{{ truncateText(r.cube_title_en, 48) }}</td>
            <td class="mono muted-sm">{{ r.download_channel }}</td>
            <td>
              <span :class="r.status === 'error' ? 'err' : 'ok'">{{ r.status }}</span>
            </td>
            <td class="mono muted-sm">{{ utcScheduleSummary(scheduleLikeRow(r)) }}</td>
            <td class="mono muted-sm">{{ fmtIso(r.next_run_at) }}</td>
            <td class="mono muted-sm">{{ fmtIso(r.last_full_download_at) }}</td>
            <td class="err-cell" :title="r.last_error ?? ''">{{
              truncateText(r.last_error)
            }}</td>
            <td class="actions">
              <button
                type="button"
                class="btn-sm"
                :disabled="refreshMut.isPending.value"
                @click="refreshMut.mutate(r.id)"
              >
                Refresh
              </button>
              <button
                type="button"
                class="btn-sm"
                :disabled="toggleMut.isPending.value"
                @click="toggleMut.mutate({ id: r.id, enabled: !r.enabled })"
              >
                {{ r.enabled ? "Disable" : "Enable" }}
              </button>
              <button
                type="button"
                class="btn-sm danger"
                :disabled="deleteMut.isPending.value"
                @click="deleteMut.mutate(r.id)"
              >
                Remove
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.link-muted {
  font-size: 0.875rem;
  color: var(--hi-muted);
  text-decoration: none;
}

.link-muted:hover {
  text-decoration: underline;
}

.sub {
  margin: 0.25rem 0 1.25rem;
  color: var(--hi-muted);
  font-size: 0.9rem;
}

.sub .mono {
  font-size: 0.8rem;
}

.h2 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
}

.form-card {
  margin-bottom: 1.25rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--hi-muted);
}

.input {
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--hi-border, #e5e7eb);
  background: var(--hi-surface, #fff);
  font-size: 0.875rem;
}

.btn-primary {
  display: inline-block;
  padding: 0.45rem 0.9rem;
  border-radius: 6px;
  border: none;
  background: var(--hi-accent);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  margin-right: 0.35rem;
  margin-bottom: 0.25rem;
  border-radius: 4px;
  border: 1px solid var(--hi-border, #e5e7eb);
  background: var(--hi-surface, #fff);
  font-size: 0.75rem;
  cursor: pointer;
}

.btn-sm.danger {
  border-color: var(--hi-danger, #b91c1c);
  color: var(--hi-danger, #b91c1c);
}

.error {
  color: var(--hi-danger);
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.table th,
.table td {
  padding: 0.5rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid var(--hi-border, #e5e7eb);
}

.title-cell {
  max-width: 14rem;
}

.err-cell {
  max-width: 10rem;
  font-size: 0.8rem;
  color: var(--hi-danger);
}

.muted-sm {
  font-size: 0.8rem;
  color: var(--hi-muted);
}

.ok {
  color: var(--hi-muted);
}

.err {
  color: var(--hi-danger);
  font-weight: 500;
}

.actions {
  white-space: normal;
  min-width: 8rem;
}

.catalog-search {
  margin-bottom: 0.75rem;
}

.field-wide {
  grid-column: 1 / -1;
}

.catalog-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.catalog-row .input {
  flex: 1;
}

.btn-secondary {
  padding: 0.4rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--hi-border, #e5e7eb);
  background: var(--hi-surface, #fff);
  font-size: 0.8rem;
  cursor: pointer;
}

.catalog-hits {
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
  max-height: 10rem;
  overflow: auto;
  border: 1px solid var(--hi-border, #e5e7eb);
  border-radius: 6px;
}

.hit-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.35rem 0.5rem;
  border: none;
  border-bottom: 1px solid var(--hi-border, #f3f4f6);
  background: transparent;
  font-size: 0.8rem;
  cursor: pointer;
}

.hit-btn:hover {
  background: var(--hi-accent-soft, rgba(59, 130, 246, 0.08));
}

.hit-btn .mono {
  margin-right: 0.35rem;
  font-weight: 600;
}
</style>
