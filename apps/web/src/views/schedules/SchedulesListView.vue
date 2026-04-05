<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useStatcanSchedulesQuery } from "../../composables/useStatcanSchedules.ts";
import {
  truncateText,
  utcScheduleSummary,
} from "../../composables/statcanScheduleHelpers.ts";

const { data: schedules, isPending, isError, error } = useStatcanSchedulesQuery();

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
</script>

<template>
  <div>
    <div class="head">
      <h1 class="title">StatCan schedules</h1>
      <RouterLink to="/schedules/new" class="btn-primary">New schedule</RouterLink>
    </div>
    <p class="sub">Per-product WDS ingestion cadence (UTC).</p>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="isPending" class="muted">Loading…</p>

    <div v-else-if="schedules != null" class="card table-wrap">
      <p v-if="schedules.length === 0" class="muted">No schedules yet.</p>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Title (EN)</th>
            <th>Frequency</th>
            <th>UTC time</th>
            <th>Enabled</th>
            <th>Next run (UTC)</th>
            <th>Last run (UTC)</th>
            <th>Last error</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in schedules" :key="s.id">
            <td>
              <RouterLink :to="`/schedules/${s.id}`" class="link mono">{{
                s.product_id
              }}</RouterLink>
            </td>
            <td class="title-cell">{{ truncateText(s.cube_title_en, 64) }}</td>
            <td>{{ s.frequency }}</td>
            <td class="mono">{{ utcScheduleSummary(s) }}</td>
            <td>
              <span :class="s.enabled ? 'on' : 'off'">{{
                s.enabled ? "Yes" : "No"
              }}</span>
            </td>
            <td class="mono muted-sm">{{ fmtIso(s.next_run_at) }}</td>
            <td class="mono muted-sm">{{ fmtIso(s.last_run_at) }}</td>
            <td class="err-cell" :title="s.last_error ?? ''">{{
              truncateText(s.last_error)
            }}</td>
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

.sub {
  margin: 0.25rem 0 1.25rem;
  color: var(--hi-muted);
  font-size: 0.9rem;
}

.btn-primary {
  display: inline-block;
  padding: 0.45rem 0.9rem;
  border-radius: 6px;
  background: var(--hi-accent);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
}

.btn-primary:hover {
  filter: brightness(1.06);
}

.error {
  color: var(--hi-danger);
}

.muted {
  color: var(--hi-muted);
}

.muted-sm {
  color: var(--hi-muted);
  font-size: 0.8rem;
}

.card {
  padding: 0;
  border: 1px solid var(--hi-border);
  border-radius: 8px;
  background: var(--hi-card);
  overflow: hidden;
}

.table-wrap {
  padding: 0;
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
  background: var(--hi-hover);
}

.link {
  color: var(--hi-accent);
  font-weight: 500;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.mono {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.on {
  color: var(--hi-fg);
}

.off {
  color: var(--hi-muted);
}

.err-cell {
  max-width: 14rem;
  font-size: 0.8rem;
  color: var(--hi-danger);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-cell {
  max-width: 22rem;
  font-size: 0.85rem;
  line-height: 1.35;
}
</style>
