import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { api } from "../api";
import { MessageBubble } from "../components/MessageBubble";
import { colorForId } from "../utils/helpers";

const PAGE_SIZE = 6;

export function ChannelViewScreen() {
  const { channelId } = useParams();
  const { channels, currentUser, sendMessage, loadMessages } = useApp();
  const navigate = useNavigate();

  const channel = channels.find((c) => c.id === channelId);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  // If someone lands on a channel URL directly and it doesn't exist (or
  // hasn't loaded yet), send them back rather than rendering a broken page.
  useEffect(() => {
    if (channels.length > 0 && !channel) navigate("/channels", { replace: true });
  }, [channel, channels, navigate]);

  // Messages are fetched per-channel on demand (see api/realApi.js), so
  // load them the moment this screen opens for a given channel.
  useEffect(() => {
    if (channelId) loadMessages(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const messages = channel?.messages ?? [];
  const shown = messages.slice(Math.max(0, messages.length - visibleCount));
  const hasMore = messages.length > visibleCount;

  // Auto-scroll to the newest message when a new one arrives (but not when
  // paging backward through history, which would be jarring).
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  function handleSend(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(channel.id, draft.trim());
    setDraft("");
  }

  // Prefers author data embedded directly on the message (some APIs send
  // this), falling back to the best-effort local cache in api/realApi.js.
  function resolveAuthor(message) {
    return message.author ?? api.getUserById(message.userId);
  }

  if (!channel) return null;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <button onClick={() => navigate("/channels")} className="text-xl text-ink">‹</button>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
          style={{ background: colorForId(channel.id) }}
        >
          #
        </div>
        <div>
          <p className="font-semibold text-ink">{channel.name}</p>
          <p className="text-xs text-slate">{channel.memberIds.length} members</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-center mt-10 px-6">
            <h2 className="font-bold text-lg font-heading text-ink">Welcome to #{channel.name}!</h2>
            <p className="text-sm mt-2 text-slate">
              This is the start of the #{channel.name} channel. Send a message to start the conversation.
            </p>
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="self-center text-xs font-semibold px-4 py-2 rounded-full text-primary bg-blue-50"
          >
            Load earlier messages
          </button>
        )}

        {shown.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            author={resolveAuthor(m)}
            isMe={m.userId === currentUser.id}
            onRetry={() => sendMessage(channel.id, m.text)}
          />
        ))}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-border flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message #${channel.name}`}
          className="flex-1 rounded-full px-4 py-3 outline-none bg-surface-muted"
        />
        <button
          type="submit"
          className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 bg-primary"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
