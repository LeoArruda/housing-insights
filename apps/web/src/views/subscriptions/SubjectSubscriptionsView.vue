<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { ApiHttpError } from "../../api/client.ts";
import {
  createSubjectSubscription,
  deleteSubjectSubscription,
  fetchSubjectSubscriptions,
  patchSubjectSubscription,
  type SubjectSubscription,
} from "../../api/statcan-subscriptions.ts";
import { formatApiError } from "../../composables/statcanScheduleHelpers.ts";

const rows = ref<SubjectSubscription[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const newCode = ref("");
const newLabel = ref("");
const creating = ref(false);
const createError = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await fetchSubjectSubscriptions();
  } catch (e) {
    rows.value = [];
    if (e instanceof ApiHttpError) {
      error.value = formatApiError(e);
    } else {
      error.value = "Could not load subscriptions.";
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

async function onCreate() {
  createError.value = null;
  const code = newCode.value.trim();
  if (!code) {
    createError.value = "Enter a subject_code.";
    return;
  }
  creating.value = true;
  try {
    await createSubjectSubscription({
      subject_code: code,
      label: newLabel.value.trim() === "" ? null : newLabel.value.trim(),
      enabled: true,
    });
    newCode.value = "";
    newLabel.value = "";
    await load();
  } catch (e) {
    if (e instanceof ApiHttpError) {
      createError.value = formatApiError(e);
    } else {
      createError.value = "Create failed.";
    }
  } finally {
    creating.value = false;
  }
}

async function toggleEnabled(sub: SubjectSubscription, ev: Event) {
  const el = ev.target as HTMLInputElement;
  const next = el.checked;
  try {
    await patchSubjectSubscription(sub.id, { enabled: next });
    await load();
  } catch {
    el.checked = !next;
  }
}

async function onDelete(sub: SubjectSubscription) {
  if (!confirm(`Remove subscription ${sub.subject_code}?`)) return;
  try {
    await deleteSubjectSubscription(sub.id);
    await load();
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div>
    <p class="crumb">
      <RouterLink to="/dashboard" class="link">← Dashboard</RouterLink>
    </p>
    <h1 class="title">Subject subscriptions</h1>
    <p class="sub">
      Global StatCan subject codes: when enabled, the
      <code class="mono">statcan-subject-changed-ingest</code> job pulls cube
      metadata for cubes that changed today and match this subject (via catalog
      <code class="mono">subject_codes</code>).
    </p>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading" class="muted">Loading…</p>

    <section v-else class="card">
      <h2>Add subscription</h2>
      <div class="form-row">
        <label class="field">
          <span>subject_code</span>
          <input v-model="newCode" class="input" type="text" placeholder="e.g. 350102" />
        </label>
        <label class="field">
          <span>label (optional)</span>
          <input v-model="newLabel" class="input" type="text" />
        </label>
        <button
          type="button"
          class="btn-primary"
          :disabled="creating"
          @click="onCreate"
        >
          {{ creating ? "Adding…" : "Add" }}
        </button>
      </div>
      <p v-if="createError" class="error">{{ createError }}</p>
    </section>

    <section v-if="!loading && !error" class="card">
      <h2>Active subscriptions</h2>
      <div v-if="rows.length === 0" class="muted">None yet.</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>subject_code</th>
            <th>label</th>
            <th>enabled</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in rows" :key="s.id">
            <td class="mono">{{ s.subject_code }}</td>
            <td>{{ s.label ?? "—" }}</td>
            <td>
              <input
                type="checkbox"
                :checked="s.enabled"
                @change="toggleEnabled(s, $event)"
              />
            </td>
            <td>
              <button type="button" class="btn-ghost" @click="onDelete(s)">
                Remove
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
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
  max-width: 42rem;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
}

.link {
  color: var(--hi-accent);
  text-decoration: none;
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

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}

.input {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  min-width: 12rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.table th,
.table td {
  padding: 0.5rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid var(--hi-border);
}

.btn-primary {
  padding: 0.45rem 1rem;
  border: none;
  border-radius: 6px;
  background: var(--hi-accent);
  color: #fff;
  cursor: pointer;
}

.btn-ghost {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 0.8rem;
}
</style>
