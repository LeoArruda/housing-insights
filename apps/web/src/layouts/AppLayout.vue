<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useAuth } from "../composables/useAuth.ts";

const route = useRoute();
const { isOperator, logout } = useAuth();

const scheduleActive = computed(() => {
  const n = route.name;
  return (
    n === "schedules" || n === "schedules-new" || n === "schedules-detail"
  );
});

const jobsActive = computed(
  () => route.name === "jobs" || route.name === "jobs-detail",
);

const dataActive = computed(
  () => route.name === "data" || route.name === "data-detail",
);
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">Housing Insights</div>
      <p class="tag">Operations</p>
      <nav class="nav">
        <RouterLink
          to="/dashboard"
          class="nav-link"
          active-class="nav-link-active"
        >
          Dashboard
        </RouterLink>
        <RouterLink
          v-if="isOperator"
          to="/schedules"
          class="nav-link"
          :class="{ 'nav-link-active': scheduleActive }"
        >
          Schedules
        </RouterLink>
        <RouterLink
          to="/jobs"
          class="nav-link"
          :class="{ 'nav-link-active': jobsActive }"
        >
          Job runs
        </RouterLink>
        <RouterLink
          to="/data"
          class="nav-link"
          :class="{ 'nav-link-active': dataActive }"
        >
          Raw data
        </RouterLink>
      </nav>
      <button type="button" class="logout" @click="logout">Sign out</button>
    </aside>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  flex-shrink: 0;
  padding: 1.25rem 1rem;
  border-right: 1px solid var(--hi-border);
  background: var(--hi-sidebar);
}

.brand {
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: -0.02em;
}

.tag {
  margin: 0.15rem 0 1.25rem;
  font-size: 0.75rem;
  color: var(--hi-muted);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-link {
  display: block;
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  color: var(--hi-fg);
  text-decoration: none;
  font-size: 0.9rem;
}

.nav-link:hover {
  background: var(--hi-hover);
}

.nav-link-active {
  background: var(--hi-active-bg);
  font-weight: 500;
}

.logout {
  margin-top: 1.5rem;
  width: 100%;
  padding: 0.45rem 0.6rem;
  font-size: 0.85rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--hi-fg);
}

.logout:hover {
  background: var(--hi-hover);
}

.main {
  flex: 1;
  padding: 1.5rem 2rem;
  overflow: auto;
}
</style>
