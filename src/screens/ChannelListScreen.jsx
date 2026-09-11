import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { Avatar } from "../components/Avatar";
import { ChannelListItem } from "../components/ChannelListItem";
import { PrimaryButton } from "../components/PrimaryButton";

export function ChannelListScreen() {
  const { currentUser, channels, joinChannel, logout } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const visible = channels.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  async function handleSelect(channel) {
    const isMember = channel.memberIds.includes(currentUser.id);
    if (!isMember) {
      await joinChannel(channel.id); // Story 2: join a channel from the list
    }
    navigate(`/channels/${channel.id}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-heading text-ink">Huddle</h1>
          <p className="text-xs text-slate">{channels.length} channels</p>
        </div>
        <div className="flex items-center gap-3">
          <Avatar user={currentUser} size={32} />
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="text-xs font-semibold text-slate"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="p-4">
        <input
          placeholder="Search channels…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl px-4 py-2.5 outline-none bg-surface-muted"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {visible.length === 0 && (
          <div className="text-center mt-16 px-6">
            <h2 className="text-lg font-bold font-heading text-ink">Welcome to Huddle</h2>
            <p className="text-sm mt-2 text-slate">Get things started by creating your first channel.</p>
          </div>
        )}

        {visible.map((channel, i) => (
          <ChannelListItem
            key={channel.id}
            channel={channel}
            accentIndex={i}
            isMember={channel.memberIds.includes(currentUser.id)}
            onSelect={() => handleSelect(channel)}
          />
        ))}
      </div>

      <div className="p-4">
        <PrimaryButton onClick={() => navigate("/channels/new")}>+ Create a Channel</PrimaryButton>
      </div>
    </div>
  );
}
