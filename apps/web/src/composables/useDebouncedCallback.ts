import { onUnmounted } from "vue";

/** Returns a debounced wrapper; cancels pending call on unmount. */
export function useDebouncedCallback(
  fn: () => void | Promise<void>,
  delayMs: number,
): { run: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel() {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function run() {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      void fn();
    }, delayMs);
  }

  onUnmounted(cancel);
  return { run, cancel };
}
