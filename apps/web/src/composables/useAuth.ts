import { storeToRefs } from "pinia";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import { probeOperatorAccess } from "../api/client.ts";
import { useAuthStore } from "../stores/auth.ts";

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isOperator } = storeToRefs(store);

  const loginPending = ref(false);

  async function login(token: string): Promise<void> {
    loginPending.value = true;
    try {
      const role = await probeOperatorAccess(token);
      store.setSession(token, role);
    } finally {
      loginPending.value = false;
    }
  }

  function logout(): void {
    queryClient.clear();
    store.clearSession();
    void router.push({ name: "login" });
  }

  return {
    login,
    logout,
    loginPending,
    isAuthenticated,
    isOperator,
  };
}
