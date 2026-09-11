// AppContext (and anything else that needs the API) imports from HERE,
// never directly from ./mockApi or ./realApi. That keeps the choice of
// backend in exactly one place: if VITE_API_BASE_URL is set, we're talking
// to the real Huddle backend; if it's missing (e.g. running the project
// with no .env file at all), we fall back to the in-memory mock so the app
// still runs for local UI work without a live server.
import * as realApi from "./realApi";
import * as mockApi from "./mockApi";

const usingRealBackend = Boolean(import.meta.env.VITE_API_BASE_URL);

export const api = usingRealBackend ? realApi : mockApi;
export const isUsingRealBackend = usingRealBackend;
