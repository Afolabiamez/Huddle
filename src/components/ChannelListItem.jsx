import { ACCENTS } from "../utils/helpers";

export function ChannelListItem({ channel, accentIndex, isMember, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 py-3 border-b border-border text-left"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
        style={{ background: ACCENTS[accentIndex % ACCENTS.length] }}
      >
        #
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink">{channel.name}</p>
        <p className="text-xs truncate text-slate">
          {channel.topic || "No topic set"} · {channel.memberIds.length} members
        </p>
      </div>
      {!isMember && (
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full text-primary bg-blue-50">
          Join
        </span>
      )}
    </button>
  );
}
