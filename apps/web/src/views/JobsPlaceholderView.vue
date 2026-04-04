<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const headline = computed(() =>
  route.params.id ? `Job run #${route.params.id}` : "Job runs",
);
</script>

<template>
  <div>
    <h1 class="title">{{ headline }}</h1>
    <p class="muted">
      Filterable list and run detail (US-007) will connect to
      <code>GET /job-runs</code> here.
    </p>
  </div>
</template>

<style scoped>
.title {
  margin: 0 0 0.5rem;
  font-size: 1.35rem;
  font-weight: 600;
}

.muted {
  color: var(--hi-muted);
  max-width: 40rem;
  line-height: 1.5;
}

code {
  font-size: 0.85em;
}
</style>
