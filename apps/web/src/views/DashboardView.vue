<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { apiFetch, ApiHttpError } from "../api/client.ts";

type Summary = {
  window_utc_hours: number;
  job_runs_finished_last_window: { success: number; failed: number };
  job_runs_running_unfinished: number;
  recent_failed_runs: {
    id: number;
    job_name: string;
    finished_at: string | null;
    error_message: string | null;
  }[];
  schedules: {
    total: number;
    enabled: number;
    with_last_error: number;
  };
};

const summary = ref<Summary | null>(null);
const loadError = ref<string | null>(null);

onMounted(async () => {
  loadError.value = null;
  try {
    summary.value = await apiFetch<Summary>("/stats/summary?window=24h");
  } catch (e) {
    if (e instanceof ApiHttpError) {
      loadError.value = e.message;
    } else {
      loadError.value = "Could not load dashboard.";
    }
  }
});
</script>

<template>
  <div>
    <h1 class="title">Dashboard</h1>
    <p class="sub">Last 24h (UTC) job outcomes and schedule health.</p>

    <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>

    <div v-else-if="summary" class="grid">
      <section class="card">
        <h2>Finished in window</h2>
        <dl class="kpi">
          <div>
            <dt>Success</dt>
            <dd>{{ summary.job_runs_finished_last_window.success }}</dd>
          </div>
          <div>
            <dt>Failed</dt>
            <dd>{{ summary.job_runs_finished_last_window.failed }}</dd>
          </div>
          <div>
            <dt>Running</dt>
            <dd>{{ summary.job_runs_running_unfinished }}</dd>
          </div>
        </dl>
      </section>
      <section class="card">
        <h2>Schedules</h2>
        <dl class="kpi">
          <div>
            <dt>Total</dt>
            <dd>{{ summary.schedules.total }}</dd>
          </div>
          <div>
            <dt>Enabled</dt>
            <dd>{{ summary.schedules.enabled }}</dd>
          </div>
          <div>
            <dt>With last_error</dt>
            <dd>{{ summary.schedules.with_last_error }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <section v-if="summary" class="card failures">
      <h2>Recent failed runs</h2>
      <p v-if="summary.recent_failed_runs.length === 0" class="muted">
        None in history.
      </p>
      <ul v-else class="list">
        <li v-for="r in summary.recent_failed_runs" :key="r.id">
          <RouterLink :to="`/jobs/${r.id}`" class="link">
            {{ r.job_name }} · #{{ r.id }}
          </RouterLink>
          <span class="muted">{{ r.finished_at }}</span>
          <span v-if="r.error_message" class="err-snippet">{{
            r.error_message
          }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.title {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.sub {
  margin: 0 0 1.5rem;
  color: var(--hi-muted);
  font-size: 0.9rem;
}

.error {
  color: var(--hi-danger);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  background: var(--hi-card);
}

.card h2 {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hi-muted);
}

.kpi {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}

.kpi dt {
  font-size: 0.75rem;
  color: var(--hi-muted);
  margin: 0;
}

.kpi dd {
  margin: 0.15rem 0 0;
  font-size: 1.35rem;
  font-weight: 600;
}

.failures h2 {
  margin-bottom: 0.5rem;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.list li {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  align-items: baseline;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--hi-border);
  font-size: 0.9rem;
}

.link {
  font-weight: 500;
  color: var(--hi-accent);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.muted {
  color: var(--hi-muted);
  font-size: 0.8rem;
}

.err-snippet {
  flex-basis: 100%;
  font-size: 0.8rem;
  color: var(--hi-danger);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
