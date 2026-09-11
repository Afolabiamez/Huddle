import { seedUsers, seedChannels } from "../data/seedData";
import { nextId } from "../utils/helpers";

// Module-level "database". In a real app this data would live on a server;
// here it just lives in memory for as long as the browser tab is open.
// IMPORTANT: nothing outside this file should reach into these arrays
// directly -- every read or write goes through an exported function below,
// exactly like it would have to go through an HTTP endpoint in production.
let users = [...seedUsers];
let channels = [...seedChannels];

// Small helper so every function below can simulate realistic network
// latency without repeating the same setTimeout/Promise boilerplate.
function delay(value, ms = 500) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
function fail(message, ms = 500) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

// ---- Auth (Story 1) --------------------------------------------------

export async function signUp(email, password) {
  const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    // Acceptance criterion: block sign-up with an already-registered email,
    // and say so clearly (this message IS allowed to be specific).
    return fail("An account with that email already exists. Try logging in instead.");
  }
  const user = { id: nextId("u"), name: email.split("@")[0], email, password };
  users.push(user);
  return delay(user);
}

export async function login(email, password) {
  const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  // Acceptance criterion: a wrong email OR wrong password shows the SAME
  // generic message -- this is enforced here, at the source, so no screen
  // can accidentally leak which field was wrong.
  if (!match || match.password !== password) {
    return fail("That email or password isn't right. Please try again.");
  }
  return delay(match);
}

// ---- Channels (Story 2) ------------------------------------------------

export async function fetchChannels() {
  return delay(channels);
}

export async function createChannel(userId, { name, topic }) {
  const channel = { id: nextId("c"), name, topic, memberIds: [userId], messages: [] };
  channels = [...channels, channel];
  return delay(channel);
}

export async function joinChannel(channelId, userId) {
  channels = channels.map((c) =>
    c.id === channelId ? { ...c, memberIds: [...c.memberIds, userId] } : c
  );
  return delay(channels.find((c) => c.id === channelId));
}

// ---- Messages (Story 3) -------------------------------------------------

export async function sendMessage(channelId, userId, text) {
  // Simulated ~8% failure rate, so the UI has a real reason to exercise its
  // "clear message on failure" requirement instead of that path staying
  // permanently untested.
  if (Math.random() < 0.08) {
    return fail("Message failed to send.", 400);
  }
  const message = { id: nextId("m"), channelId, userId, text, ts: Date.now(), failed: false };
  channels = channels.map((c) =>
    c.id === channelId ? { ...c, messages: [...c.messages, message] } : c
  );
  return delay(message, 300);
}

export function getUserById(userId) {
  // Synchronous on purpose: this is used for looking up a message author to
  // render their name/avatar, which happens many times per render and
  // shouldn't trigger a loading state each time.
  return users.find((u) => u.id === userId) || { id: userId, name: "Unknown" };
}
