import { Avatar } from "./Avatar";
import { formatTime } from "../utils/helpers";

export function MessageBubble({ message, author, isMe, onRetry }) {
  return (
    <div className="flex gap-3">
      <Avatar user={author} size={32} />
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-ink">{isMe ? "You" : author.name}</span>
          <span className="text-xs text-slate">{formatTime(message.ts)}</span>
          {message.pending && <span className="text-xs text-slate">sending…</span>}
        </div>
        <p className="text-sm mt-0.5 text-ink">{message.text}</p>

        {/* Per-message failure state, per the quality bar: a clear message
            on failure, never a silent drop. */}
        {message.failed && (
          <button onClick={onRetry} className="text-xs mt-1 font-semibold text-danger">
            ⚠ Failed to send — tap to retry
          </button>
        )}
      </div>
    </div>
  );
}
