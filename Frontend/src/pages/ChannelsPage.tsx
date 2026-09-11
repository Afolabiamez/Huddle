import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { api } from "../api/client";
import { ApiError, type Channel } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { colorFor, initialFor } from "../lib/avatarColor";

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [newChannelName, setNewChannelName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const list = await api.listChannels();
    setChannels(list);
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = api.subscribe("channels", load);
    return unsubscribe;
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const channel = await api.createChannel(newChannelName);
      setNewChannelName("");
      await load();
      navigate(`/channels/${channel.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that channel.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(channelId: string) {
    setError(null);
    setBusyId(channelId);
    try {
      await api.joinChannel(channelId);
      await load();
      navigate(`/channels/${channelId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't join that channel.");
    } finally {
      setBusyId(null);
    }
  }

  const isMember = (channel: Channel) => !!user && channel.memberIds.includes(user.id);

  return (
    <div className="page">
      <TopBar />
      <main className="content">
        <section className="panel">
          <h2>Create a channel</h2>
          <form className="inline-form" onSubmit={handleCreate}>
            <input
              placeholder="e.g. product-launch"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              disabled={creating}
            />
            <button type="submit" className="primary-button" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </button>
          </form>
        </section>

        {error && <div className="form-error" role="alert">{error}</div>}

        <section className="panel">
          <h2>Channels</h2>
          {channels === null && <p className="muted">Loading channels…</p>}
          {channels !== null && channels.length === 0 && (
            <p className="muted">No channels yet — be the first to create one above.</p>
          )}
          <ul className="channel-list">
            {channels?.map((channel) => (
              <li key={channel.id} className="channel-row">
                <div className="channel-row-main">
                  <span
                    className="channel-icon"
                    style={{ background: colorFor(channel.name) }}
                    aria-hidden="true"
                  >
                    {initialFor(channel.name)}
                  </span>
                  <div className="channel-row-text">
                    <div className="channel-row-name">
                      <span className="channel-hash">#</span>
                      {channel.name}
                    </div>
                    <div className="muted">{channel.memberIds.length} member(s)</div>
                  </div>
                </div>
                {isMember(channel) ? (
                  <button className="secondary-button" onClick={() => navigate(`/channels/${channel.id}`)}>
                    Open
                  </button>
                ) : (
                  <button
                    className="secondary-button"
                    disabled={busyId === channel.id}
                    onClick={() => handleJoin(channel.id)}
                  >
                    {busyId === channel.id ? "Joining…" : "Join"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
