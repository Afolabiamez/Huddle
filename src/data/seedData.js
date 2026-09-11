import { nextId } from "../utils/helpers";

// Ready-made accounts so you're not forced to sign up every time you reload
// the app during development.
export const seedUsers = [
  { id: "u1", name: "Demo User", email: "demo@huddle.com", password: "password123" },
  { id: "u2", name: "Farida Samuel", email: "farida@huddle.com", password: "password123" },
  { id: "u3", name: "Mahmud Olise", email: "mahmud@huddle.com", password: "password123" },
];

const SEED_LINES = [
  "Morning team, quick sync at 10?",
  "Sounds good, I'll be there.",
  "Just pushed the latest changes, can someone review?",
  "On it now.",
  "Let's keep the momentum, we only have 6 days left.",
  "We need to submit the designs before EOD today.",
  "New update from the vendors, found the materials we needed.",
  "Nice work everyone, really appreciate the effort this week.",
];

// Builds a run of seeded historical messages so the "scroll back and see
// earlier messages" acceptance criterion (Story 3) has something real to
// demonstrate without needing a live backend.
function seedMessages(channelId, authorIds, count) {
  const messages = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    messages.push({
      id: nextId("m"),
      channelId,
      userId: authorIds[i % authorIds.length],
      text: SEED_LINES[i % SEED_LINES.length],
      ts: now - (count - i) * 60000, // spaced a minute apart, oldest first
      failed: false,
    });
  }
  return messages;
}

export const seedChannels = [
  {
    id: "c1",
    name: "general",
    topic: "Team-wide announcements and conversation",
    memberIds: ["u1", "u2", "u3"],
    messages: seedMessages("c1", ["u2", "u3", "u2"], 14),
  },
  {
    id: "c2",
    name: "design",
    topic: "Design critique and shared assets",
    memberIds: ["u2"],
    messages: [],
  },
  {
    id: "c3",
    name: "dev-updates",
    topic: "Build status and engineering notes",
    memberIds: ["u2", "u3"],
    messages: seedMessages("c3", ["u3"], 4),
  },
];
