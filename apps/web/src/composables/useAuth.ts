import { computed } from "vue";
import { useRouter } from "vue-router";
import { clearSession, persistSession, authState } from "../auth/state.ts";
import { probeOperatorAccess } from "../api/client.ts";

export function useAuth() {
  const router = useRouter();

  const isAuthenticated = computed(() => authState.role != null);
  const isOperator = computed(() => authState.role === "operator");

  async function login(token: string): Promise<void> {
    const role = await probeOperatorAccess(token);
    persistSession(token, role);
  }

  function logout(): void {
    clearSession();
    void router.push({ name: "login" });
  }

  return {
    authState,
    isAuthenticated,
    isOperator,
    login,
    logout,
  };
}
