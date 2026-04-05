<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { ApiHttpError } from "../../api/client.ts";
import {
  fetchJobRunsList,
  type JobRunRow,
  type JobRunStatus,
} from "../../composables/useJobRuns.ts";

const MAX_LIMIT = 100;
const INITIAL_LIMIT = 50;

const jobNameInput = ref("");
const jobNameQuery = ref("");
const statusFilter = ref<"" | JobRunStatus>("");
const limit = ref(INITIAL_LIMIT);

const query = useQuery({
  queryKey: computed(
    () =>
      ["job-runs", jobNameQuery.value, statusFilter.value, limit.value] as const,
  ),
  queryFn: () =>
    fetchJobRunsList({
      job_name: jobNameQuery.value || undefined,
      status: statusFilter.value,
      limit: limit.value,
    }),
});

const rows = computed<JobRunRow[]>(() => query.data.value?.data ?? []);
const loading = computed(() => query.isPending.value);
const loadError = computed(() => {
  if (!query.isError.value || query.error.value == null) return null;
  const e = query.error.value;
  if (e instanceof ApiHttpError) return e.message;
  return e instanceof Error ? e.message : String(e);
});

const canLoadMore = computed(() => limit.value < MAX_LIMIT);

function applyJobNameFilter() {
  jobNameQuery.value = jobNameInput.value.trim();
  limit.value = INITIAL_LIMIT;
}

function onStatusChange() {
  limit.value = INITIAL_LIMIT;
}

function loadMore() {
  limit.value = MAX_LIMIT;
}
</script>

<template>
  <div>
    <h1 class="title">Job runs</h1>
    <p class="sub">Filter by job name and status. List uses <code>limit</code> only (no offset).</p>

    <div class="filters">
      <label class="field">
        <span class="label">Job name</span>
        <div class="row">
          <input
            v-model="jobNameInput"
            type="search"
            class="input"
            placeholder="Exact match (optional)"
            @keydown.enter.prevent="applyJobNameFilter"
          />
          <button type="button" class="btn" @click="applyJobNameFilter">
            Apply
          </button>
        </div>
      </label>
      <label class="field">
        <span class="label">Status</span>
        <select
          v-model="statusFilter"
          class="select"
          @change="onStatusChange"
        >
          <option value="">All</option>
          <option value="running">Running</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
      </label>
    </div>

    <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>

    <p v-else-if="loading" class="muted">Loading…</p>

    <template v-else>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Job name</th>
              <th>Started</th>
              <th>Finished</th>
              <th>Status</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="rows.length === 0">
              <td colspan="6" class="muted empty">No runs match.</td>
            </tr>
            <tr v-for="r in rows" :key="r.id">
              <td>
                <RouterLink :to="`/jobs/${r.id}`" class="link">{{
                  r.id
                }}</RouterLink>
              </td>
              <td>
                <RouterLink :to="`/jobs/${r.id}`" class="link">{{
                  r.job_name
                }}</RouterLink>
              </td>
              <td class="mono">{{ r.started_at }}</td>
              <td class="mono">{{ r.finished_at ?? "—" }}</td>
              <td>
                <span class="pill" :class="`pill--${r.status}`">{{
                  r.status
                }}</span>
              </td>
              <td class="err-cell" :title="r.error_message ?? undefined">
                {{
                  r.error_message
                    ? r.error_message.length > 100
                      ? `${r.error_message.slice(0, 100)}…`
                      : r.error_message
                    : "—"
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p class="note">
          Showing up to {{ limit }} most recent runs (newest first). The API
          does not support <code>offset</code>; narrow with filters or open a
          run by ID.
        </p>
        <button
          v-if="canLoadMore && rows.length > 0"
          type="button"
          class="btn btn--secondary"
          @click="loadMore"
        >
          Load more (up to {{ MAX_LIMIT }})
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.title {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.sub {
  margin: 0 0 1.25rem;
  color: var(--hi-muted);
  font-size: 0.9rem;
  max-width: 42rem;
  line-height: 1.45;
}

code {
  font-size: 0.85em;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  margin-bottom: 1.25rem;
  align-items: flex-end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 12rem;
}

.label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hi-muted);
}

.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.input {
  flex: 1;
  min-width: 10rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  background: var(--hi-card);
  color: inherit;
  font-size: 0.9rem;
}

.select {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  background: var(--hi-card);
  color: inherit;
  font-size: 0.9rem;
  min-width: 10rem;
}

.btn {
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  border: 1px solid var(--hi-accent);
  background: var(--hi-accent);
  color: var(--hi-accent-contrast, #fff);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.btn--secondary {
  background: transparent;
  color: var(--hi-accent);
}

.btn:hover {
  filter: brightness(1.05);
}

.error {
  color: var(--hi-danger);
}

.muted {
  color: var(--hi-muted);
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
  font-size: 0.875rem;
}

.table th,
.table td {
  padding: 0.55rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--hi-border);
  vertical-align: top;
}

.table th {
  font-weight: 600;
  color: var(--hi-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.table tr:last-child td {
  border-bottom: none;
}

.mono {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.link {
  color: var(--hi-accent);
  text-decoration: none;
  font-weight: 500;
}

.link:hover {
  text-decoration: underline;
}

.err-cell {
  max-width: 22rem;
  color: var(--hi-danger);
  font-size: 0.8rem;
  word-break: break-word;
}

.empty {
  padding: 1.25rem;
  text-align: center;
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

.footer {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: flex-start;
}

.note {
  margin: 0;
  flex: 1;
  min-width: 14rem;
  font-size: 0.8rem;
  color: var(--hi-muted);
  line-height: 1.45;
}
</style>
