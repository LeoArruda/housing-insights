import { createMiddleware } from "hono/factory";
import type { Env } from "../env.ts";

export type DashboardRole = "operator" | "viewer";

declare module "hono" {
  interface ContextVariableMap {
    dashboardRole: DashboardRole;
  }
}

function authEnabled(env: Env): boolean {
  const op = env.DASHBOARD_OPERATOR_KEY?.trim();
  const vi = env.DASHBOARD_VIEWER_KEY?.trim();
  return Boolean(op || vi);
}

/** When dashboard keys are unset, all routes behave as operator (local dev / tests). */
export function dashboardAuthMiddleware(env: Env) {
  return createMiddleware(async (c, next) => {
    const path = c.req.path;
    if (path === "/health" || path === "/health/ready") {
      await next();
      return;
    }
    if (!authEnabled(env)) {
      c.set("dashboardRole", "operator");
      await next();
      return;
    }
    const auth = c.req.header("Authorization") ?? "";
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    const token = m?.[1]?.trim();
    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const op = env.DASHBOARD_OPERATOR_KEY?.trim();
    const vi = env.DASHBOARD_VIEWER_KEY?.trim();
    if (op && token === op) {
      c.set("dashboardRole", "operator");
      await next();
      return;
    }
    if (vi && token === vi) {
      c.set("dashboardRole", "viewer");
      await next();
      return;
    }
    return c.json({ error: "Unauthorized" }, 401);
  });
}

export function requireOperator() {
  return createMiddleware(async (c, next) => {
    if (c.get("dashboardRole") !== "operator") {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}
