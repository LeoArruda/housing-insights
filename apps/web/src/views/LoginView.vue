<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiBaseDisplay, ApiHttpError } from "../api/client.ts";
import { useAuth } from "../composables/useAuth.ts";

const tokenInput = ref("");
const error = ref<string | null>(null);
const busy = ref(false);

const { login } = useAuth();
const router = useRouter();
const route = useRoute();

async function onSubmit() {
  error.value = null;
  busy.value = true;
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
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="login">
    <div class="card">
      <h1>Operations console</h1>
      <p class="hint">
        API:
        <code>{{ apiBaseDisplay() }}</code>
        · Paste the same Bearer secret configured as
        <code>DASHBOARD_OPERATOR_KEY</code> or
        <code>DASHBOARD_VIEWER_KEY</code>. Leave empty if the API runs without
        dashboard keys (local dev).
      </p>
      <form @submit.prevent="onSubmit">
        <label class="label" for="token">API token</label>
        <input
          id="token"
          v-model="tokenInput"
          class="input"
          type="password"
          autocomplete="current-password"
          placeholder="Bearer token (optional if API auth is off)"
        />
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button type="submit" class="submit" :disabled="busy">
          {{ busy ? "Signing in…" : "Sign in" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.card {
  width: 100%;
  max-width: 420px;
  padding: 1.75rem;
  border: 1px solid var(--hi-border);
  border-radius: 10px;
  background: var(--hi-card);
}

h1 {
  margin: 0 0 0.75rem;
  font-size: 1.35rem;
  font-weight: 600;
}

.hint {
  margin: 0 0 1.25rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--hi-muted);
}

.hint code {
  font-size: 0.75rem;
}

.label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 0.35rem;
}

.input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.65rem;
  font-size: 0.9rem;
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  background: var(--hi-input-bg);
  color: var(--hi-fg);
}

.error {
  margin: 0.65rem 0 0;
  font-size: 0.85rem;
  color: var(--hi-danger);
}

.submit {
  margin-top: 1rem;
  width: 100%;
  padding: 0.55rem 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  background: var(--hi-accent);
  color: #fff;
  cursor: pointer;
}

.submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
