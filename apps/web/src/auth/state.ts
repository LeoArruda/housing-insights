import { reactive } from "vue";

export type DashboardRole = "operator" | "viewer";

const STORAGE_KEY = "housing-insights-ops-session";

type StoredSession = {
  token: string;
  role: DashboardRole;
};

export const authState = reactive({
  token: "" as string,
  role: null as DashboardRole | null,
});

export function persistSession(token: string, role: DashboardRole): void {
  authState.token = token;
  authState.role = role;
  const payload: StoredSession = { token, role };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearSession(): void {
  authState.token = "";
  authState.role = null;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function restoreSession(): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const { token, role } = JSON.parse(raw) as StoredSession;
    if (role !== "operator" && role !== "viewer") return;
    authState.token = typeof token === "string" ? token : "";
    authState.role = role;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function authHeaders(): HeadersInit {
  const t = authState.token.trim();
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}
