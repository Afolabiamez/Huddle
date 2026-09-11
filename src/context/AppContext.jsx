import { createContext, useState, useCallback } from "react";
import * as api from "../api/mockApi";

// eslint-disable-next-line react-refresh/only-export-components
export const AppContext = createContext(null);

// This provider is the ONLY place in the app that calls `api.*` functions
// directly and holds `currentUser` / `channels` in React state. Every
// screen reads and writes through the actions below (login, sendMessage,
// etc.) instead of talking to the API layer itself -- this keeps "how do we
// fetch/store data" in one place, separate from "how does this page look".
export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [channels, setChannels] = useState([]);

  const loadChannels = useCallback(async () => {
    const data = await api.fetchChannels();
    setChannels(data);
  }, []);

  async function login(email, password) {
    const user = await api.login(email, password); // throws on bad credentials
    setCurrentUser(user);
    await loadChannels();
  }

  async function signUp(email, password) {
    const user = await api.signUp(email, password); // throws on duplicate email
    setCurrentUser(user);
    await loadChannels();
  }

  function logout() {
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

  // Optimistic send: the message is shown immediately (`pending: true`),
  // then either confirmed or marked failed once the simulated request
  // resolves. This is what makes sending feel instant even with network
  // delay, while still surfacing a real failure state per the PRD's
  // "no silent failures" quality bar.
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
    login,
    signUp,
    logout,
    createChannel,
    joinChannel,
    sendMessage,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
