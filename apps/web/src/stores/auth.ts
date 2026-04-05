import { defineStore } from "pinia";

const STORAGE_KEY = "housing-insights-ops-session";

export type DashboardRole = "operator" | "viewer";

type StoredSession = {
  token: string;
  role: DashboardRole;
};

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: "" as string,
    role: null as DashboardRole | null,
  }),
  getters: {
    isAuthenticated: (s) => s.role != null,
    isOperator: (s) => s.role === "operator",
  },
  actions: {
    restoreFromStorage() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const { token, role } = JSON.parse(raw) as StoredSession;
        if (role !== "operator" && role !== "viewer") return;
        this.token = typeof token === "string" ? token : "";
        this.role = role;
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    },
    setSession(token: string, role: DashboardRole) {
      this.token = token;
      this.role = role;
      const payload: StoredSession = { token, role };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    },
    clearSession() {
      this.token = "";
      this.role = null;
      sessionStorage.removeItem(STORAGE_KEY);
    },
  },
});
