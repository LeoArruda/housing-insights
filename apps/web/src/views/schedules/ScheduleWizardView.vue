<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { onMounted, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { ApiHttpError } from "../../api/client.ts";
import { postStatcanSeriesInfo } from "../../api/statcan-ingest.ts";
import {
  createStatcanSchedule,
  searchStatcanCatalog,
  type CreateScheduleBody,
  type ScheduleFrequency,
  type StatcanCatalogRow,
  type StatcanIngestMode,
} from "../../api/statcan-schedules.ts";
import {
  formatApiError,
  formatUtcTime,
  validateWizardAdvanced,
  validateWizardStep2,
} from "../../composables/statcanScheduleHelpers.ts";
import { useDebouncedCallback } from "../../composables/useDebouncedCallback.ts";

const router = useRouter();
const queryClient = useQueryClient();

const step = ref(1);
const catalogQ = ref("");
const catalogRows = ref<StatcanCatalogRow[]>([]);
const catalogLoading = ref(false);
const catalogError = ref<string | null>(null);
const catalogLimit = 25;

const selectedProductId = ref<number | null>(null);

const frequency = ref<ScheduleFrequency>("daily");
const hourUtc = ref(6);
const minuteUtc = ref(0);
const dayOfWeek = ref<number | null>(null);
const dayOfMonth = ref<number | null>(null);

const ingestMode = ref<StatcanIngestMode>("latest_n");
const bulkReleaseStart = ref("");
const bulkReleaseEnd = ref("");

const latestN = ref<number | null>(null);
const dataCoordinate = ref("");
const dataVectorId = ref("");
const fetchMetadata = ref(true);
const fetchData = ref(true);
const enabled = ref(true);

const seriesInfoJson = ref<string | null>(null);
const seriesInfoLoading = ref(false);
const seriesInfoError = ref<string | null>(null);

const stepError = ref<string | null>(null);
const submitError = ref<string | null>(null);
const submitting = ref(false);

async function runCatalogSearch() {
  catalogLoading.value = true;
  catalogError.value = null;
  try {
    const res = await searchStatcanCatalog({
      q: catalogQ.value,
      limit: catalogLimit,
      offset: 0,
    });
    catalogRows.value = res.data;
  } catch (e) {
    catalogRows.value = [];
    if (e instanceof ApiHttpError) {
      catalogError.value = formatApiError(e);
    } else {
      catalogError.value = "Catalog search failed.";
    }
  } finally {
    catalogLoading.value = false;
  }
}

const { run: debouncedCatalogSearch } = useDebouncedCallback(
  runCatalogSearch,
  300,
);

watch(catalogQ, () => {
  debouncedCatalogSearch();
});

onMounted(() => {
  void runCatalogSearch();
});

async function validateSeries() {
  seriesInfoError.value = null;
  seriesInfoJson.value = null;
  if (selectedProductId.value == null) {
    seriesInfoError.value = "Select a product first (step 1).";
    return;
  }
  const vidTrim = dataVectorId.value.trim();
  const vid = vidTrim === "" ? null : Number(vidTrim);
  if (vidTrim !== "" && !Number.isInteger(vid)) {
    seriesInfoError.value = "data_vector_id must be a positive integer when set.";
    return;
  }
  const coord = dataCoordinate.value.trim();
  if (!coord && vid == null) {
    seriesInfoError.value = "Enter a coordinate or vector id to validate.";
    return;
  }
  seriesInfoLoading.value = true;
  try {
    const body =
      vid != null
        ? { product_id: selectedProductId.value, vector_id: vid }
        : { product_id: selectedProductId.value, coordinate: coord };
    const res = await postStatcanSeriesInfo(body);
    seriesInfoJson.value = JSON.stringify(res.data, null, 2);
  } catch (e) {
    if (e instanceof ApiHttpError) {
      seriesInfoError.value = formatApiError(e);
    } else {
      seriesInfoError.value = "Series info request failed.";
    }
  } finally {
    seriesInfoLoading.value = false;
  }
}

function validateCadence(): string | null {
  const v = validateWizardStep2({
    frequency: frequency.value,
    hour_utc: hourUtc.value,
    minute_utc: minuteUtc.value,
    day_of_week: dayOfWeek.value,
    day_of_month: dayOfMonth.value,
  });
  if (!v.ok) return v.messages.join("; ");
  return null;
}

function validateAll(): string | null {
  const c = validateCadence();
  if (c) return c;
  const vidTrim = dataVectorId.value.trim();
  const vid = vidTrim === "" ? null : Number(vidTrim);
  const ln =
    latestN.value == null || Number.isNaN(latestN.value as number)
      ? null
      : latestN.value;
  if (vidTrim !== "" && !Number.isInteger(vid)) {
    return "data_vector_id must be a positive integer when set";
  }
  const adv = validateWizardAdvanced({
    latest_n: ln,
    data_vector_id: vidTrim === "" ? null : vid,
  });
  if (!adv.ok) return adv.messages.join("; ");
  if (ingestMode.value === "bulk_range") {
    if (vidTrim === "" || !Number.isInteger(vid)) {
      return "bulk_range requires data_vector_id";
    }
    if (!bulkReleaseStart.value.trim() || !bulkReleaseEnd.value.trim()) {
      return "bulk_range requires bulk release start and end (ISO datetimes per WDS)";
    }
  }
  return null;
}

function goNext() {
  stepError.value = null;
  if (step.value === 1) {
    if (selectedProductId.value == null) {
      stepError.value = "Select a product from the catalog.";
      return;
    }
    step.value = 2;
    return;
  }
  if (step.value === 2) {
    step.value = 3;
    return;
  }
  if (step.value === 3) {
    const err = validateCadence();
    if (err) {
      stepError.value = err;
      return;
    }
    step.value = 4;
    return;
  }
  if (step.value === 4) {
    const err = validateAll();
    if (err) {
      stepError.value = err;
      return;
    }
    step.value = 5;
  }
}

function goBack() {
  stepError.value = null;
  if (step.value > 1) step.value -= 1;
}

function buildBody(): CreateScheduleBody {
  const vidTrim = dataVectorId.value.trim();
  const ln =
    latestN.value == null || Number.isNaN(latestN.value as number)
      ? null
      : latestN.value;
  return {
    product_id: selectedProductId.value!,
    frequency: frequency.value,
    hour_utc: hourUtc.value,
    minute_utc: minuteUtc.value,
    day_of_week: frequency.value === "weekly" ? dayOfWeek.value : null,
    day_of_month: frequency.value === "monthly" ? dayOfMonth.value : null,
    latest_n: ln,
    data_coordinate:
      dataCoordinate.value.trim() === "" ? null : dataCoordinate.value.trim(),
    data_vector_id: vidTrim === "" ? null : Number(vidTrim),
    ingest_mode: ingestMode.value,
    bulk_release_start:
      bulkReleaseStart.value.trim() === "" ? null : bulkReleaseStart.value.trim(),
    bulk_release_end:
      bulkReleaseEnd.value.trim() === "" ? null : bulkReleaseEnd.value.trim(),
    fetch_metadata: fetchMetadata.value,
    fetch_data: fetchData.value,
    enabled: enabled.value,
  };
}

async function submitCreate() {
  submitError.value = null;
  const err = validateAll();
  if (err) {
    submitError.value = err;
    return;
  }
  submitting.value = true;
  try {
    const created = await createStatcanSchedule(buildBody());
    await queryClient.invalidateQueries({ queryKey: ["statcan-schedules"] });
    await router.push(`/schedules/${created.id}`);
  } catch (e) {
    if (e instanceof ApiHttpError) {
      if (e.status === 409) {
        submitError.value =
          "A schedule already exists for this product_id. Choose another product or edit the existing schedule.";
      } else {
        submitError.value = formatApiError(e);
      }
    } else {
      submitError.value = "Could not create schedule.";
    }
  } finally {
    submitting.value = false;
  }
}

const selectedRow = ref<StatcanCatalogRow | null>(null);

function selectRow(row: StatcanCatalogRow) {
  selectedProductId.value = row.product_id;
  selectedRow.value = row;
}

const ingestModeHelp: Record<StatcanIngestMode, string> = {
  latest_n: "Rolling latest N periods (default).",
  changed_series: "Only when your series appears in StatCan’s changed-series list for the run.",
  changed_cube: "Only when the cube is listed in changed-cube for that UTC date.",
  bulk_range: "Vector bulk by release-date window (requires vector + bulk release fields).",
  full_table_csv: "Download full table CSV for the product (large).",
  full_table_sdmx: "Download full table SDMX package (binary stored as base64 in raw payloads).",
};
</script>

<template>
  <div>
    <p class="crumb">
      <RouterLink to="/schedules" class="link">← Schedules</RouterLink>
    </p>
    <h1 class="title">New StatCan schedule</h1>
    <p class="sub">Product → series → cadence (UTC) → ingest mode → review.</p>

    <ol class="steps" aria-label="Wizard steps">
      <li :class="{ active: step === 1, done: step > 1 }">1. Catalog</li>
      <li :class="{ active: step === 2, done: step > 2 }">2. Series</li>
      <li :class="{ active: step === 3, done: step > 3 }">3. Cadence</li>
      <li :class="{ active: step === 4, done: step > 4 }">4. Ingest</li>
      <li :class="{ active: step === 5 }">5. Review</li>
    </ol>

    <p v-if="stepError" class="error" role="alert">{{ stepError }}</p>
    <p v-if="submitError" class="error" role="alert">{{ submitError }}</p>

    <!-- Step 1 -->
    <section v-show="step === 1" class="card">
      <h2>Search catalog</h2>
      <label class="field">
        <span>Query (title search or numeric product_id)</span>
        <input
          v-model="catalogQ"
          type="search"
          class="input"
          placeholder="e.g. CPI or 33100234"
          autocomplete="off"
        />
      </label>
      <p v-if="catalogError" class="error">{{ catalogError }}</p>
      <p v-else-if="catalogLoading" class="muted">Searching…</p>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th aria-label="Select" />
              <th>product_id</th>
              <th>Title (EN)</th>
              <th>Archived</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in catalogRows"
              :key="row.product_id"
              :class="{ picked: selectedProductId === row.product_id }"
            >
              <td>
                <button type="button" class="pick" @click="selectRow(row)">
                  Select
                </button>
              </td>
              <td>{{ row.product_id }}</td>
              <td>{{ row.cube_title_en ?? "—" }}</td>
              <td>{{ row.archived ? "Yes" : "No" }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!catalogLoading && catalogRows.length === 0" class="muted">
          No rows. Try another query.
        </p>
      </div>
      <p v-if="selectedProductId != null" class="picked-banner">
        Selected product_id:
        <strong>{{ selectedProductId }}</strong>
        <span v-if="selectedRow?.cube_title_en" class="muted-inline">{{
          selectedRow.cube_title_en
        }}</span>
      </p>
    </section>

    <!-- Step 2 -->
    <section v-show="step === 2" class="card">
      <h2>Series (coordinate or vector)</h2>
      <p class="hint">
        Use WDS metadata to validate: optional
        <strong>data_coordinate</strong> (dot-separated members) or
        <strong>data_vector_id</strong>. Click Validate to fetch series titles
        from StatCan.
      </p>
      <div class="form-grid">
        <label class="field wide">
          <span>data_coordinate</span>
          <input v-model="dataCoordinate" class="input" type="text" />
        </label>
        <label class="field">
          <span>data_vector_id</span>
          <input
            v-model="dataVectorId"
            class="input"
            type="text"
            placeholder="positive integer"
          />
        </label>
      </div>
      <p class="nav-buttons">
        <button
          type="button"
          class="btn-ghost"
          :disabled="seriesInfoLoading"
          @click="validateSeries"
        >
          {{ seriesInfoLoading ? "Validating…" : "Validate series (WDS)" }}
        </button>
      </p>
      <p v-if="seriesInfoError" class="error">{{ seriesInfoError }}</p>
      <pre v-if="seriesInfoJson" class="series-preview">{{ seriesInfoJson }}</pre>
    </section>

    <!-- Step 3 -->
    <section v-show="step === 3" class="card">
      <h2>Cadence (UTC)</h2>
      <p class="hint">
        hour_utc 0–23, minute_utc 0–59. Weekly requires day_of_week (0 = Sunday
        … 6 = Saturday). Monthly requires day_of_month (1–31).
      </p>
      <div class="form-grid">
        <label class="field">
          <span>Frequency</span>
          <select v-model="frequency" class="input">
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
          </select>
        </label>
        <label class="field">
          <span>hour_utc</span>
          <input
            v-model.number="hourUtc"
            class="input"
            type="number"
            min="0"
            max="23"
          />
        </label>
        <label class="field">
          <span>minute_utc</span>
          <input
            v-model.number="minuteUtc"
            class="input"
            type="number"
            min="0"
            max="59"
          />
        </label>
        <label v-if="frequency === 'weekly'" class="field">
          <span>day_of_week</span>
          <select
            class="input"
            :value="dayOfWeek ?? ''"
            @change="
              dayOfWeek =
                ($event.target as HTMLSelectElement).value === ''
                  ? null
                  : Number(($event.target as HTMLSelectElement).value)
            "
          >
            <option value="">Select…</option>
            <option :value="0">Sunday (0)</option>
            <option :value="1">Monday (1)</option>
            <option :value="2">Tuesday (2)</option>
            <option :value="3">Wednesday (3)</option>
            <option :value="4">Thursday (4)</option>
            <option :value="5">Friday (5)</option>
            <option :value="6">Saturday (6)</option>
          </select>
        </label>
        <label v-if="frequency === 'monthly'" class="field">
          <span>day_of_month</span>
          <input
            v-model.number="dayOfMonth"
            class="input"
            type="number"
            min="1"
            max="31"
          />
        </label>
      </div>
    </section>

    <!-- Step 4 -->
    <section v-show="step === 4" class="card">
      <h2>Ingest mode &amp; options</h2>
      <div class="form-grid">
        <label class="field wide">
          <span>ingest_mode</span>
          <select v-model="ingestMode" class="input">
            <option value="latest_n">latest_n</option>
            <option value="changed_series">changed_series</option>
            <option value="changed_cube">changed_cube</option>
            <option value="bulk_range">bulk_range</option>
            <option value="full_table_csv">full_table_csv</option>
            <option value="full_table_sdmx">full_table_sdmx</option>
          </select>
        </label>
        <p class="field wide muted small">{{ ingestModeHelp[ingestMode] }}</p>
        <label v-if="ingestMode === 'bulk_range'" class="field wide">
          <span>bulk_release_start (ISO)</span>
          <input v-model="bulkReleaseStart" class="input" type="text" />
        </label>
        <label v-if="ingestMode === 'bulk_range'" class="field wide">
          <span>bulk_release_end (ISO)</span>
          <input v-model="bulkReleaseEnd" class="input" type="text" />
        </label>
        <label class="field">
          <span>latest_n (1–200)</span>
          <input
            v-model.number="latestN"
            class="input"
            type="number"
            min="1"
            max="200"
            placeholder="empty = null"
          />
        </label>
        <label class="field check">
          <input v-model="fetchMetadata" type="checkbox" />
          <span>fetch_metadata</span>
        </label>
        <label class="field check">
          <input v-model="fetchData" type="checkbox" />
          <span>fetch_data</span>
        </label>
        <label class="field check">
          <input v-model="enabled" type="checkbox" />
          <span>enabled</span>
        </label>
      </div>
    </section>

    <!-- Step 5 -->
    <section v-show="step === 5" class="card">
      <h2>Review</h2>
      <dl class="review">
        <dt>product_id</dt>
        <dd>{{ selectedProductId }}</dd>
        <dt>ingest_mode</dt>
        <dd>{{ ingestMode }}</dd>
        <dt>Frequency / time (UTC)</dt>
        <dd>
          {{ frequency }} · {{ formatUtcTime(hourUtc, minuteUtc) }}
          <template v-if="frequency === 'weekly'">
            · day_of_week {{ dayOfWeek }}</template
          >
          <template v-if="frequency === 'monthly'">
            · day_of_month {{ dayOfMonth }}</template
          >
        </dd>
        <dt>latest_n</dt>
        <dd>{{ latestN ?? "null" }}</dd>
        <dt>data_coordinate</dt>
        <dd>{{ dataCoordinate.trim() || "null" }}</dd>
        <dt>data_vector_id</dt>
        <dd>{{ dataVectorId.trim() || "null" }}</dd>
        <dt v-if="ingestMode === 'bulk_range'">bulk window</dt>
        <dd v-if="ingestMode === 'bulk_range'">
          {{ bulkReleaseStart || "—" }} → {{ bulkReleaseEnd || "—" }}
        </dd>
        <dt>fetch_metadata / fetch_data / enabled</dt>
        <dd>
          {{ fetchMetadata }} / {{ fetchData }} / {{ enabled }}
        </dd>
      </dl>
      <button
        type="button"
        class="btn-primary"
        :disabled="submitting"
        @click="submitCreate"
      >
        {{ submitting ? "Creating…" : "Create schedule" }}
      </button>
    </section>

    <div class="nav-buttons">
      <button
        v-if="step > 1"
        type="button"
        class="btn-ghost"
        @click="goBack"
      >
        Back
      </button>
      <button
        v-if="step < 5"
        type="button"
        class="btn-primary"
        @click="goNext"
      >
        Next
      </button>
    </div>
  </div>
</template>

<style scoped>
.crumb {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
}

.title {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.sub {
  margin: 0 0 1rem;
  color: var(--hi-muted);
  font-size: 0.9rem;
}

.link {
  color: var(--hi-accent);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  font-size: 0.8rem;
  color: var(--hi-muted);
}

.steps li.active {
  color: var(--hi-accent);
  font-weight: 600;
}

.steps li.done {
  color: var(--hi-fg);
}

.error {
  color: var(--hi-danger);
  margin: 0.5rem 0;
}

.muted {
  color: var(--hi-muted);
}

.muted-inline {
  margin-left: 0.5rem;
  color: var(--hi-muted);
  font-size: 0.85rem;
}

.small {
  font-size: 0.8rem;
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

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}

.field.check {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.field.wide {
  grid-column: 1 / -1;
}

.input {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  background: var(--hi-input-bg);
  color: var(--hi-fg);
  font-size: 0.9rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem 1rem;
}

.series-preview {
  margin-top: 0.75rem;
  padding: 0.75rem;
  max-height: 220px;
  overflow: auto;
  font-size: 0.75rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  background: var(--hi-hover);
}

.table-wrap {
  overflow: auto;
  max-height: 320px;
  margin-top: 0.75rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.table th,
.table td {
  padding: 0.45rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid var(--hi-border);
}

.table th {
  background: var(--hi-hover);
  color: var(--hi-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
}

tr.picked {
  background: var(--hi-hover);
}

.pick {
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--hi-border);
  border-radius: 4px;
  background: var(--hi-card);
  cursor: pointer;
  color: var(--hi-fg);
}

.pick:hover {
  border-color: var(--hi-accent);
  color: var(--hi-accent);
}

.picked-banner {
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
}

.review {
  display: grid;
  grid-template-columns: 11rem 1fr;
  gap: 0.35rem 1rem;
  margin: 0 0 1rem;
  font-size: 0.9rem;
}

.review dt {
  margin: 0;
  color: var(--hi-muted);
}

.review dd {
  margin: 0;
}

.nav-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 0.45rem 1rem;
  font-size: 0.9rem;
  border: none;
  border-radius: 6px;
  background: var(--hi-accent);
  color: #fff;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-ghost {
  padding: 0.45rem 1rem;
  font-size: 0.9rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  background: transparent;
  color: var(--hi-fg);
  cursor: pointer;
}

.btn-ghost:hover {
  background: var(--hi-hover);
}
</style>
