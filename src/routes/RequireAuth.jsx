import { Navigate } from "react-router-dom";
import { useApp } from "../hooks/useApp";

// Wraps any route element that should only be reachable while logged in.
// This directly implements the Story 1 acceptance criterion "a person
// stays logged in until they log out" -- the inverse of that rule is "a
// person who is NOT logged in should never land on a page meant for
// logged-in users", which is what this component enforces.
export function RequireAuth({ children }) {
  const { currentUser, initializing } = useApp();

  // Don't redirect yet if we're still checking localStorage for a saved
  // session -- otherwise a logged-in person refreshing the page would be
  // bounced to /auth for a split second before their session is restored.
  if (initializing) return null;

  if (!currentUser) return <Navigate to="/auth" replace />;
  return children;
}
