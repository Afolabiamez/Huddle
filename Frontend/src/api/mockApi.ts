import type { HuddleApi, User, Channel, Message } from "./types";
import { ApiError } from "./types";

// --- Fake persistence layer -------------------------------------------
// Uses localStorage so state survives refresh, and so two browser tabs
// can stand in for "two different users" while there's no real backend
// yet (Story 3's acceptance criteria: two people, both see both messages).

const KEYS = {
  users: "huddle_users",
  session: "huddle_session",
  channels: "huddle_channels",
  messages: "huddle_messages",
};

interface StoredUser extends User {
  password: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Seed one default channel so the app isn't empty on first load.
function ensureSeed() {
  const channels = read<Channel[]>(KEYS.channels, []);
  if (channels.length === 0) {
    write<Channel[]>(KEYS.channels, [
      {
        id: uid(),
        name: "general",
        createdAt: new Date().toISOString(),
        memberIds: [],
      },
    ]);
  }
}
ensureSeed();

class MockApi implements HuddleApi {
  async signup(email: string, password: string): Promise<User> {
    const users = read<StoredUser[]>(KEYS.users, []);
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) {
      throw new ApiError("INVALID_INPUT", "Email and password are required.");
    }
    if (users.some((u) => u.email.toLowerCase() === normalized)) {
      throw new ApiError(
        "EMAIL_TAKEN",
        "That email is already registered. Try logging in instead."
      );
    }
    const user: StoredUser = { id: uid(), email: normalized, password };
    users.push(user);
    write(KEYS.users, users);
    const session: User = { id: user.id, email: user.email };
    write(KEYS.session, session);
    return delay(session);
  }

  async login(email: string, password: string): Promise<User> {
    const users = read<StoredUser[]>(KEYS.users, []);
    const normalized = email.trim().toLowerCase();
    const found = users.find((u) => u.email.toLowerCase() === normalized);
    // Deliberately generic error — don't reveal whether email or password
    // was the problem (PRD Story 1 acceptance criteria).
    if (!found || found.password !== password) {
      throw new ApiError(
        "INVALID_CREDENTIALS",
        "That email or password isn't right. Please try again."
      );
    }
    const session: User = { id: found.id, email: found.email };
    write(KEYS.session, session);
    return delay(session);
  }

  async logout(): Promise<void> {
    localStorage.removeItem(KEYS.session);
    return delay(undefined, 100);
  }

  async getCurrentUser(): Promise<User | null> {
    return read<User | null>(KEYS.session, null);
  }

  async listChannels(): Promise<Channel[]> {
    return delay(read<Channel[]>(KEYS.channels, []));
  }

  async createChannel(name: string): Promise<Channel> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ApiError("INVALID_INPUT", "Channel name can't be empty.");
    }
    const channels = read<Channel[]>(KEYS.channels, []);
    if (channels.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new ApiError("CHANNEL_EXISTS", "A channel with that name already exists.");
    }
    const user = await this.getCurrentUser();
    const channel: Channel = {
      id: uid(),
      name: trimmed,
      createdAt: new Date().toISOString(),
      memberIds: user ? [user.id] : [],
    };
    channels.push(channel);
    write(KEYS.channels, channels);
    return delay(channel);
  }

  async joinChannel(channelId: string): Promise<Channel> {
    const channels = read<Channel[]>(KEYS.channels, []);
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) {
      throw new ApiError("NOT_FOUND", "That channel doesn't exist anymore.");
    }
    const user = await this.getCurrentUser();
    if (user && !channel.memberIds.includes(user.id)) {
      channel.memberIds.push(user.id);
      write(KEYS.channels, channels);
    }
    return delay(channel);
  }

  async getChannel(channelId: string): Promise<Channel | null> {
    const channels = read<Channel[]>(KEYS.channels, []);
    return delay(channels.find((c) => c.id === channelId) ?? null);
  }

  async listMessages(channelId: string): Promise<Message[]> {
    const all = read<Message[]>(KEYS.messages, []);
    return delay(
      all
        .filter((m) => m.channelId === channelId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    );
  }

  async sendMessage(channelId: string, text: string): Promise<Message> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new ApiError("INVALID_INPUT", "Message can't be empty.");
    }
    const user = await this.getCurrentUser();
    if (!user) {
      throw new ApiError("NOT_AUTHENTICATED", "You need to be logged in to send a message.");
    }
    const messages = read<Message[]>(KEYS.messages, []);
    const message: Message = {
      id: uid(),
      channelId,
      authorId: user.id,
      authorEmail: user.email,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    messages.push(message);
    write(KEYS.messages, messages);
    return delay(message, 150);
  }

  subscribe(event: "channels" | "messages", callback: () => void): () => void {
    const key = event === "channels" ? KEYS.channels : KEYS.messages;
    // Fires when another browser tab changes the same localStorage key —
    // this is what lets two tabs stand in for "two different users".
    const handler = (e: StorageEvent) => {
      if (e.key === key) callback();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }
}

export const api = new MockApi();
