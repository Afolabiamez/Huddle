import { createContext, useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { saveSession, getSession, clearSession } from "../api/authStorage";

// eslint-disable-next-line react-refresh/only-export-components
export const AppContext = createContext(null);

// This provider is the ONLY place in the app that calls `api.*` functions
// directly and holds `currentUser` / `channels` in React state. Every
// screen reads and writes through the actions below instead of talking to
// the API layer itself -- this keeps "how do we fetch/store data" in one
// place, separate from "how does this page look". Swapping mock <-> real
// backend (see src/api/index.js) never requires touching this file.
export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [channels, setChannels] = useState([]);

  // `initializing` covers the brief moment where we're checking
  // localStorage for a saved session before deciding whether to show the
  // logged-out or logged-in experience -- without this, a refreshed page
  // would flash the onboarding screen even for someone already logged in.
  const [initializing, setInitializing] = useState(true);

  const loadChannels = useCallback(async () => {
    const data = await api.fetchChannels();
    setChannels(data);
  }, []);

  // On first load, restore a previous session (Story 1: "a person stays
  // logged in until they log out or their session ends"). This is what
  // makes that acceptance criterion survive a real page refresh, which the
  // earlier in-chat demo version couldn't do (no localStorage there).
  useEffect(() => {
    async function restore() {
      const session = getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        try {
          await loadChannels();
        } catch {
          // A stale/expired token shouldn't trap the person on a broken
          // screen -- fall back to logged-out and let them sign in again.
          clearSession();
          setCurrentUser(null);
        }
      }
      setInitializing(false);
    }
    restore();
  }, [loadChannels]);

  async function login(email, password) {
    const { token, user } = await api.login(email, password); // throws on bad credentials
    saveSession(token, user);
    setCurrentUser(user);
    await loadChannels();
  }

  async function signUp(email, password) {
    const { token, user } = await api.signUp(email, password); // throws on duplicate email
    saveSession(token, user);
    setCurrentUser(user);
    await loadChannels();
  }

  function logout() {
    clearSession();
    setCurrentUser(null);
    setChannels([]);
  }

  async function createChannel({ name, topic }) {
    const channel = await api.createChannel(currentUser.id, { name, topic });
    setChannels((prev) => [...prev, channel]);
    return channel;
  }

  async function joinChannel(channelId) {
    const updated = await api.joinChannel(channelId, currentUser.id);
    setChannels((prev) => prev.map((c) => (c.id === channelId ? updated : c)));
  }

  // Messages are loaded per-channel, on demand, rather than all up front --
  // see api/realApi.js for why. Called by ChannelViewScreen when it mounts.
  async function loadMessages(channelId) {
    const messages = await api.fetchMessages(channelId);
    setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, messages } : c)));
  }

  // Optimistic send: the message is shown immediately (`pending: true`),
  // then either confirmed or marked failed once the request resolves. This
  // is what makes sending feel instant even with real network latency,
  // while still surfacing a real failure state per the PRD's "no silent
  // failures" quality bar.
  async function sendMessage(channelId, text) {
    const tempId = `pending_${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      channelId,
      userId: currentUser.id,
      text,
      ts: Date.now(),
      pending: true,
      failed: false,
    };
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, messages: [...c.messages, optimisticMessage] } : c))
    );

    try {
      const confirmed = await api.sendMessage(channelId, currentUser.id, text);
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channelId
            ? { ...c, messages: c.messages.map((m) => (m.id === tempId ? confirmed : m)) }
            : c
        )
      );
    } catch {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channelId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === tempId ? { ...m, pending: false, failed: true } : m
                ),
              }
            : c
        )
      );
    }
  }

  const value = {
    currentUser,
    channels,
    initializing,
    login,
    signUp,
    logout,
    createChannel,
    joinChannel,
    loadMessages,
    sendMessage,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
