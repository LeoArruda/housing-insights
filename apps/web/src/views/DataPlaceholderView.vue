<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const headline = computed(() =>
  route.params.id ? `Raw payload #${route.params.id}` : "Raw payloads",
);
</script>

<template>
  <div>
    <h1 class="title">{{ headline }}</h1>
    <p class="muted">
      List and JSON viewer (US-008) will use
      <code>GET /raw-payloads</code> and
      <code>GET /raw-payloads/:id</code>.
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
