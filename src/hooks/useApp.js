import { useContext } from "react";
import { AppContext } from "../context/AppContext";

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    // Fails loudly and specifically instead of `ctx.currentUser` throwing a
    // cryptic "Cannot read properties of null" somewhere deep in a screen.
    throw new Error("useApp() must be used inside <AppProvider>");
  }
  return ctx;
}
