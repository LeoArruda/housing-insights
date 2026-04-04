<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { apiFetch, ApiHttpError } from "../../api/client.ts";
import type { RawPayloadRow } from "./types.ts";

const BODY_WARN_THRESHOLD = 50_000;

const route = useRoute();
const row = ref<RawPayloadRow | null>(null);
const loadError = ref<string | null>(null);
const loading = ref(false);
const showFullBody = ref(false);

function contentTypeSuggestsJson(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return (
    ct.includes("application/json") ||
    ct.includes("/json") ||
    ct.includes("+json")
  );
}

function formatBodyDisplay(raw: string, contentType: string): {
  mode: "json" | "text";
  text: string;
} {
  if (contentTypeSuggestsJson(contentType)) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return {
        mode: "json",
        text: JSON.stringify(parsed, null, 2),
      };
    } catch {
      /* fall through */
    }
  }
  return { mode: "text", text: raw };
}

const payloadId = computed(() => {
  const p = route.params.id;
  const n = typeof p === "string" ? Number(p) : Number(p?.[0]);
  return Number.isFinite(n) ? n : NaN;
});

const formatted = computed(() => {
  if (!row.value) return { mode: "text" as const, text: "" };
  return formatBodyDisplay(row.value.body, row.value.content_type);
});

const rawBodyLength = computed(() => row.value?.body.length ?? 0);

const showLargeWarning = computed(
  () => rawBodyLength.value > BODY_WARN_THRESHOLD,
);

const isTruncated = computed(
  () =>
    showLargeWarning.value &&
    !showFullBody.value,
);

const displayBodyText = computed(() => {
  const t = formatted.value.text;
  if (showFullBody.value || !showLargeWarning.value) return t;
  return `${t.slice(0, BODY_WARN_THRESHOLD)}\n\n… ${t.length - BODY_WARN_THRESHOLD} more characters truncated in this view …`;
});

async function loadRow(id: number) {
  loading.value = true;
  loadError.value = null;
  row.value = null;
  try {
    row.value = await apiFetch<RawPayloadRow>(`/raw-payloads/${id}`);
  } catch (e) {
    if (e instanceof ApiHttpError) {
      loadError.value = e.message;
    } else {
      loadError.value = "Could not load raw payload.";
    }
  } finally {
    loading.value = false;
  }
}

watch(
  payloadId,
  (id) => {
    showFullBody.value = false;
    if (!Number.isFinite(id) || id < 1) {
      loadError.value = "Invalid payload id.";
      row.value = null;
      loading.value = false;
      return;
    }
    void loadRow(id);
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <p class="back">
      <RouterLink to="/data" class="link">← Raw payloads</RouterLink>
    </p>

    <h1 class="title">Raw payload</h1>

    <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>

    <p v-else-if="loading" class="muted">Loading…</p>

    <template v-else-if="row">
      <section class="card meta">
        <h2 class="section-title">Metadata</h2>
        <dl class="grid">
          <div>
            <dt>ID</dt>
            <dd>{{ row.id }}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{{ row.source }}</dd>
          </div>
          <div>
            <dt>Source key</dt>
            <dd class="mono">{{ row.source_key ?? "—" }}</dd>
          </div>
          <div>
            <dt>Fetched at</dt>
            <dd class="muted-dd">{{ row.fetched_at }}</dd>
          </div>
          <div>
            <dt>Content type</dt>
            <dd class="mono">{{ row.content_type }}</dd>
          </div>
          <div>
            <dt>SHA-256</dt>
            <dd class="mono sha">{{ row.sha256 }}</dd>
          </div>
          <div>
            <dt>Job run</dt>
            <dd>
              <RouterLink
                v-if="row.job_run_id != null"
                :to="`/jobs/${row.job_run_id}`"
                class="link"
              >
                #{{ row.job_run_id }}
              </RouterLink>
              <span v-else class="muted-dd">—</span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="card body-section">
        <div class="body-head">
          <h2 class="section-title">Body</h2>
          <span v-if="formatted.mode === 'json'" class="badge">JSON</span>
        </div>

        <div v-if="showLargeWarning" class="warn-banner" role="status">
          Raw body is {{ rawBodyLength.toLocaleString() }} characters (over
          {{ BODY_WARN_THRESHOLD.toLocaleString() }}). Showing a truncated
          preview avoids freezing the tab.
          <template v-if="isTruncated">
            Use <strong>Show full</strong> to render the full formatted body (may
            be slow).
          </template>
        </div>

        <div class="body-actions" v-if="showLargeWarning">
          <button
            type="button"
            class="btn"
            @click="showFullBody = !showFullBody"
          >
            {{ showFullBody ? "Show truncated" : "Show full" }}
          </button>
        </div>

        <pre
          v-if="formatted.mode === 'json'"
          class="pre json"
        ><code>{{ displayBodyText }}</code></pre>
        <pre v-else class="pre"><code>{{ displayBodyText }}</code></pre>
      </section>
    </template>
  </div>
</template>

<style scoped>
.back {
  margin: 0 0 0.75rem;
}

.title {
  margin: 0 0 1.25rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.error {
  color: var(--hi-danger);
}

.muted {
  color: var(--hi-muted);
}

.link {
  color: var(--hi-accent);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.9rem;
}

.link:hover {
  text-decoration: underline;
}

.card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  background: var(--hi-card);
  margin-bottom: 1rem;
}

.section-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hi-muted);
}

.meta .grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.85rem 1.25rem;
  margin: 0.85rem 0 0;
}

.meta dt {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--hi-muted);
  margin: 0 0 0.2rem;
}

.meta dd {
  margin: 0;
  font-size: 0.9rem;
  word-break: break-word;
}

.muted-dd {
  color: var(--hi-muted);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
}

.sha {
  word-break: break-all;
}

.body-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
}

.badge {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  background: color-mix(in srgb, var(--hi-accent) 14%, var(--hi-card));
  color: var(--hi-accent);
  border: 1px solid color-mix(in srgb, var(--hi-accent) 28%, var(--hi-border));
}

.warn-banner {
  margin-bottom: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 0.875rem;
  line-height: 1.45;
  border: 1px solid color-mix(in srgb, var(--hi-accent) 35%, var(--hi-border));
  background: color-mix(in srgb, var(--hi-accent) 10%, var(--hi-card));
  color: var(--hi-fg);
}

.body-actions {
  margin-bottom: 0.65rem;
}

.btn {
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  border-radius: 6px;
  border: 1px solid var(--hi-border);
  background: var(--hi-active-bg);
  color: var(--hi-fg);
  cursor: pointer;
  font-weight: 500;
}

.btn:hover {
  background: var(--hi-hover);
}

.pre {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--hi-border);
  background: var(--hi-input-bg);
  overflow: auto;
  max-height: min(70vh, 48rem);
  font-size: 0.8rem;
  line-height: 1.45;
}

.pre code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre;
  word-break: normal;
}

.pre.json code {
  display: block;
}
</style>
