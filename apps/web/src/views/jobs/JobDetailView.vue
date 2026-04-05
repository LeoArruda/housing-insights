<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ApiHttpError } from "../../api/client.ts";
import {
  fetchJobRunById,
  type JobRunRow,
} from "../../composables/useJobRuns.ts";
import {
  fetchOperationalLogsList,
  type OperationalLogRow,
} from "../../composables/useOperationalLogs.ts";

const route = useRoute();

const row = ref<JobRunRow | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);
const notFound = ref(false);

const id = computed(() => {
  const raw = route.params.id;
  const n = Number(typeof raw === "string" ? raw : raw?.[0]);
  return Number.isFinite(n) ? n : NaN;
});

const logsQuery = useQuery({
  queryKey: computed(() => ["operation-logs", "job", id.value] as const),
  queryFn: () =>
    fetchOperationalLogsList({
      job_run_id: id.value,
      limit: 100,
      offset: 0,
    }),
  enabled: computed(() => Number.isFinite(id.value)),
});

const logRows = computed<OperationalLogRow[]>(
  () => logsQuery.data.value?.data ?? [],
);
const logsLoading = computed(() => logsQuery.isPending.value);
const logsError = computed(() => {
  if (!logsQuery.isError.value || logsQuery.error.value == null) return null;
  const e = logsQuery.error.value;
  if (e instanceof ApiHttpError) return e.message;
  return e instanceof Error ? e.message : String(e);
});

const metadataDisplay = computed(() => {
  const raw = row.value?.metadata;
  if (raw == null || raw === "") {
    return { kind: "empty" as const };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return {
      kind: "json" as const,
      text: JSON.stringify(parsed, null, 2),
    };
  } catch {
    return { kind: "text" as const, text: raw };
  }
});

async function load() {
  const runId = id.value;
  if (!Number.isFinite(runId)) {
    loadError.value = "Invalid job run id.";
    row.value = null;
    notFound.value = false;
    return;
  }

  loading.value = true;
  loadError.value = null;
  notFound.value = false;
  try {
    row.value = await fetchJobRunById(runId);
  } catch (e) {
    row.value = null;
    if (e instanceof ApiHttpError) {
      if (e.status === 404) {
        notFound.value = true;
        loadError.value = null;
      } else {
        loadError.value = e.message;
      }
    } else {
      loadError.value = "Could not load job run.";
    }
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.params.id,
  () => {
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <p class="back">
      <RouterLink to="/jobs" class="link">← Job runs</RouterLink>
    </p>

    <h1 class="title">
      Job run<span v-if="Number.isFinite(id)"> #{{ id }}</span>
    </h1>

    <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>
    <p v-else-if="notFound" class="muted" role="status">Not found.</p>
    <p v-else-if="loading" class="muted">Loading…</p>

    <div v-else-if="row" class="card">
      <dl class="grid">
        <div>
          <dt>ID</dt>
          <dd>{{ row.id }}</dd>
        </div>
        <div>
          <dt>Job name</dt>
          <dd>{{ row.job_name }}</dd>
        </div>
        <div>
          <dt>Started at</dt>
          <dd class="mono">{{ row.started_at }}</dd>
        </div>
        <div>
          <dt>Finished at</dt>
          <dd class="mono">{{ row.finished_at ?? "—" }}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span class="pill" :class="`pill--${row.status}`">{{
              row.status
            }}</span>
          </dd>
        </div>
        <div class="full">
          <dt>Error message</dt>
          <dd class="err">{{ row.error_message ?? "—" }}</dd>
        </div>
        <div class="full">
          <dt>Metadata</dt>
          <dd>
            <p v-if="metadataDisplay.kind === 'empty'" class="muted">—</p>
            <pre
              v-else
              class="pre"
              :class="{ 'pre--raw': metadataDisplay.kind === 'text' }"
              >{{ metadataDisplay.text }}</pre
            >
          </dd>
        </div>
      </dl>
    </div>

    <div v-if="row && !loading" class="logs-section">
      <h2 class="h2">Related operational logs</h2>
      <p v-if="logsError" class="error" role="alert">{{ logsError }}</p>
      <p v-else-if="logsLoading" class="muted">Loading logs…</p>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Time (UTC)</th>
              <th>Level</th>
              <th>Source</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="logRows.length === 0">
              <td colspan="4" class="muted empty">No log entries for this run.</td>
            </tr>
            <tr v-for="lg in logRows" :key="lg.id">
              <td class="mono">{{ lg.occurred_at }}</td>
              <td>
                <span class="pill" :class="`pill--${lg.level}`">{{
                  lg.level
                }}</span>
              </td>
              <td class="src">{{ lg.source }}</td>
              <td class="msg">{{ lg.message }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="note">
        <RouterLink to="/logs" class="link">Open full log browser</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.back {
  margin: 0 0 0.75rem;
}

.title {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.link {
  color: var(--hi-accent);
  text-decoration: none;
  font-size: 0.9rem;
}

.link:hover {
  text-decoration: underline;
}

.error {
  color: var(--hi-danger);
}

.muted {
  color: var(--hi-muted);
}

.card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  background: var(--hi-card);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem 1.25rem;
  margin: 0;
}

.grid .full {
  grid-column: 1 / -1;
}

.grid dt {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hi-muted);
}

.grid dd {
  margin: 0;
  font-size: 0.95rem;
}

.mono {
  font-variant-numeric: tabular-nums;
}

.err {
  color: var(--hi-danger);
  white-space: pre-wrap;
  word-break: break-word;
}

.pre {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--hi-border);
  background: color-mix(in srgb, var(--hi-border) 35%, var(--hi-card));
  font-size: 0.8rem;
  line-height: 1.45;
  overflow-x: auto;
  max-height: min(50vh, 28rem);
}

.pre--raw {
  white-space: pre-wrap;
  word-break: break-word;
}

.pill {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
  background: var(--hi-border);
  color: var(--hi-muted);
}

.pill--running {
  background: color-mix(in srgb, var(--hi-accent) 22%, transparent);
  color: var(--hi-accent);
}

.pill--success {
  background: color-mix(in srgb, #22c55e 22%, transparent);
  color: #16a34a;
}

.pill--failed {
  background: color-mix(in srgb, var(--hi-danger) 22%, transparent);
  color: var(--hi-danger);
}

.logs-section {
  margin-top: 1.5rem;
}

.h2 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  background: var(--hi-card);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.table th,
.table td {
  padding: 0.5rem 0.65rem;
  text-align: left;
  border-bottom: 1px solid var(--hi-border);
  vertical-align: top;
}

.table th {
  font-weight: 600;
  color: var(--hi-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.table tr:last-child td {
  border-bottom: none;
}

.src {
  max-width: 12rem;
  word-break: break-word;
}

.msg {
  word-break: break-word;
}

.empty {
  padding: 1rem;
  text-align: center;
}

.note {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
}

.pill--debug {
  background: color-mix(in srgb, var(--hi-muted) 35%, transparent);
}

.pill--info {
  background: color-mix(in srgb, var(--hi-accent) 20%, transparent);
  color: var(--hi-accent);
}

.pill--warn {
  background: color-mix(in srgb, #eab308 28%, transparent);
  color: #a16207;
}

.pill--error {
  background: color-mix(in srgb, var(--hi-danger) 25%, transparent);
  color: var(--hi-danger);
}
</style>
