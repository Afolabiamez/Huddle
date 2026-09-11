import { initials, colorForId } from "../utils/helpers";

export function Avatar({ user, size = 36 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: colorForId(user.id), fontSize: size * 0.38 }}
    >
      {initials(user.name)}
    </div>
  );
}
