import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}
export function useAdminPageVisibility() {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState !== "hidden",
    () => false,
  );
}
