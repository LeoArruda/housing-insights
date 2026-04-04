<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ApiHttpError } from "../../api/client.ts";
import {
  fetchJobRunById,
  type JobRunRow,
} from "../../composables/useJobRuns.ts";

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
</style>
