import type { Database } from "bun:sqlite";
import { createMiddleware } from "hono/factory";
import { appendOperationalLog } from "../logging/operational.ts";
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

export type DashboardAuthOptions = {
  db?: Database;
};

/** When dashboard keys are unset, all routes behave as operator (local dev / tests). */
export function dashboardAuthMiddleware(env: Env, options?: DashboardAuthOptions) {
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
      appendOperationalLog(options?.db, env, {
        source: "api",
        level: "warn",
        message: "Unauthorized: missing bearer token",
        detail: { path, method: c.req.method },
      });
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
    appendOperationalLog(options?.db, env, {
      source: "api",
      level: "warn",
      message: "Unauthorized: invalid token",
      detail: { path, method: c.req.method },
    });
    return c.json({ error: "Unauthorized" }, 401);
  });
}

export type RequireOperatorOptions = DashboardAuthOptions & { env: Env };

export function requireOperator(options?: RequireOperatorOptions) {
  return createMiddleware(async (c, next) => {
    if (c.get("dashboardRole") !== "operator") {
      if (options?.db && options?.env) {
        appendOperationalLog(options.db, options.env, {
          source: "api",
          level: "warn",
          message: "Forbidden: operator role required",
          detail: { path: c.req.path, method: c.req.method },
        });
      }
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}
