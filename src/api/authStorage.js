const STORAGE_KEY = "huddle_session";

// Stores { token, user } together so a page refresh can restore both the
// auth header AND who's logged in without an extra round-trip -- if this
// turns out to be wrong for the real backend (e.g. it wants a "/me"
// endpoint to re-fetch the user), only this file and AppContext's restore
// logic need to change.
export function saveSession(token, user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

export function getSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null; // corrupted/old data shouldn't crash the app on load
  }
}

export function getToken() {
  return getSession()?.token ?? null;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}
