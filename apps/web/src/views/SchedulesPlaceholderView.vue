<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const headline = computed(() => {
  if (route.name === "schedules-new") return "New schedule";
  if (route.name === "schedules-detail") return `Schedule #${route.params.id}`;
  return "Schedules";
});
</script>

<template>
  <div>
    <h1 class="title">{{ headline }}</h1>
    <p class="muted">
      List, detail, wizard, and edits will ship in the next tasks (US-004–006).
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
</style>
