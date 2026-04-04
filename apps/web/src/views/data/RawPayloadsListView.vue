<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink } from "vue-router";
import { useRawPayloadList } from "./useRawPayloadList.ts";

const {
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
} = useRawPayloadList();

onMounted(() => {
  void load();
});

function onApplyFilter() {
  void applySourceFilter();
}

function onPrev() {
  void goPrev();
}

function onNext() {
  void goNext();
}
</script>

<template>
  <div>
    <h1 class="title">Raw payloads</h1>
    <p class="sub">
      Paginated list from <code>GET /raw-payloads</code>. Source filter uses
      exact match.
    </p>

    <div class="toolbar card">
      <label class="field">
        <span class="label">Source</span>
        <input
          v-model="source"
          type="text"
          class="input"
          placeholder="e.g. statcan"
          autocomplete="off"
          @keydown.enter.prevent="onApplyFilter"
        />
      </label>
      <button type="button" class="btn" :disabled="loading" @click="onApplyFilter">
        Apply filter
      </button>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <p v-else-if="!loading && rows.length === 0" class="muted empty">
      No rows for this filter or page.
    </p>

    <div v-else class="table-wrap card">
      <div v-if="loading" class="loading">Loading…</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Source</th>
            <th>Source key</th>
            <th>Fetched at</th>
            <th>Content type</th>
            <th>Job run</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>
              <RouterLink :to="`/data/${r.id}`" class="link">#{{ r.id }}</RouterLink>
            </td>
            <td>{{ r.source }}</td>
            <td class="mono">{{ r.source_key ?? "—" }}</td>
            <td class="muted-cell">{{ r.fetched_at }}</td>
            <td class="mono small">{{ r.content_type }}</td>
            <td>
              <RouterLink
                v-if="r.job_run_id != null"
                :to="`/jobs/${r.job_run_id}`"
                class="link"
              >
                #{{ r.job_run_id }}
              </RouterLink>
              <span v-else class="muted-cell">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <button
        type="button"
        class="btn btn-ghost"
        :disabled="loading || !canPrev()"
        @click="onPrev"
      >
        Previous
      </button>
      <span class="pager-meta muted">
        Offset {{ offset }} · limit {{ limit }}
      </span>
      <button
        type="button"
        class="btn btn-ghost"
        :disabled="loading || !canNext()"
        @click="onNext"
      >
        Next
      </button>
    </div>
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
  line-height: 1.5;
}

.sub code {
  font-size: 0.85em;
}

.error {
  color: var(--hi-danger);
  margin: 0 0 1rem;
}

.muted {
  color: var(--hi-muted);
}

.empty {
  margin: 1rem 0;
}

.card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  background: var(--hi-card);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: flex-end;
  margin-bottom: 1rem;
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

.input {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  background: var(--hi-input-bg);
  color: var(--hi-fg);
  font-size: 0.9rem;
}

.btn {
  padding: 0.45rem 0.85rem;
  font-size: 0.9rem;
  border-radius: 6px;
  border: 1px solid var(--hi-border);
  background: var(--hi-active-bg);
  color: var(--hi-fg);
  cursor: pointer;
  font-weight: 500;
}

.btn:hover:not(:disabled) {
  background: var(--hi-hover);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-ghost {
  background: transparent;
}

.table-wrap {
  position: relative;
  overflow-x: auto;
  margin-bottom: 1rem;
  padding: 0;
}

.loading {
  padding: 2rem;
  text-align: center;
  color: var(--hi-muted);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.table th,
.table td {
  padding: 0.5rem 0.65rem;
  text-align: left;
  border-bottom: 1px solid var(--hi-border);
  vertical-align: top;
}

.table th {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hi-muted);
  font-weight: 600;
  white-space: nowrap;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  word-break: break-all;
}

.small {
  font-size: 0.75rem;
  max-width: 14rem;
}

.muted-cell {
  color: var(--hi-muted);
  font-size: 0.8rem;
}

.link {
  color: var(--hi-accent);
  text-decoration: none;
  font-weight: 500;
}

.link:hover {
  text-decoration: underline;
}

.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.pager-meta {
  font-size: 0.85rem;
}
</style>
