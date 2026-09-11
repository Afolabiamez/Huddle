import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { PrimaryButton } from "../components/PrimaryButton";
import { Banner } from "../components/Banner";

export function CreateChannelScreen() {
  const { createChannel } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();

    // Acceptance criterion: a channel is created "by giving it a name" --
    // so a name is the one required field.
    if (!trimmed) {
      setError("Give your channel a name to continue.");
      return;
    }
    if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
      setError("Use letters, numbers, and dashes only.");
      return;
    }

    setLoading(true);
    const channel = await createChannel({ name: trimmed, topic: topic.trim() });
    navigate(`/channels/${channel.id}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="p-5 border-b border-border flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-xl text-ink">‹</button>
        <h1 className="font-bold text-lg font-heading text-ink">Create a new Channel</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        <Banner message={error} onDismiss={() => setError("")} />

        <div>
          <label className="text-sm font-semibold text-ink">Channel Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="eg. general"
            className="w-full rounded-xl border border-border px-4 py-3 mt-1 outline-none"
          />
          <p className="text-xs mt-1 text-slate">Use letters, numbers and dashes only.</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-ink">Topic (optional)</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Add a short description for this channel…"
            className="w-full rounded-xl border border-border px-4 py-3 mt-1 outline-none resize-none"
            rows={3}
          />
        </div>

        <PrimaryButton type="submit" loading={loading}>+ Create a Channel</PrimaryButton>
      </form>
    </div>
  );
}
