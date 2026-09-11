import { http } from "./httpClient";
import { normalizeUser, normalizeChannel, normalizeMessage, normalizeAuthResponse } from "./normalize";

// Best-effort local cache of users we've seen (from login, message authors,
// etc.), used by getUserById() below. Standard REST APIs don't always
// expose a public "list all users" endpoint, so this is a pragmatic
// fallback rather than a real user directory -- if the backend DOES have a
// GET /users/:id endpoint, that's the more correct long-term fix.
const knownUsers = new Map();
function remember(user) {
  if (user?.id) knownUsers.set(user.id, user);
  return user;
}

// ---- Auth (Story 1) --------------------------------------------------

export async function signUp(email, password) {
  const raw = await http.post("/auth/signup", { email, password }, { auth: false });
  const { token, user } = normalizeAuthResponse(raw);
  return { token, user: remember(user) };
}

export async function login(email, password) {
  const raw = await http.post("/auth/login", { email, password }, { auth: false });
  const { token, user } = normalizeAuthResponse(raw);
  return { token, user: remember(user) };
}

// ---- Channels (Story 2) ------------------------------------------------

export async function fetchChannels() {
  const raw = await http.get("/channels");
  const rawChannels = Array.isArray(raw) ? raw : raw.channels ?? [];

  // If the backend embeds full member objects (not just ids), that's free
  // name/avatar data for getUserById() -- worth capturing here rather than
  // discarding it, since normalizeChannel only keeps the ids.
  rawChannels.forEach((c) => {
    (c.members ?? []).forEach((m) => {
      if (typeof m === "object") remember(normalizeUser(m));
    });
  });

  return rawChannels.map(normalizeChannel);
}

export async function createChannel(_userId, { name, topic }) {
  const raw = await http.post("/channels", { name, topic });
  return normalizeChannel(raw);
}

export async function joinChannel(channelId, _userId) {
  const raw = await http.post(`/channels/${channelId}/join`, {});
  return normalizeChannel(raw);
}

// ---- Messages (Story 3) -------------------------------------------------

// Fetched per-channel rather than embedded in fetchChannels() -- keeps the
// channel list light, and matches how scrollback/pagination would normally
// work against a real API (see loadMessages in AppContext.jsx).
export async function fetchMessages(channelId) {
  const raw = await http.get(`/channels/${channelId}/messages`);
  const messages = (Array.isArray(raw) ? raw : raw.messages ?? []).map(normalizeMessage);
  messages.forEach((m) => m.author && remember(m.author));
  return messages;
}

export async function sendMessage(channelId, _userId, text) {
  const raw = await http.post(`/channels/${channelId}/messages`, { text });
  const message = normalizeMessage(raw);
  if (message.author) remember(message.author);
  return message;
}

export function getUserById(userId) {
  return knownUsers.get(userId) ?? { id: userId, name: "Unknown" };
}
