// Shared types for the Huddle API — used by both the mock client (now)
// and the real HTTP client (once the backend engineer has endpoints ready).

export interface User {
  id: string;
  email: string;
}

export interface Channel {
  id: string;
  name: string;
  createdAt: string;
  memberIds: string[];
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  authorEmail: string;
  text: string;
  createdAt: string;
}

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// The contract every implementation (mock or real) must satisfy.
// See Frontend/API_CONTRACT.md for the matching HTTP shape.
export interface HuddleApi {
  signup(email: string, password: string): Promise<User>;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;

  listChannels(): Promise<Channel[]>;
  createChannel(name: string): Promise<Channel>;
  joinChannel(channelId: string): Promise<Channel>;
  getChannel(channelId: string): Promise<Channel | null>;

  listMessages(channelId: string): Promise<Message[]>;
  sendMessage(channelId: string, text: string): Promise<Message>;

  // Lets the UI react when data changes in another browser tab
  // (used to simulate "another user" during local testing/demo).
  subscribe(event: "channels" | "messages", callback: () => void): () => void;
}
