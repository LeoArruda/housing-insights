/** Subset compatible with global `fetch` for tests and dependency injection. */
export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
