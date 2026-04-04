import { createMiddleware } from "hono/factory";

/** When `origin` is set, handles OPTIONS preflight and echoes Allow-* on responses. */
export function corsAllowOriginMiddleware(origin: string) {
  return createMiddleware(async (c, next) => {
    if (c.req.method === "OPTIONS") {
      c.header("Access-Control-Allow-Origin", origin);
      c.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, DELETE, OPTIONS",
      );
      c.header(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      c.header("Access-Control-Max-Age", "86400");
      return c.body(null, 204);
    }
    await next();
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  });
}
