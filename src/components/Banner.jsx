// A dismissible banner for surfacing clear, non-silent errors. Exists
// because the PRD's quality bar requires failures to show a clear message
// rather than fail silently -- every screen that can fail reuses this
// instead of hand-rolling its own error box with slightly different styling.
export function Banner({ message, tone = "error", onDismiss }) {
  if (!message) return null;
  const isError = tone === "error";

  return (
    <div
      className="w-full rounded-xl px-4 py-3 mb-4 flex items-start justify-between gap-3 text-sm"
      style={{
        background: isError ? "var(--color-danger-bg)" : "#eaf6ec",
        color: isError ? "var(--color-danger)" : "#166534",
      }}
    >
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="font-bold leading-none" aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
