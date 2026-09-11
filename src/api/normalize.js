// The real backend's exact field names weren't confirmed before this was
// wired up (see PROJECT_NOTES.md), so every raw API response is passed
// through one of these functions before it reaches the rest of the app.
// This means: if the backend calls a field `_id` instead of `id`, or
// `username` instead of `name`, exactly ONE function needs a one-line fix
// -- not every screen and component that happens to render a user's name.

export function normalizeUser(raw) {
  if (!raw) return null;
  return {
    id: raw.id ?? raw._id ?? raw.userId,
    name: raw.name ?? raw.username ?? raw.displayName ?? raw.email?.split("@")[0] ?? "Unknown",
    email: raw.email,
  };
}

export function normalizeChannel(raw) {
  return {
    id: raw.id ?? raw._id ?? raw.channelId,
    name: raw.name,
    topic: raw.topic ?? raw.description ?? "",
    memberIds: raw.memberIds ?? raw.members?.map((m) => (typeof m === "string" ? m : m.id ?? m._id)) ?? [],
    // Messages are fetched separately (see api/realApi.js: fetchMessages) --
    // if the backend DOES embed them on the channel object, they'll pass
    // through normalizeMessage below rather than being dropped.
    messages: (raw.messages ?? []).map(normalizeMessage),
  };
}

export function normalizeMessage(raw) {
  return {
    id: raw.id ?? raw._id ?? raw.messageId,
    channelId: raw.channelId ?? raw.channel,
    userId: raw.userId ?? raw.authorId ?? raw.user?.id ?? raw.user?._id ?? raw.sender,
    // Some APIs embed the full author object on each message -- if this one
    // does, we keep it so getUserById() has a real name to show without a
    // separate lookup.
    author: raw.user ? normalizeUser(raw.user) : null,
    text: raw.text ?? raw.content ?? raw.body ?? "",
    ts: raw.ts ?? (raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now()),
    pending: false,
    failed: false,
  };
}

export function normalizeAuthResponse(raw) {
  return {
    token: raw.token ?? raw.accessToken ?? raw.jwt,
    user: normalizeUser(raw.user ?? raw),
  };
}
