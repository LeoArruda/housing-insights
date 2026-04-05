import { getActivePinia } from "pinia";
import { useAuthStore } from "../stores/auth.ts";

/** Empty string in Vite dev = same-origin `/api` (see vite proxy). Otherwise full base URL, no trailing slash. */
export function apiBase(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (v != null && String(v).trim() !== "") {
    return String(v).replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "";
  }
  return "http://127.0.0.1:3000";
}

export function authHeaders(): HeadersInit {
  const pinia = getActivePinia();
  if (!pinia) return {};
  const t = useAuthStore(pinia).token.trim();
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}

/** Human-readable API target for login hint. */
export function apiBaseDisplay(): string {
  const b = apiBase();
  if (b === "" && typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  if (b === "") {
    return "/api (Vite dev proxy)";
  }
  return b;
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.body = body;
  }
}

function joinUrl(path: string): string {
  const base = apiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base === "") {
    return `/api${p}`;
  }
  return `${base}${p}`;
}

/** Resolves role: schedules 200 → operator; 403 → viewer; 401 → invalid token. */
export async function probeOperatorAccess(token: string): Promise<"operator" | "viewer"> {
  const headers: HeadersInit = {};
  const t = token.trim();
  if (t) {
    (headers as Record<string, string>).Authorization = `Bearer ${t}`;
  }
  const res = await fetch(joinUrl("/statcan/schedules"), { headers });
  if (res.status === 200) return "operator";
  if (res.status === 403) return "viewer";
  if (res.status === 401) {
    throw new ApiHttpError("Invalid or missing API token", 401, null);
  }
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  throw new ApiHttpError(
    `Unexpected response (${res.status})`,
    res.status,
    body,
  );
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const auth = authHeaders() as Record<string, string>;
  if (auth.Authorization) {
    headers.set("Authorization", auth.Authorization);
  }
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(joinUrl(path), { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: text };
    }
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : res.statusText;
    throw new ApiHttpError(msg, res.status, body);
  }
  return body as T;
}
