// Single place the app imports the API from. Picks the real backend when
// VITE_API_BASE_URL is set, otherwise falls back to the localStorage mock
// so the app keeps working standalone (e.g. in local dev without a
// running backend).
import { httpApi, isRealApiConfigured } from "./httpApi";
import { api as mockApiInstance } from "./mockApi";
import type { HuddleApi } from "./types";

export const api: HuddleApi = isRealApiConfigured ? httpApi : mockApiInstance;

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.info(
    isRealApiConfigured
      ? "[Huddle] Using real API at " + import.meta.env.VITE_API_BASE_URL
      : "[Huddle] VITE_API_BASE_URL not set — using local mock API."
  );
}
