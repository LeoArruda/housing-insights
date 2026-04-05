<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Button from "../components/ui/Button.vue";
import { apiBaseDisplay, ApiHttpError } from "../api/client.ts";
import { useAuth } from "../composables/useAuth.ts";

const tokenInput = ref("");
const error = ref<string | null>(null);

const { login, loginPending } = useAuth();
const router = useRouter();
const route = useRoute();

async function onSubmit() {
  error.value = null;
  try {
    await login(tokenInput.value);
    const redirect =
      typeof route.query.redirect === "string" ? route.query.redirect : "/dashboard";
    await router.replace(redirect || "/dashboard");
  } catch (e) {
    if (e instanceof ApiHttpError) {
      error.value = e.message;
    } else if (e instanceof Error) {
      error.value = e.message;
    } else {
      error.value = "Sign-in failed.";
    }
  }
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900"
  >
    <div
      class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]"
    >
      <h1
        class="mb-2 text-xl font-semibold text-gray-900 dark:text-white"
      >
        Operations console
      </h1>
      <p class="mb-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        API:
        <code class="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
          {{ apiBaseDisplay() }}
        </code>
        · Paste the same Bearer secret configured as
        <code class="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">DASHBOARD_OPERATOR_KEY</code>
        or
        <code class="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">DASHBOARD_VIEWER_KEY</code>.
        Leave empty if the API runs without dashboard keys (local dev).
      </p>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <div>
          <label
            class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            for="token"
          >
            API token
          </label>
          <input
            id="token"
            v-model="tokenInput"
            class="shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            type="password"
            autocomplete="current-password"
            placeholder="Bearer token (optional if API auth is off)"
          />
        </div>
        <p
          v-if="error"
          class="text-sm text-error-600 dark:text-error-500"
          role="alert"
        >
          {{ error }}
        </p>
        <Button
          class-name="w-full"
          html-type="submit"
          variant="primary"
          :disabled="loginPending"
        >
          {{ loginPending ? "Signing in…" : "Sign in" }}
        </Button>
      </form>
    </div>
  </div>
</template>
