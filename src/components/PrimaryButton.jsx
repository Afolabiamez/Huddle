export function PrimaryButton({ children, onClick, disabled, loading, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full rounded-full py-3.5 font-semibold text-white bg-primary transition-opacity disabled:opacity-60"
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
