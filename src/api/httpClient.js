import { getToken } from "./authStorage";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// A request that hangs forever is as bad as one that fails outright -- this
// caps how long we wait before giving up, so the UI can show a clear
// message instead of a spinner that never resolves. Render's free tier can
// take ~50s to wake a sleeping instance, so the timeout is generous.
const TIMEOUT_MS = 60000;

// Every screen-facing API function goes through this one function to reach
// the network. Centralizing it here means: one place sets the auth header,
// one place decides what an "error" looks like, and one place would change
// if we ever needed to (for example) switch from a bearer token to cookies.
async function request(path, { method = "GET", body, auth = true } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("The server is taking too long to respond. It may be waking up — please try again.");
    }
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  // Some endpoints (e.g. a successful DELETE) may return no body at all.
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    // Backends disagree on where the human-readable error lives -- try the
    // common shapes before falling back to something generic, so the
    // person never sees a raw HTTP status code.
    const message = data?.message || data?.error || `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return data;
}

export const http = {
  get: (path) => request(path),
  post: (path, body, options) => request(path, { method: "POST", body, ...options }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
};
