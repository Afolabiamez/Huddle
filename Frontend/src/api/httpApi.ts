import type { HuddleApi, User, Channel, Message } from "./types";
import { ApiError } from "./types";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

const TOKEN_KEY = "huddle_token";
const ME_KEY = "huddle_me";
const JOINED_KEY = "huddle_joined_channels";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function getCachedMe(): User | null {
  const raw = localStorage.getItem(ME_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

function setCachedMe(user: User | null) {
  if (user) localStorage.setItem(ME_KEY, JSON.stringify(user));
  else localStorage.removeItem(ME_KEY);
}

function getJoinedSet(): Set<string> {
  const raw = localStorage.getItem(JOINED_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

function addJoined(channelId: string) {
  const set = getJoinedSet();
  set.add(channelId);
  localStorage.setItem(JOINED_KEY, JSON.stringify([...set]));
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

// ---- Backend response shapes (real API) ----
interface BackendChannel {
  id: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  createdById: string;
  createdBy?: { id: string; email: string };
  createdAt: string;
  memberCount: number;
}

interface BackendMessage {
  id: string;
  channelId: string;
  senderId: string;
  sender?: { id: string; email: string };
  content: string;
  createdAt: string;
}

// ---- Mappers: backend shape -> frontend shape ----

function mapChannel(c: BackendChannel, me: User | null): Channel {
  const joined = getJoinedSet().has(c.id) || (!!me && c.createdById === me.id);
  // The backend doesn't expose a member list yet, only a count. We can only be
  // sure about our own membership, so we synthesize a memberIds array that's
  // the right length (for display) and includes our own id when we know we're in it.
  const memberIds: string[] = [];
  if (joined && me) memberIds.push(me.id);
  while (memberIds.length < c.memberCount) memberIds.push(`unknown-member-${memberIds.length}`);

  return {
    id: c.id,
    name: c.name,
    createdAt: c.createdAt,
    memberIds,
  };
}

function mapMessage(m: BackendMessage, me: User | null): Message {
  const authorEmail = m.sender?.email ?? (me && m.senderId === me.id ? me.email : m.senderId);
  return {
    id: m.id,
    channelId: m.channelId,
    authorId: m.senderId,
    authorEmail,
    text: m.content,
    createdAt: m.createdAt,
  };
}

class HttpApi implements HuddleApi {
  async signup(email: string, password: string): Promise<User> {
    const user = await request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (user.token) setToken(user.token);
    setCachedMe({ id: user.id, email: user.email });
    return user;
  }

  async login(email: string, password: string): Promise<User> {
    const user = await request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (user.token) setToken(user.token);
    setCachedMe({ id: user.id, email: user.email });
    return user;
  }

  async logout(): Promise<void> {
    try {
      await request<void>("/auth/logout", { method: "POST" });
    } finally {
      setToken(null);
      setCachedMe(null);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await request<User | null>("/auth/me");
      setCachedMe(user);
      return user;
    } catch {
      return null;
    }
  }

  async listChannels(): Promise<Channel[]> {
    const { channels } = await request<{ channels: BackendChannel[]; nextCursor: string | null }>("/channels");
    const me = getCachedMe();
    return channels.map((c) => mapChannel(c, me));
  }

  async createChannel(name: string): Promise<Channel> {
    // Backend only accepts lowercase letters, numbers, hyphens and underscores (2-40 chars).
    if (!/^[a-z0-9-_]{2,40}$/.test(name)) {
      throw new ApiError(
        "INVALID_NAME",
        "Channel names can only use lowercase letters, numbers, hyphens and underscores (2-40 characters).",
      );
    }
    const channel = await request<BackendChannel>("/channels", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    addJoined(channel.id);
    return mapChannel(channel, getCachedMe());
  }

  async joinChannel(channelId: string): Promise<Channel> {
    await request<unknown>(`/channels/${channelId}/join`, { method: "POST" });
    addJoined(channelId);
    const channel = await request<BackendChannel>(`/channels/${channelId}`);
    return mapChannel(channel, getCachedMe());
  }

  async getChannel(channelId: string): Promise<Channel | null> {
    try {
      const channel = await request<BackendChannel>(`/channels/${channelId}`);
      return mapChannel(channel, getCachedMe());
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  }

  async listMessages(channelId: string): Promise<Message[]> {
    const { messages } = await request<{ messages: BackendMessage[]; nextCursor: string | null }>(`/channels/${channelId}/messages`);
    const me = getCachedMe();
    return messages.map((m) => mapMessage(m, me));
  }

  async sendMessage(channelId: string, text: string): Promise<Message> {
    const message = await request<BackendMessage>(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: text }),
    });
    return mapMessage(message, getCachedMe());
  }

  subscribe(): () => void {
    return () => {};
  }
}

export const httpApi = new HttpApi();
export const isRealApiConfigured = Boolean(BASE_URL);
