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

const subscriptionsActive = computed(() => route.name === "subscriptions");

const jobsActive = computed(
  () => route.name === "jobs" || route.name === "jobs-detail",
);

const dataActive = computed(
  () => route.name === "data" || route.name === "data-detail",
);

const logsActive = computed(() => route.name === "logs");

function navItemClass(active: boolean) {
  return active
    ? "menu-item menu-item-active rounded-lg px-3 py-2"
    : "menu-item menu-item-inactive rounded-lg px-3 py-2";
}
</script>

<template>
  <div
    class="flex min-h-screen bg-gray-50 font-outfit dark:bg-gray-900"
  >
    <aside
      class="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white px-4 py-6 dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="text-lg font-semibold text-gray-900 dark:text-white">
        Housing Insights
      </div>
      <p
        class="mb-6 mt-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
      >
        Operations
      </p>
      <nav class="flex flex-col gap-1">
        <RouterLink
          to="/dashboard"
          :class="navItemClass(route.name === 'dashboard')"
        >
          Dashboard
        </RouterLink>
        <RouterLink
          v-if="isOperator"
          to="/schedules"
          :class="navItemClass(scheduleActive)"
        >
          Schedules
        </RouterLink>
        <RouterLink
          v-if="isOperator"
          to="/subscriptions"
          :class="navItemClass(subscriptionsActive)"
        >
          Subject feeds
        </RouterLink>
        <RouterLink
          to="/jobs"
          :class="navItemClass(jobsActive)"
        >
          Job runs
        </RouterLink>
        <RouterLink
          to="/logs"
          :class="navItemClass(logsActive)"
        >
          Logs
        </RouterLink>
        <RouterLink
          to="/data"
          :class="navItemClass(dataActive)"
        >
          Raw data
        </RouterLink>
      </nav>
      <button
        type="button"
        class="menu-item menu-item-inactive mt-8 w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm dark:border-gray-700"
        @click="logout"
      >
        Sign out
      </button>
    </aside>
    <main class="flex-1 overflow-auto p-4 md:p-6">
      <RouterView />
    </main>
  </div>
</template>
