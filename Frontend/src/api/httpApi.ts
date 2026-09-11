import type { HuddleApi, User, Channel, Message } from "./types";
import { ApiError } from "./types";

// Real backend client — talks to the deployed API described in
// ../../API_CONTRACT.md. Base URL comes from an env var so it's never
// hardcoded (see .env.example).
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

// Some backends (esp. a Next.js API route setup) issue a token in the
// response body instead of a session cookie. We support both: cookies
// via `credentials: "include"`, and a bearer token cached locally.
const TOKEN_KEY = "huddle_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError("NO_BASE_URL", "VITE_API_BASE_URL is not set.");
  }
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // 204/empty body (e.g. logout, GET /auth/me when logged out) — treat as null.
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const code = body?.code || `HTTP_${res.status}`;
    const message = body?.message || "Something went wrong. Please try again.";
    throw new ApiError(code, message);
  }
  return body as T;
}

interface AuthResponse extends User {
  token?: string;
}

class HttpApi implements HuddleApi {
  async signup(email: string, password: string): Promise<User> {
    const user = await request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (user.token) setToken(user.token);
    return user;
  }

  async login(email: string, password: string): Promise<User> {
    const user = await request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (user.token) setToken(user.token);
    return user;
  }

  async logout(): Promise<void> {
    try {
      await request<void>("/auth/logout", { method: "POST" });
    } finally {
      setToken(null);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      return await request<User | null>("/auth/me");
    } catch {
      // No session / not logged in — the UI treats this the same as `null`.
      return null;
    }
  }

  async listChannels(): Promise<Channel[]> {
    return request<Channel[]>("/channels");
  }

  async createChannel(name: string): Promise<Channel> {
    return request<Channel>("/channels", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async joinChannel(channelId: string): Promise<Channel> {
    return request<Channel>(`/channels/${channelId}/join`, { method: "POST" });
  }

  async getChannel(channelId: string): Promise<Channel | null> {
    try {
      return await request<Channel>(`/channels/${channelId}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  }

  async listMessages(channelId: string): Promise<Message[]> {
    return request<Message[]>(`/channels/${channelId}/messages`);
  }

  async sendMessage(channelId: string, text: string): Promise<Message> {
    return request<Message>(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  subscribe(): () => void {
    // No push channel yet — pages already poll on an interval, so there's
    // nothing to wire up here until the backend adds real-time updates.
    return () => {};
  }
}

export const httpApi = new HttpApi();
export const isRealApiConfigured = Boolean(BASE_URL);
