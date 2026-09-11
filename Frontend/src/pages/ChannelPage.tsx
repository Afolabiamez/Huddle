import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import { api } from "../api/client";
import { ApiError, type Channel, type Message } from "../api/types";
import { useAuth } from "../context/AuthContext";

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const [channel, setChannel] = useState<Channel | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!channelId) return;
    const list = await api.listMessages(channelId);
    setMessages(list);
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;

    api.getChannel(channelId).then((c) => {
      if (!cancelled) setChannel(c);
    });
    loadMessages();

    const unsubscribe = api.subscribe("messages", loadMessages);
    // Also poll, so a second tab picks up new messages even if the
    // browser doesn't fire a "storage" event for some reason.
    const interval = setInterval(loadMessages, 2000);
    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(interval);
    };
  }, [channelId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const isMember = channel && user ? channel.memberIds.includes(user.id) : false;

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!channelId) return;
    setError(null);
    setSending(true);
    try {
      await api.sendMessage(channelId, draft);
      setDraft("");
      await loadMessages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That message didn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (channel === undefined) {
    return (
      <div className="page">
        <TopBar />
        <main className="content page-center">Loading channel…</main>
      </div>
    );
  }

  if (channel === null) {
    return (
      <div className="page">
        <TopBar />
        <main className="content page-center">
          <p>This channel doesn't exist anymore.</p>
          <Link to="/channels">Back to channels</Link>
        </main>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="page">
        <TopBar />
        <main className="content page-center">
          <p>You need to join #{channel.name} before you can see its messages.</p>
          <button className="primary-button" onClick={() => navigate("/channels")}>
            Go to channels
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar />
      <main className="content channel-view">
        <div className="channel-header">
          <Link to="/channels" className="link-button">
            ← Channels
          </Link>
          <h2>
            <span className="channel-hash">#</span>
            {channel.name}
          </h2>
        </div>

        <div className="message-list">
          {messages === null && <p className="muted">Loading messages…</p>}
          {messages !== null && messages.length === 0 && (
            <p className="muted">No messages yet — say hello.</p>
          )}
          {messages?.map((m) => (
            <div key={m.id} className={"message" + (m.authorId === user?.id ? " message-own" : "")}>
              <div className="message-meta">
                <span className="message-author">{m.authorEmail}</span>
                <span className="message-time">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="message-text">{m.text}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <form className="inline-form" onSubmit={handleSend}>
          <input
            placeholder={`Message #${channel.name}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={sending}
          />
          <button type="submit" className="primary-button" disabled={sending || !draft.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      </main>
    </div>
  );
}
